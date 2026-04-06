package models

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dataDir string) error {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return fmt.Errorf("create data dir: %w", err)
	}

	dbPath := filepath.Join(dataDir, "card-account.db")
	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on&_journal_mode=WAL")
	if err != nil {
		return fmt.Errorf("open db: %w", err)
	}

	DB.SetMaxOpenConns(1)

	if err = DB.Ping(); err != nil {
		return fmt.Errorf("ping db: %w", err)
	}

	if err = runMigrations(); err != nil {
		return fmt.Errorf("migrations: %w", err)
	}

	return nil
}

func runMigrations() error {
	migrations := []string{
		`CREATE TABLE IF NOT EXISTS player_profiles (
			player_id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			avatar_color TEXT NOT NULL,
			play_count INTEGER DEFAULT 0,
			total_win INTEGER DEFAULT 0,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS rooms (
			room_id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			game_type TEXT NOT NULL,
			initial_score INTEGER DEFAULT 1000,
			unit_amount REAL DEFAULT 1.0,
			creator_id TEXT NOT NULL,
			status TEXT DEFAULT 'in_progress',
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS players (
			player_id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL,
			name TEXT NOT NULL,
			avatar_color TEXT NOT NULL,
			current_score INTEGER DEFAULT 1000,
			is_active INTEGER DEFAULT 1,
			joined_at INTEGER NOT NULL,
			FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS rounds (
			round_id TEXT PRIMARY KEY,
			room_id TEXT NOT NULL,
			round_number INTEGER NOT NULL,
			winners TEXT NOT NULL,
			losers TEXT NOT NULL,
			amount REAL NOT NULL,
			settled_items TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS settlements (
			settlement_id TEXT PRIMARY KEY,
			room_id TEXT UNIQUE NOT NULL,
			final_scores TEXT NOT NULL,
			settlements TEXT NOT NULL,
			started_at INTEGER NOT NULL,
			ended_at INTEGER NOT NULL,
			duration INTEGER NOT NULL,
			created_at INTEGER NOT NULL,
			FOREIGN KEY (room_id) REFERENCES rooms(room_id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS game_records (
			record_id TEXT PRIMARY KEY,
			room_snapshot TEXT NOT NULL,
			final_scores TEXT NOT NULL,
			total_rounds INTEGER NOT NULL,
			settlements TEXT NOT NULL,
			started_at INTEGER NOT NULL,
			ended_at INTEGER NOT NULL,
			duration INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_players_room ON players(room_id)`,
		`CREATE INDEX IF NOT EXISTS idx_rounds_room ON rounds(room_id)`,
		`CREATE INDEX IF NOT EXISTS idx_game_records_started ON game_records(started_at DESC)`,
	}

	for _, m := range migrations {
		if _, err := DB.Exec(m); err != nil {
			return fmt.Errorf("migration failed: %w\nsql: %s", err, m)
		}
	}
	return nil
}

func CloseDB() {
	if DB != nil {
		DB.Close()
	}
}

// Room DB operations

func DBGetRoom(roomID string) (*Room, error) {
	var r Room
	var createdAt, updatedAt int64
	err := DB.QueryRow(
		`SELECT room_id, name, game_type, initial_score, unit_amount, creator_id, status, created_at, updated_at
		 FROM rooms WHERE room_id = ?`, roomID,
	).Scan(&r.RoomID, &r.Name, &r.GameType, &r.InitialScore, &r.UnitAmount, &r.CreatorID, &r.Status, &createdAt, &updatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.CreatedAt = time.Unix(createdAt, 0)
	r.UpdatedAt = time.Unix(updatedAt, 0)

	players, err := DBGetPlayersByRoom(roomID)
	if err != nil {
		return nil, err
	}
	r.Players = players

	rounds, err := DBGetRoundsByRoom(roomID)
	if err != nil {
		return nil, err
	}
	r.Rounds = rounds

	return &r, nil
}

func DBListActiveRooms() ([]Room, error) {
	rows, err := DB.Query(
		`SELECT room_id, name, game_type, initial_score, unit_amount, creator_id, status, created_at, updated_at
		 FROM rooms WHERE status = 'in_progress' ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rooms []Room
	for rows.Next() {
		var r Room
		var createdAt, updatedAt int64
		if err := rows.Scan(&r.RoomID, &r.Name, &r.GameType, &r.InitialScore, &r.UnitAmount, &r.CreatorID, &r.Status, &createdAt, &updatedAt); err != nil {
			return nil, err
		}
		r.CreatedAt = time.Unix(createdAt, 0)
		r.UpdatedAt = time.Unix(updatedAt, 0)
		rooms = append(rooms, r)
	}
	return rooms, nil
}

func DBCreateRoom(room *Room) error {
	_, err := DB.Exec(
		`INSERT INTO rooms (room_id, name, game_type, initial_score, unit_amount, creator_id, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		room.RoomID, room.Name, room.GameType, room.InitialScore, room.UnitAmount,
		room.CreatorID, room.Status, room.CreatedAt.Unix(), room.UpdatedAt.Unix(),
	)
	return err
}

func DBUpdateRoomStatus(roomID string, status RoomStatus) error {
	_, err := DB.Exec(`UPDATE rooms SET status = ?, updated_at = ? WHERE room_id = ?`,
		status, time.Now().Unix(), roomID)
	return err
}

func DBDeleteRoom(roomID string) error {
	_, err := DB.Exec(`DELETE FROM rooms WHERE room_id = ?`, roomID)
	return err
}

// Player DB operations

func DBGetPlayersByRoom(roomID string) ([]Player, error) {
	rows, err := DB.Query(
		`SELECT player_id, room_id, name, avatar_color, current_score, is_active, joined_at
		 FROM players WHERE room_id = ? AND is_active = 1`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var players []Player
	for rows.Next() {
		var p Player
		var joinedAt int64
		if err := rows.Scan(&p.PlayerID, &p.RoomID, &p.Name, &p.AvatarColor, &p.CurrentScore, &joinedAt); err != nil {
			return nil, err
		}
		p.IsActive = true
		p.JoinedAt = time.Unix(joinedAt, 0)
		players = append(players, p)
	}
	return players, nil
}

func DBGetPlayer(playerID string) (*Player, error) {
	var p Player
	var joinedAt int64
	var isActive int
	err := DB.QueryRow(
		`SELECT player_id, room_id, name, avatar_color, current_score, is_active, joined_at
		 FROM players WHERE player_id = ?`, playerID,
	).Scan(&p.PlayerID, &p.RoomID, &p.Name, &p.AvatarColor, &p.CurrentScore, &isActive, &joinedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p.IsActive = isActive == 1
	p.JoinedAt = time.Unix(joinedAt, 0)
	return &p, nil
}

func DBCreatePlayer(p *Player) error {
	_, err := DB.Exec(
		`INSERT INTO players (player_id, room_id, name, avatar_color, current_score, is_active, joined_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		p.PlayerID, p.RoomID, p.Name, p.AvatarColor, p.CurrentScore, 1, p.JoinedAt.Unix(),
	)
	return err
}

func DBUpdatePlayerScore(playerID string, score int) error {
	_, err := DB.Exec(`UPDATE players SET current_score = ? WHERE player_id = ?`, score, playerID)
	return err
}

func DBDeactivatePlayer(playerID string) error {
	_, err := DB.Exec(`UPDATE players SET is_active = 0 WHERE player_id = ?`, playerID)
	return err
}

// Round DB operations

func DBGetRoundsByRoom(roomID string) ([]Round, error) {
	rows, err := DB.Query(
		`SELECT round_id, room_id, round_number, winners, losers, amount, settled_items, created_at
		 FROM rounds WHERE room_id = ? ORDER BY round_number ASC`, roomID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rounds []Round
	for rows.Next() {
		var r Round
		var winners, losers, settledItems string
		var createdAt int64
		if err := rows.Scan(&r.RoundID, &r.RoomID, &r.RoundNumber, &winners, &losers, &r.Amount, &settledItems, &createdAt); err != nil {
			return nil, err
		}
		r.CreatedAt = time.Unix(createdAt, 0)
		// Parse JSON manually (winners/losers are comma-separated for simplicity)
		r.Winners = splitString(winners)
		r.Losers = splitString(losers)
		// SettledItems would need JSON parsing
		_ = settledItems
		rounds = append(rounds, r)
	}
	return rounds, nil
}

func DBCreateRound(r *Round) error {
	winners := joinStrings(r.Winners)
	losers := joinStrings(r.Losers)
	_, err := DB.Exec(
		`INSERT INTO rounds (round_id, room_id, round_number, winners, losers, amount, settled_items, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		r.RoundID, r.RoomID, r.RoundNumber, winners, losers, r.Amount, "[]", r.CreatedAt.Unix(),
	)
	return err
}

func DBDeleteLastRound(roomID string) error {
	_, err := DB.Exec(
		`DELETE FROM rounds WHERE rowid = (SELECT MAX(rowid) FROM rounds WHERE room_id = ?)`,
		roomID,
	)
	return err
}

// Settlement DB operations

func DBCreateSettlement(s *Settlement) error {
	_, err := DB.Exec(
		`INSERT INTO settlements (settlement_id, room_id, final_scores, settlements, started_at, ended_at, duration, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		s.SettlementID, s.RoomID, "[]", "[]", s.StartedAt.Unix(), s.EndedAt.Unix(), s.Duration, s.CreatedAt.Unix(),
	)
	return err
}

// GameRecord DB operations

func DBCreateGameRecord(r *GameRecord) error {
	_, err := DB.Exec(
		`INSERT INTO game_records (record_id, room_snapshot, final_scores, total_rounds, settlements, started_at, ended_at, duration, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.RecordID, "{}", "[]", r.TotalRounds, "[]", r.StartedAt.Unix(), r.EndedAt.Unix(), r.Duration, r.CreatedAt.Unix(),
	)
	return err
}

func DBListGameRecords(limit, offset int) ([]GameRecord, error) {
	rows, err := DB.Query(
		`SELECT record_id, room_snapshot, final_scores, total_rounds, settlements, started_at, ended_at, duration, created_at
		 FROM game_records ORDER BY started_at DESC LIMIT ? OFFSET ?`, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []GameRecord
	for rows.Next() {
		var r GameRecord
		var roomSnapshot, finalScores, settlements string
		var startedAt, endedAt, createdAt int64
		var duration int64
		if err := rows.Scan(&r.RecordID, &roomSnapshot, &finalScores, &r.TotalRounds, &settlements, &startedAt, &endedAt, &duration, &createdAt); err != nil {
			return nil, err
		}
		r.StartedAt = time.Unix(startedAt, 0)
		r.EndedAt = time.Unix(endedAt, 0)
		r.Duration = duration
		r.CreatedAt = time.Unix(createdAt, 0)
		records = append(records, r)
	}
	return records, nil
}

func DBGetGameRecord(recordID string) (*GameRecord, error) {
	var r GameRecord
	var roomSnapshot, finalScores, settlements string
	var startedAt, endedAt, createdAt int64
	var duration int64
	err := DB.QueryRow(
		`SELECT record_id, room_snapshot, final_scores, total_rounds, settlements, started_at, ended_at, duration, created_at
		 FROM game_records WHERE record_id = ?`, recordID,
	).Scan(&r.RecordID, &roomSnapshot, &finalScores, &r.TotalRounds, &settlements, &startedAt, &endedAt, &duration, &createdAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	r.StartedAt = time.Unix(startedAt, 0)
	r.EndedAt = time.Unix(endedAt, 0)
	r.Duration = duration
	r.CreatedAt = time.Unix(createdAt, 0)
	return &r, nil
}

// Helper functions

func splitString(s string) []string {
	if s == "" {
		return nil
	}
	result := make([]string, 0)
	start := 0
	for i := 0; i <= len(s); i++ {
		if i == len(s) || s[i] == ',' {
			if start < i {
				result = append(result, s[start:i])
			}
			start = i + 1
		}
	}
	return result
}

func joinStrings(arr []string) string {
	if len(arr) == 0 {
		return ""
	}
	result := arr[0]
	for i := 1; i < len(arr); i++ {
		result += "," + arr[i]
	}
	return result
}
