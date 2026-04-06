export type GameType = 'mahjong' | 'poker' | 'guandan' | 'custom';
export type RoomStatus = 'active' | 'settled';

export interface Player {
  playerId: string;
  name: string;
  avatarColor: string;
  currentScore: number;
}

export interface Round {
  roundId: string;
  roundNumber: number;
  winners: string[];
  losers: string[];
  amount: number;
  scoreChanges: Record<string, number>;
  createdAt: number;
}

export interface SettlementItem {
  from: string;
  to: string;
  amount: number;
}

export interface Room {
  roomId: string;
  name: string;
  gameType: GameType;
  initialScore: number;
  unitAmount: number;
  players: Player[];
  rounds: Round[];
  status: RoomStatus;
  createdAt: number;
  updatedAt: number;
}

export interface GameRecord {
  recordId: string;
  roomSnapshot: Omit<Room, 'rounds' | 'status' | 'updatedAt'>;
  rounds: Round[];
  settlements: SettlementItem[];
  finalScores: { playerId: string; score: number }[];
  startedAt: number;
  endedAt: number;
}

export interface CreateRoomRequest {
  name: string;
  gameType: GameType;
  initialScore?: number;
  unitAmount?: number;
  playerName: string;
}

export interface JoinRoomRequest {
  playerName: string;
}

export interface RecordRoundRequest {
  winners: string[];
  losers: string[];
  amount: number;
}
