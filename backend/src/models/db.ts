import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/card-account.db');

export const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize schema
db.exec(`
  CREATE TABLE IF NOT EXISTS player_profiles (
    player_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    play_count INTEGER DEFAULT 0,
    total_win INTEGER DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS rooms (
    room_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    game_type TEXT NOT NULL,
    initial_score INTEGER DEFAULT 1000,
    unit_amount REAL DEFAULT 1.0,
    creator_id TEXT NOT NULL,
    status TEXT DEFAULT 'in_progress',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    current_score INTEGER DEFAULT 1000,
    is_active INTEGER DEFAULT 1,
    joined_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS rounds (
    round_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    winners TEXT NOT NULL,
    losers TEXT NOT NULL,
    amount REAL NOT NULL,
    settled_items TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS settlements (
    settlement_id TEXT PRIMARY KEY,
    room_id TEXT UNIQUE NOT NULL,
    final_scores TEXT NOT NULL,
    settlements TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS game_records (
    record_id TEXT PRIMARY KEY,
    room_snapshot TEXT NOT NULL,
    final_scores TEXT NOT NULL,
    total_rounds INTEGER NOT NULL,
    settlements TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL,
    duration INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id);
  CREATE INDEX IF NOT EXISTS idx_rounds_room ON rounds(room_id);
  CREATE INDEX IF NOT EXISTS idx_game_records_started ON game_records(started_at DESC);
`);

export default db;
