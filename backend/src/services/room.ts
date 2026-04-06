import db from '../db.js';
import { v4 as uuidv4 } from 'uuid';
import { generateRoomId } from './roomCode.js';
import { calculateSettlements } from './settlement.js';
import type { Room, Player, Round, GameRecord, GameType, CreateRoomRequest, RecordRoundRequest, SettlementItem } from '../models/types.js';

const AVATAR_COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];

// ---- helpers ----

function getActiveRoomIds(): Set<string> {
  const rows = db.prepare("SELECT room_id FROM rooms WHERE status = 'active'").all() as { room_id: string }[];
  return new Set(rows.map(r => r.room_id));
}

function rowToRoom(roomId: string): Room | null {
  const roomRow = db.prepare('SELECT * FROM rooms WHERE room_id = ?').get(roomId) as any;
  if (!roomRow) return null;

  const playerRows = db.prepare('SELECT * FROM players WHERE room_id = ?').all(roomId) as any[];
  const roundRows = db.prepare('SELECT * FROM rounds WHERE room_id = ? ORDER BY round_number ASC').all(roomId) as any[];

  const players: Player[] = playerRows.map(p => ({
    playerId: p.player_id,
    name: p.name,
    avatarColor: p.avatar_color,
    currentScore: p.current_score
  }));

  const rounds: Round[] = roundRows.map(r => ({
    roundId: r.round_id,
    roundNumber: r.round_number,
    winners: JSON.parse(r.winners),
    losers: JSON.parse(r.losers),
    amount: r.amount,
    scoreChanges: JSON.parse(r.score_changes),
    createdAt: r.created_at
  }));

  return {
    roomId: roomRow.room_id,
    name: roomRow.name,
    gameType: roomRow.game_type as GameType,
    initialScore: roomRow.initial_score,
    unitAmount: roomRow.unit_amount,
    players,
    rounds,
    status: roomRow.status,
    createdAt: roomRow.created_at,
    updatedAt: roomRow.updated_at
  };
}

// ---- room operations ----

export function createRoom(req: CreateRoomRequest): Room {
  const roomId = generateRoomId(getActiveRoomIds());
  const now = Date.now();
  const playerId = uuidv4();
  const avatarColor = AVATAR_COLORS[0];

  db.prepare(`
    INSERT INTO rooms (room_id, name, game_type, initial_score, unit_amount, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
  `).run(roomId, req.name, req.gameType, req.initialScore ?? 1000, req.unitAmount ?? 1, now, now);

  db.prepare(`
    INSERT INTO players (player_id, room_id, name, avatar_color, current_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(playerId, roomId, req.playerName, avatarColor, req.initialScore ?? 1000, now);

  return rowToRoom(roomId)!;
}

export function joinRoom(roomId: string, playerName: string): Room | null {
  const room = rowToRoom(roomId);
  if (!room || room.status !== 'active') return null;
  if (room.players.length >= 8) return null;

  const playerId = uuidv4();
  const avatarColor = AVATAR_COLORS[room.players.length % AVATAR_COLORS.length];
  const now = Date.now();

  db.prepare(`
    INSERT INTO players (player_id, room_id, name, avatar_color, current_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(playerId, roomId, playerName, avatarColor, room.initialScore, now);

  db.prepare('UPDATE rooms SET updated_at = ? WHERE room_id = ?').run(now, roomId);

  return rowToRoom(roomId);
}

export function getRoom(roomId: string): Room | null {
  return rowToRoom(roomId);
}

export function leaveRoom(roomId: string, playerId: string): void {
  const now = Date.now();
  db.prepare('DELETE FROM players WHERE room_id = ? AND player_id = ?').run(roomId, playerId);

  // Clean up empty rooms
  const remaining = db.prepare("SELECT COUNT(*) as cnt FROM players WHERE room_id = ?").get(roomId) as { cnt: number };
  if (remaining.cnt === 0) {
    db.prepare('DELETE FROM rounds WHERE room_id = ?').run(roomId);
    db.prepare('DELETE FROM rooms WHERE room_id = ?').run(roomId);
  } else {
    db.prepare('UPDATE rooms SET updated_at = ? WHERE room_id = ?').run(now, roomId);
  }
}

export function deleteRoom(roomId: string): void {
  db.prepare('DELETE FROM rounds WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM players WHERE room_id = ?').run(roomId);
  db.prepare('DELETE FROM rooms WHERE room_id = ?').run(roomId);
}

export function getAllRooms(): Room[] {
  const rows = db.prepare("SELECT room_id FROM rooms WHERE status = 'active'").all() as { room_id: string }[];
  return rows.map(r => rowToRoom(r.room_id)!).filter(Boolean);
}

export function addPlayer(roomId: string, playerName: string): Player | null {
  const room = rowToRoom(roomId);
  if (!room || room.players.length >= 8) return null;

  const playerId = uuidv4();
  const avatarColor = AVATAR_COLORS[room.players.length % AVATAR_COLORS.length];
  const now = Date.now();

  db.prepare(`
    INSERT INTO players (player_id, room_id, name, avatar_color, current_score, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(playerId, roomId, playerName, avatarColor, room.initialScore, now);
  db.prepare('UPDATE rooms SET updated_at = ? WHERE room_id = ?').run(now, roomId);

  return { playerId, name: playerName, avatarColor, currentScore: room.initialScore };
}

export function removePlayer(roomId: string, playerId: string): void {
  leaveRoom(roomId, playerId);
}

export function recordRound(roomId: string, req: RecordRoundRequest): Round | null {
  const room = rowToRoom(roomId);
  if (!room || room.status !== 'active') return null;
  if (req.winners.length === 0 || req.losers.length === 0 || req.amount <= 0) return null;

  // Calculate score changes (use cents to avoid float precision issues)
  const amountCents = Math.round(req.amount * 100);
  const loserShareCents = Math.floor(amountCents / req.losers.length);
  const winnerShareCents = Math.floor(amountCents / req.winners.length);

  const scoreChanges: Record<string, number> = {};
  req.losers.forEach(lid => {
    scoreChanges[lid] = -(loserShareCents * req.winners.length) / 100;
  });
  req.winners.forEach(wid => {
    scoreChanges[wid] = (winnerShareCents * req.losers.length) / 100;
  });

  const now = Date.now();
  const roundId = uuidv4();
  const roundNumber = room.rounds.length + 1;

  db.prepare(`
    INSERT INTO rounds (round_id, room_id, round_number, winners, losers, amount, score_changes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(roundId, roomId, roundNumber, JSON.stringify(req.winners), JSON.stringify(req.losers), req.amount, JSON.stringify(scoreChanges), now);

  // Update player scores
  const updateScore = db.prepare('UPDATE players SET current_score = current_score + ? WHERE room_id = ? AND player_id = ?');
  for (const [pid, change] of Object.entries(scoreChanges)) {
    updateScore.run(change, roomId, pid);
  }

  db.prepare('UPDATE rooms SET updated_at = ? WHERE room_id = ?').run(now, roomId);

  return { roundId, roundNumber, winners: req.winners, losers: req.losers, amount: req.amount, scoreChanges, createdAt: now };
}

export function undoRound(roomId: string): Round | null {
  const room = rowToRoom(roomId);
  if (!room || room.rounds.length === 0) return null;

  const lastRound = room.rounds[room.rounds.length - 1];
  db.prepare('DELETE FROM rounds WHERE round_id = ?').run(lastRound.roundId);

  // Revert scores
  const updateScore = db.prepare('UPDATE players SET current_score = current_score - ? WHERE room_id = ? AND player_id = ?');
  for (const [pid, change] of Object.entries(lastRound.scoreChanges)) {
    updateScore.run(change, roomId, pid);
  }

  db.prepare('UPDATE rooms SET updated_at = ? WHERE room_id = ?').run(Date.now(), roomId);

  return lastRound;
}

export function settleRoom(roomId: string): { room: Room; settlements: SettlementItem[]; record: GameRecord } | null {
  const room = rowToRoom(roomId);
  if (!room) return null;

  const settlements = calculateSettlements(room.players, room.initialScore);
  const finalScores = room.players
    .map(p => ({ playerId: p.playerId, score: p.currentScore }))
    .sort((a, b) => b.score - a.score)
    .map((fs, idx) => ({ ...fs, rank: idx + 1 }));

  const record: GameRecord = {
    recordId: uuidv4(),
    roomSnapshot: {
      roomId: room.roomId,
      name: room.name,
      gameType: room.gameType,
      initialScore: room.initialScore,
      unitAmount: room.unitAmount,
      players: room.players.map(p => ({ ...p })),
      createdAt: room.createdAt
    },
    rounds: [...room.rounds],
    settlements: [...settlements],
    finalScores: [...finalScores],
    startedAt: room.createdAt,
    endedAt: Date.now()
  };

  db.prepare(`
    INSERT INTO game_records (record_id, room_snapshot, rounds, settlements, final_scores, started_at, ended_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(record.recordId, JSON.stringify(record.roomSnapshot), JSON.stringify(record.rounds), JSON.stringify(record.settlements), JSON.stringify(record.finalScores), record.startedAt, record.endedAt);

  db.prepare("UPDATE rooms SET status = 'settled', updated_at = ? WHERE room_id = ?").run(Date.now(), roomId);

  return { room: { ...room, status: 'settled' }, settlements, record };
}

export function getHistory(): GameRecord[] {
  const rows = db.prepare('SELECT * FROM game_records ORDER BY ended_at DESC LIMIT 100').all() as any[];
  return rows.map(r => ({
    recordId: r.record_id,
    roomSnapshot: JSON.parse(r.room_snapshot),
    rounds: JSON.parse(r.rounds),
    settlements: JSON.parse(r.settlements),
    finalScores: JSON.parse(r.final_scores),
    startedAt: r.started_at,
    endedAt: r.ended_at
  }));
}
