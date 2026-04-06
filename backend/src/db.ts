import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '../../data/db.sqlite');

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    room_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    game_type TEXT NOT NULL,
    initial_score INTEGER NOT NULL DEFAULT 1000,
    unit_amount REAL NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS players (
    player_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    name TEXT NOT NULL,
    avatar_color TEXT NOT NULL,
    current_score INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
  );

  CREATE TABLE IF NOT EXISTS rounds (
    round_id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    round_number INTEGER NOT NULL,
    winners TEXT NOT NULL,
    losers TEXT NOT NULL,
    amount REAL NOT NULL,
    score_changes TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
  );

  CREATE TABLE IF NOT EXISTS game_records (
    record_id TEXT PRIMARY KEY,
    room_snapshot TEXT NOT NULL,
    rounds TEXT NOT NULL,
    settlements TEXT NOT NULL,
    final_scores TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER NOT NULL
  );
`);

// Enable foreign keys
db.pragma('foreign_keys = ON');

export default db;
