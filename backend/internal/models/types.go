package models

import (
	"time"
)

type GameType string

const (
	GameTypeMahjong  GameType = "mahjong"
	GameTypeDoudizhu GameType = "doudizhu"
	GameTypeGuidan   GameType = "guidan"
	GameTypeCustom   GameType = "custom"
)

type RoomStatus string

const (
	RoomStatusInProgress RoomStatus = "in_progress"
	RoomStatusSettled    RoomStatus = "settled"
)

type Player struct {
	PlayerID      string    `json:"playerId"`
	RoomID        string    `json:"roomId,omitempty"`
	Name          string    `json:"name"`
	AvatarColor   string    `json:"avatarColor"`
	CurrentScore  int       `json:"currentScore"`
	IsActive      bool      `json:"isActive"`
	JoinedAt      time.Time `json:"joinedAt"`
}

type Room struct {
	RoomID        string     `json:"roomId"`
	Name          string     `json:"name"`
	GameType      GameType   `json:"gameType"`
	InitialScore  int        `json:"initialScore"`
	UnitAmount    float64    `json:"unitAmount"`
	CreatorID     string     `json:"creatorId"`
	Status        RoomStatus `json:"status"`
	Players       []Player   `json:"players"`
	Rounds        []Round    `json:"rounds"`
	CreatedAt     time.Time  `json:"createdAt"`
	UpdatedAt     time.Time  `json:"updatedAt"`
}

type Round struct {
	RoundID      string           `json:"roundId"`
	RoomID       string           `json:"roomId"`
	RoundNumber  int              `json:"roundNumber"`
	Winners      []string         `json:"winners"`
	Losers       []string         `json:"losers"`
	Amount       float64          `json:"amount"`
	SettledItems []SettlementItem `json:"settledItems"`
	CreatedAt    time.Time        `json:"createdAt"`
}

type SettlementItem struct {
	From     string  `json:"from"`
	To       string  `json:"to"`
	Amount   float64 `json:"amount"`
}

type Settlement struct {
	SettlementID string           `json:"settlementId"`
	RoomID       string           `json:"roomId"`
	FinalScores  []PlayerScore    `json:"finalScores"`
	Settlements  []SettlementItem `json:"settlements"`
	StartedAt    time.Time        `json:"startedAt"`
	EndedAt      time.Time        `json:"endedAt"`
	Duration     int64            `json:"duration"`
	CreatedAt    time.Time        `json:"createdAt"`
}

type GameRecord struct {
	RecordID    string           `json:"recordId"`
	RoomSnapshot RoomSnapshot    `json:"roomSnapshot"`
	FinalScores []PlayerScore    `json:"finalScores"`
	TotalRounds int              `json:"totalRounds"`
	Settlements []SettlementItem `json:"settlements"`
	StartedAt   time.Time        `json:"startedAt"`
	EndedAt     time.Time        `json:"endedAt"`
	Duration    int64            `json:"duration"`
	CreatedAt   time.Time        `json:"createdAt"`
}

type RoomSnapshot struct {
	RoomID       string    `json:"roomId"`
	Name         string    `json:"name"`
	GameType     GameType  `json:"gameType"`
	InitialScore int       `json:"initialScore"`
	UnitAmount   float64   `json:"unitAmount"`
	CreatorID    string    `json:"creatorId"`
	CreatedAt    time.Time `json:"createdAt"`
}

type PlayerScore struct {
	PlayerID    string `json:"playerId"`
	Name        string `json:"name"`
	Score       int    `json:"score"`
	AvatarColor string `json:"avatarColor"`
}

type PlayerProfile struct {
	PlayerID    string    `json:"playerId"`
	Name        string    `json:"name"`
	AvatarColor string    `json:"avatarColor"`
	PlayCount   int       `json:"playCount"`
	TotalWin    int       `json:"totalWin"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

// Request/Response types

type CreateRoomRequest struct {
	Name         string   `json:"name" binding:"required"`
	GameType     GameType `json:"gameType" binding:"required"`
	InitialScore int      `json:"initialScore"`
	UnitAmount   float64  `json:"unitAmount"`
	CreatorID    string   `json:"creatorId" binding:"required"`
	CreatorName  string   `json:"creatorName" binding:"required"`
	CreatorColor string   `json:"creatorColor"`
}

type JoinRoomRequest struct {
	PlayerID string `json:"playerId"`
	Name     string `json:"name" binding:"required"`
	Color    string `json:"color"`
}

type AddRoundRequest struct {
	WinnerIDs []string  `json:"winnerIds" binding:"required,min=1"`
	LoserIDs  []string  `json:"loserIds" binding:"required,min=1"`
	Amount    float64   `json:"amount" binding:"required,gt=0"`
}

type WSMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}
