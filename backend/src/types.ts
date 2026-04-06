// Shared types matching docs/tech.md

export enum GameType {
  MAHJONG = 'mahjong',
  DOUDIZHU = 'doudizhu',
  GUIDAN = 'guidan',
  CUSTOM = 'custom',
}

export enum RoomStatus {
  IN_PROGRESS = 'in_progress',
  SETTLED = 'settled',
}

export interface SettlementItem {
  from: string;
  to: string;
  amount: number;
}

export interface Player {
  playerId: string;
  name: string;
  avatarColor: string;
  currentScore: number;
  createdAt: number;
}

export interface PlayerProfile {
  playerId: string;
  name: string;
  avatarColor: string;
  playCount: number;
  totalWin: number;
  createdAt: number;
  updatedAt: number;
}

export interface Round {
  roundId: string;
  roomId: string;
  roundNumber: number;
  winners: string[];
  losers: string[];
  amount: number;
  settledItems: SettlementItem[];
  createdAt: number;
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
  creatorId: string;
}

export interface GameRecord {
  recordId: string;
  roomSnapshot: Omit<Room, 'rounds'>;
  finalScores: { playerId: string; name: string; score: number }[];
  totalRounds: number;
  settlements: SettlementItem[];
  startedAt: number;
  endedAt: number;
  duration: number;
  createdAt: number;
}

// DB row types (snake_case from SQLite)
export interface DbRoom {
  room_id: string;
  name: string;
  game_type: string;
  initial_score: number;
  unit_amount: number;
  creator_id: string;
  status: string;
  created_at: number;
  updated_at: number;
}

export interface DbPlayer {
  player_id: string;
  room_id: string;
  name: string;
  avatar_color: string;
  current_score: number;
  is_active: number;
  joined_at: number;
}

export interface DbRound {
  round_id: string;
  room_id: string;
  round_number: number;
  winners: string;
  losers: string;
  amount: number;
  settled_items: string;
  created_at: number;
}

export interface DbSettlement {
  settlement_id: string;
  room_id: string;
  final_scores: string;
  settlements: string;
  started_at: number;
  ended_at: number;
  duration: number;
  created_at: number;
}

export interface DbGameRecord {
  record_id: string;
  room_snapshot: string;
  final_scores: string;
  total_rounds: number;
  settlements: string;
  started_at: number;
  ended_at: number;
  duration: number;
  created_at: number;
}

export interface DbPlayerProfile {
  player_id: string;
  name: string;
  avatar_color: string;
  play_count: number;
  total_win: number;
  created_at: number;
  updated_at: number;
}
