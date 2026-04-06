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

export type GameType = 'mahjong' | 'poker' | 'guandan' | 'custom';
export type RoomStatus = 'active' | 'settled';

export interface Room {
  roomId: string;
  name: string;
  gameType: GameType;
  initialScore: number;
  unitAmount: number;
  teaFee: number;
  players: Player[];
  rounds: Round[];
  status: RoomStatus;
  createdAt: number;
  /** 实时待结算转账（每次记牌后更新，结算后清空） */
  pendingSettlements?: SettlementItem[];
}

export interface GameRecord {
  recordId: string;
  roomSnapshot: Omit<Room, 'rounds' | 'status'>;
  rounds: Round[];
  settlements: SettlementItem[];
  finalScores: { playerId: string; score: number }[];
  startedAt: number;
  endedAt: number;
}

export interface Settings {
  fontSize: 'normal' | 'large' | 'xlarge';
  highContrast: boolean;
  defaultGameType: GameType;
  defaultUnitAmount: number;
}
