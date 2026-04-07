import { defineStore } from 'pinia';
import { ref } from 'vue';
import { Room, Player, Round, GameRecord, SettlementItem } from '../types';
import { storage } from '../services/storage';
import { generateId } from '../utils/id';
import { generateRoomId } from '../services/roomCode';
import { calculateSettlements } from '../services/settlement';
import { getAvatarColor } from '../utils/format';

export const useRoomStore = defineStore('room', () => {
  const rooms = ref<Room[]>([]);
  const currentRoom = ref<Room | null>(null);
  const lastSettlement = ref<{
    finalScores: { playerId: string; score: number; rank: number }[];
    settlements: SettlementItem[];
    record: GameRecord;
  } | null>(null);

  function loadRooms() {
    rooms.value = storage.get<Room[]>('rooms') || [];
  }

  function createRoom(params: {
    name: string;
    gameType: Room['gameType'];
    initialScore?: number;
    unitAmount?: number;
    teaFee?: number;
    playerName: string;
  }): Room {
    const { name, gameType, initialScore = 1000, unitAmount = 1, teaFee = 0, playerName } = params;
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
    rooms.value.push(room);
    currentRoom.value = room;
    storage.set('rooms', rooms.value);
    return room;
  }

  function joinRoom(roomId: string, playerName: string): Room | null {
    const room = rooms.value.find(r => r.roomId === roomId && r.status === 'active');
    if (!room) return null;
    if (room.players.length >= 8) return null;
    const player: Player = {
      playerId: generateId(),
      name: playerName,
      avatarColor: getAvatarColor(room.players.length),
      currentScore: room.initialScore
    };
    room.players.push(player);
    currentRoom.value = room;
    storage.set('rooms', rooms.value);
    return room;
  }

  function leaveRoom(roomId: string, playerId: string) {
    const room = rooms.value.find(r => r.roomId === roomId);
    if (room) {
      room.players = room.players.filter(p => p.playerId !== playerId);
    }
    rooms.value = rooms.value.filter(r => r.players.length > 0);
    if (currentRoom.value?.roomId === roomId) {
      currentRoom.value = null;
    }
    storage.set('rooms', rooms.value);
  }

  function getRoom(roomId: string): Room | null {
    return rooms.value.find(r => r.roomId === roomId) || null;
  }

  function addPlayer(roomId: string, playerName: string): Player | null {
    const room = rooms.value.find(r => r.roomId === roomId);
    if (!room || room.players.length >= 8) return null;
    const player: Player = {
      playerId: generateId(),
      name: playerName,
      avatarColor: getAvatarColor(room.players.length),
      currentScore: room.initialScore
    };
    room.players.push(player);
    currentRoom.value = room;
    storage.set('rooms', rooms.value);
    return player;
  }

  function removePlayer(roomId: string, playerId: string) {
    const room = rooms.value.find(r => r.roomId === roomId);
    if (room) {
      room.players = room.players.filter(p => p.playerId !== playerId);
    }
    rooms.value = rooms.value.filter(r => r.players.length > 0);
    if (currentRoom.value?.roomId === roomId) {
      currentRoom.value = null;
    }
    storage.set('rooms', rooms.value);
  }

  function recordRound(params: {
    roomId: string;
    winners: string[];
    losers: string[];
    amount: number;
  }): Round | null {
    const { roomId, winners, losers, amount } = params;
    const room = rooms.value.find(r => r.roomId === roomId);
    if (!room || winners.length === 0 || losers.length === 0 || amount <= 0) return null;

    const scoreChanges: Record<string, number> = {};
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

    if (room.teaFee > 0) {
      room.players.forEach(p => {
        p.currentScore -= room.teaFee;
      });
    }

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
    currentRoom.value = { ...room, players: room.players.map(p => ({ ...p })), rounds: [...room.rounds] };
    storage.set('rooms', rooms.value);
    return round;
  }

  function undoRound(roomId: string): Round | null {
    const room = rooms.value.find(r => r.roomId === roomId);
    if (!room || room.rounds.length === 0) return null;
    const lastRound = room.rounds.pop()!;
    Object.entries(lastRound.scoreChanges).forEach(([pid, change]) => {
      const p = room.players.find(p => p.playerId === pid);
      if (p) p.currentScore -= change;
    });
    if (room.teaFee > 0) {
      room.players.forEach(p => {
        p.currentScore += room.teaFee;
      });
    }
    currentRoom.value = { ...room, players: room.players.map(p => ({ ...p })), rounds: [...room.rounds] };
    storage.set('rooms', rooms.value);
    return lastRound;
  }

  function settleRoom(roomId: string) {
    const room = rooms.value.find(r => r.roomId === roomId);
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
        teaFee: room.teaFee,
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

    rooms.value = rooms.value.filter(r => r.roomId !== roomId);
    currentRoom.value = null;
    lastSettlement.value = { finalScores, settlements, record };
    storage.set('rooms', rooms.value);

    return { finalScores, settlements, record };
  }

  function setCurrentRoom(room: Room | null) {
    currentRoom.value = room;
  }

  function updateTeaFee(roomId: string, teaFee: number) {
    const room = rooms.value.find(r => r.roomId === roomId);
    if (room) room.teaFee = teaFee;
    if (currentRoom.value && currentRoom.value.roomId === roomId) {
      currentRoom.value = { ...currentRoom.value, teaFee };
    }
    storage.set('rooms', rooms.value);
  }

  function loadCurrentRoom() {
    if (currentRoom.value) {
      const updated = rooms.value.find(r => r.roomId === currentRoom.value!.roomId);
      if (updated) currentRoom.value = updated;
    }
  }

  return {
    rooms,
    currentRoom,
    lastSettlement,
    loadRooms,
    createRoom,
    joinRoom,
    leaveRoom,
    getRoom,
    addPlayer,
    removePlayer,
    recordRound,
    undoRound,
    settleRoom,
    setCurrentRoom,
    updateTeaFee,
    loadCurrentRoom
  };
});
