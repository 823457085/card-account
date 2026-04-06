import { create } from 'zustand';
import { Room, Player, Round, GameRecord, SettlementItem } from '../types';
import { storage } from '../services/storage';
import { generateId } from '../utils/id';
import { generateRoomId } from '../services/roomCode';
import { calculateSettlements } from '../services/settlement';
import { getAvatarColor } from '../utils/format';

interface RoomState {
  rooms: Room[];
  currentRoom: Room | null;
  lastSettlement: { finalScores: { playerId: string; score: number; rank: number }[]; settlements: SettlementItem[]; record: GameRecord } | null;

  loadRooms: () => void;
  createRoom: (params: { name: string; gameType: Room['gameType']; initialScore?: number; unitAmount?: number; teaFee?: number; playerName: string }) => Room;
  joinRoom: (roomId: string, playerName: string) => Room | null;
  leaveRoom: (roomId: string, playerId: string) => void;
  getRoom: (roomId: string) => Room | null;
  addPlayer: (roomId: string, playerName: string) => Player | null;
  removePlayer: (roomId: string, playerId: string) => void;

  recordRound: (params: { roomId: string; winners: string[]; losers: string[]; amount: number }) => Round | null;
  undoRound: (roomId: string) => Round | null;
  settleRoom: (roomId: string) => { finalScores: { playerId: string; score: number; rank: number }[]; settlements: SettlementItem[]; record: GameRecord } | null;
  setCurrentRoom: (room: Room | null) => void;
  loadCurrentRoom: () => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  rooms: [],
  currentRoom: null,
  lastSettlement: null,

  loadRooms: () => {
    const rooms = storage.get<Room[]>('rooms') || [];
    set({ rooms });
  },

  createRoom: ({ name, gameType, initialScore = 1000, unitAmount = 1, teaFee = 0, playerName }) => {
    const roomId = generateRoomId();
    const creator: Player = {
      playerId: generateId(),
      name: playerName,
      avatarColor: getAvatarColor(0),
      currentScore: initialScore
    };
    const room: Room = {
      roomId,
      name,
      gameType,
      initialScore,
      unitAmount,
      teaFee,
      players: [creator],
      rounds: [],
      status: 'active',
      createdAt: Date.now()
    };
    const rooms = [...get().rooms, room];
    set({ rooms, currentRoom: room });
    storage.set('rooms', rooms);
    return room;
  },

  joinRoom: (roomId, playerName) => {
    const room = get().rooms.find(r => r.roomId === roomId && r.status === 'active');
    if (!room) return null;
    if (room.players.length >= 8) return null;
    const player: Player = {
      playerId: generateId(),
      name: playerName,
      avatarColor: getAvatarColor(room.players.length),
      currentScore: room.initialScore
    };
    const newRoom = { ...room, players: [...room.players, player] };
    const rooms = get().rooms.map(r => r.roomId === roomId ? newRoom : r);
    set({ rooms, currentRoom: newRoom });
    storage.set('rooms', rooms);
    return newRoom;
  },

  leaveRoom: (roomId, playerId) => {
    const rooms = get().rooms.map(r => {
      if (r.roomId === roomId) {
        r.players = r.players.filter(p => p.playerId !== playerId);
      }
      return r;
    }).filter(r => r.players.length > 0);
    set({ rooms, currentRoom: null });
    storage.set('rooms', rooms);
  },

  getRoom: (roomId) => {
    return get().rooms.find(r => r.roomId === roomId) || null;
  },

  addPlayer: (roomId, playerName) => {
    const room = get().rooms.find(r => r.roomId === roomId);
    if (!room || room.players.length >= 8) return null;
    const player: Player = {
      playerId: generateId(),
      name: playerName,
      avatarColor: getAvatarColor(room.players.length),
      currentScore: room.initialScore
    };
    const newRoom = { ...room, players: [...room.players, player] };
    const rooms = get().rooms.map(r => r.roomId === roomId ? newRoom : r);
    set({ rooms, currentRoom: newRoom });
    storage.set('rooms', rooms);
    return player;
  },

  removePlayer: (roomId, playerId) => {
    const rooms = get().rooms.map(r => {
      if (r.roomId === roomId) {
        r.players = r.players.filter(p => p.playerId !== playerId);
      }
      return r;
    }).filter(r => r.players.length > 0);
    set({ rooms, currentRoom: get().currentRoom?.roomId === roomId ? null : get().currentRoom });
    storage.set('rooms', rooms);
  },

  recordRound: ({ roomId, winners, losers, amount }) => {
    const room = get().rooms.find(r => r.roomId === roomId);
    if (!room || winners.length === 0 || losers.length === 0 || amount <= 0) return null;

    const scoreChanges: Record<string, number> = {};
    // Use integer (cents) to avoid float precision issues
    // e.g. 33.33 * 3 = 99.99 instead of 100
    const amountCents = Math.round(amount * 100);
    const loserShareCents = Math.floor(amountCents / losers.length);
    const winnerShareCents = Math.floor(amountCents / winners.length);

    losers.forEach(lid => {
      scoreChanges[lid] = -(loserShareCents * winners.length) / 100;
    });
    winners.forEach(wid => {
      scoreChanges[wid] = (winnerShareCents * losers.length) / 100;
    });

    winners.forEach(wid => {
      const p = room.players.find(p => p.playerId === wid);
      if (p) p.currentScore += scoreChanges[wid];
    });
    losers.forEach(lid => {
      const p = room.players.find(p => p.playerId === lid);
      if (p) p.currentScore += scoreChanges[lid];
    });

    const round: Round = {
      roundId: generateId(),
      roundNumber: room.rounds.length + 1,
      winners,
      losers,
      amount,
      scoreChanges,
      createdAt: Date.now()
    };
    room.rounds.push(round);
    set({ rooms: [...get().rooms], currentRoom: { ...room, players: room.players.map(p => ({ ...p })), rounds: [...room.rounds] } });
    storage.set('rooms', get().rooms);
    return round;
  },

  undoRound: (roomId) => {
    const room = get().rooms.find(r => r.roomId === roomId);
    if (!room || room.rounds.length === 0) return null;
    const lastRound = room.rounds.pop()!;
    Object.entries(lastRound.scoreChanges).forEach(([pid, change]) => {
      const p = room.players.find(p => p.playerId === pid);
      if (p) p.currentScore -= change;
    });
    set({ rooms: [...get().rooms], currentRoom: { ...room, players: room.players.map(p => ({ ...p })), rounds: [...room.rounds] } });
    storage.set('rooms', get().rooms);
    return lastRound;
  },

  settleRoom: (roomId) => {
    const room = get().rooms.find(r => r.roomId === roomId);
    if (!room) return null;

    const settlements = calculateSettlements(room.players, room.initialScore);
    const finalScores = room.players
      .map(p => ({ playerId: p.playerId, score: p.currentScore }))
      .sort((a, b) => b.score - a.score)
      .map((fs, idx) => ({ ...fs, rank: idx + 1 }));

    const record: GameRecord = {
      recordId: generateId(),
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

    const history = storage.get<GameRecord[]>('history') || [];
    history.unshift(record);
    storage.set('history', history);

    const rooms = get().rooms.filter(r => r.roomId !== roomId);
    set({ rooms, currentRoom: null, lastSettlement: { finalScores, settlements, record } });
    storage.set('rooms', rooms);

    return { finalScores, settlements, record };
  },

  setCurrentRoom: (room) => set({ currentRoom: room }),

  updateTeaFee: (roomId: string, teaFee: number) => {
    const rooms = get().rooms.map(r => {
      if (r.roomId === roomId) {
        return { ...r, teaFee };
      }
      return r;
    });
    const currentRoom = get().currentRoom;
    if (currentRoom && currentRoom.roomId === roomId) {
      set({ rooms, currentRoom: { ...currentRoom, teaFee } });
    } else {
      set({ rooms });
    }
    storage.set('rooms', rooms);
  },

  loadCurrentRoom: () => {
    const { currentRoom, rooms } = get();
    if (currentRoom) {
      const updated = rooms.find(r => r.roomId === currentRoom.roomId);
      if (updated) set({ currentRoom: updated });
    }
  }
}));
