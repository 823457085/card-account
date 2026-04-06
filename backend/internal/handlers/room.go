package handlers

import (
	"card-account/internal/models"
	"card-account/internal/services"
	"card-account/internal/ws"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/skip2/go-qrcode"
)

type RoomHandler struct {
	hub            *ws.Hub
	svc            *SettlementService
}

func NewRoomHandler(hub *ws.Hub) *RoomHandler {
	return &RoomHandler{
		hub: hub,
		svc: NewSettlementService(),
	}
}

// CreateRoom creates a new game room
func (h *RoomHandler) CreateRoom(c *gin.Context) {
	var req models.CreateRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Generate unique room code
	roomCode, err := services.GenerateRoomCode()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate room code"})
		return
	}

	initialScore := req.InitialScore
	if initialScore == 0 {
		initialScore = 1000
	}
	unitAmount := req.UnitAmount
	if unitAmount == 0 {
		unitAmount = 1.0
	}

	creatorColor := req.CreatorColor
	if creatorColor == "" {
		creatorColor = services.DefaultAvatarColor(req.CreatorName)
	}

	teaFee := req.TeaFee
	if teaFee < 0 {
		teaFee = 0
	}

	now := time.Now()
	room := &models.Room{
		RoomID:       roomCode,
		Name:         req.Name,
		GameType:     req.GameType,
		InitialScore: initialScore,
		UnitAmount:   unitAmount,
		TeaFee:       teaFee,
		CreatorID:    req.CreatorID,
		Status:       models.RoomStatusInProgress,
		Players:     []models.Player{},
		Rounds:       []models.Round{},
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	if err := models.DBCreateRoom(room); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create room: " + err.Error()})
		return
	}

	// Create creator as first player
	player := models.Player{
		PlayerID:     req.CreatorID,
		RoomID:       roomCode,
		Name:         req.CreatorName,
		AvatarColor:  creatorColor,
		CurrentScore: initialScore,
		IsActive:     true,
		JoinedAt:     now,
	}
	if err := models.DBCreatePlayer(&player); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create player: " + err.Error()})
		return
	}
	room.Players = []models.Player{player}

	c.JSON(http.StatusCreated, room)
}

// GetRoom returns room details
func (h *RoomHandler) GetRoom(c *gin.Context) {
	roomID := c.Param("roomId")

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	c.JSON(http.StatusOK, room)
}

// GetRoomQRCode generates a QR code PNG for joining a room
func (h *RoomHandler) GetRoomQRCode(c *gin.Context) {
	roomID := c.Param("roomId")

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	joinURL := fmt.Sprintf("http://localhost:3000/join?code=%s", roomID)
	png, err := qrcode.Encode(joinURL, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate QR code"})
		return
	}

	c.Header("Content-Type", "image/png")
	c.Header("Content-Disposition", fmt.Sprintf("inline; filename=\"room-%s-qr.png\"", roomID))
	c.Data(http.StatusOK, "image/png", png)
}

// ListRooms returns all active rooms
func (h *RoomHandler) ListRooms(c *gin.Context) {
	rooms, err := models.DBListActiveRooms()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"rooms": rooms})
}

// JoinRoom adds a player to a room
func (h *RoomHandler) JoinRoom(c *gin.Context) {
	roomID := c.Param("roomId")
	var req models.JoinRoomRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}
	if room.Status != models.RoomStatusInProgress {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room is not in progress"})
		return
	}
	if len(room.Players) >= 10 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "room is full"})
		return
	}

	// Check if player already in room
	for _, p := range room.Players {
		if p.PlayerID == req.PlayerID {
			c.JSON(http.StatusOK, room)
			return
		}
	}

	color := req.Color
	if color == "" {
		color = services.DefaultAvatarColor(req.Name)
	}

	now := time.Now()
	player := models.Player{
		PlayerID:     req.PlayerID,
		RoomID:       roomID,
		Name:         req.Name,
		AvatarColor:  color,
		CurrentScore: room.InitialScore,
		IsActive:     true,
		JoinedAt:     now,
	}
	if err := models.DBCreatePlayer(&player); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to join room: " + err.Error()})
		return
	}

	room.Players = append(room.Players, player)

	// Broadcast player joined
	h.hub.BroadcastToRoom(roomID, "player:joined", player)

	c.JSON(http.StatusOK, room)
}

// LeaveRoom removes a player from a room
func (h *RoomHandler) LeaveRoom(c *gin.Context) {
	roomID := c.Param("roomId")
	playerID := c.Query("playerId")
	if playerID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "playerId required"})
		return
	}

	if err := models.DBDeactivatePlayer(playerID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	room, _ := models.DBGetRoom(roomID)
	if room != nil {
		h.hub.BroadcastToRoom(roomID, "player:left", gin.H{"playerId": playerID})
	}

	c.JSON(http.StatusOK, gin.H{"message": "left room"})
}

// DeleteRoom deletes a room
func (h *RoomHandler) DeleteRoom(c *gin.Context) {
	roomID := c.Param("roomId")
	creatorID := c.Query("creatorId")

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}
	if room.CreatorID != creatorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only creator can delete room"})
		return
	}

	if err := models.DBDeleteRoom(roomID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	services.ReleaseRoomCode(roomID)
	h.hub.BroadcastToRoom(roomID, "room:deleted", gin.H{"roomId": roomID})

	c.JSON(http.StatusOK, gin.H{"message": "room deleted"})
}

// UpdateTeaFee updates the tea fee for a room (creator only)
func (h *RoomHandler) UpdateTeaFee(c *gin.Context) {
	roomID := c.Param("roomId")

	var body struct {
		TeaFee    int    `json:"teaFee"`
		CreatorID string `json:"creatorId" binding:"required"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}
	if room.CreatorID != body.CreatorID {
		c.JSON(http.StatusForbidden, gin.H{"error": "only creator can change tea fee"})
		return
	}

	if body.TeaFee < 0 {
		body.TeaFee = 0
	}

	if err := models.DBUpdateRoomTeaFee(roomID, body.TeaFee); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	room.TeaFee = body.TeaFee
	h.hub.BroadcastToRoom(roomID, "room:update", room)

	c.JSON(http.StatusOK, gin.H{"teaFee": body.TeaFee})
}

// SettleRoom settles a room and generates game record
func (h *RoomHandler) SettleRoom(c *gin.Context) {
	roomID := c.Param("roomId")

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	// Calculate final settlements
	transfers := h.svc.CalculateMinimumTransfers(room.Players, room.InitialScore)

	// Build final scores
	var finalScores []models.PlayerScore
	for _, p := range room.Players {
		finalScores = append(finalScores, models.PlayerScore{
			PlayerID:    p.PlayerID,
			Name:        p.Name,
			Score:       p.CurrentScore,
			AvatarColor: p.AvatarColor,
		})
	}

	// Create game record
	recordID := uuid.New().String()
	record := &models.GameRecord{
		RecordID: recordID,
		RoomSnapshot: models.RoomSnapshot{
			RoomID:       room.RoomID,
			Name:         room.Name,
			GameType:     room.GameType,
			InitialScore: room.InitialScore,
			UnitAmount:   room.UnitAmount,
			TeaFee:       room.TeaFee,
			CreatorID:    room.CreatorID,
			CreatedAt:    room.CreatedAt,
		},
		FinalScores: finalScores,
		TotalRounds: len(room.Rounds),
		Settlements: transfers,
		StartedAt:   room.CreatedAt,
		EndedAt:     time.Now(),
		Duration:    time.Since(room.CreatedAt).Milliseconds(),
		CreatedAt:   time.Now(),
	}

	if err := models.DBCreateGameRecord(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save record: " + err.Error()})
		return
	}

	// Update room status
	if err := models.DBUpdateRoomStatus(roomID, models.RoomStatusSettled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	services.ReleaseRoomCode(roomID)

	// Broadcast settlement
	h.hub.BroadcastToRoom(roomID, "room:settled", gin.H{
		"roomId":     roomID,
		"settlements": transfers,
		"recordId":   recordID,
	})

	c.JSON(http.StatusOK, gin.H{
		"roomId":     roomID,
		"recordId":   recordID,
		"settlements": transfers,
		"finalScores": finalScores,
	})
}

// AddRound records a round in the room
func (h *RoomHandler) AddRound(c *gin.Context) {
	roomID := c.Param("roomId")
	var req models.AddRoundRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}

	// Validate all winner and loser IDs are in the room
	playerIDs := make(map[string]bool)
	for _, p := range room.Players {
		playerIDs[p.PlayerID] = true
	}
	for _, wid := range req.WinnerIDs {
		if !playerIDs[wid] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "winner not in room"})
			return
		}
	}
	for _, lid := range req.LoserIDs {
		if !playerIDs[lid] {
			c.JSON(http.StatusBadRequest, gin.H{"error": "loser not in room"})
			return
		}
	}

	// Calculate settled items
	settledItems := h.svc.CalculateRoundSettlement(req.WinnerIDs, req.LoserIDs, req.Amount)

	// Apply score changes
	for _, item := range settledItems {
		for i := range room.Players {
			if room.Players[i].PlayerID == item.To {
				room.Players[i].CurrentScore += int(item.Amount)
			}
			if room.Players[i].PlayerID == item.From {
				room.Players[i].CurrentScore -= int(item.Amount)
			}
		}
	}

	// Deduct tea fee from each active player per round
	if room.TeaFee > 0 {
		for i := range room.Players {
			room.Players[i].CurrentScore -= room.TeaFee
		}
	}

	// Update player scores in DB
	for _, p := range room.Players {
		if err := models.DBUpdatePlayerScore(p.PlayerID, p.CurrentScore); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Create round record
	roundNumber := len(room.Rounds) + 1
	round := models.Round{
		RoundID:      uuid.New().String(),
		RoomID:       roomID,
		RoundNumber:  roundNumber,
		Winners:      req.WinnerIDs,
		Losers:       req.LoserIDs,
		Amount:       req.Amount,
		SettledItems: settledItems,
		CreatedAt:    time.Now(),
	}

	if err := models.DBCreateRound(&round); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create round: " + err.Error()})
		return
	}

	room.Rounds = append(room.Rounds, round)

	// Broadcast round added and room update
	h.hub.BroadcastToRoom(roomID, "round:added", round)
	h.hub.BroadcastToRoom(roomID, "room:update", room)

	c.JSON(http.StatusCreated, room)
}

// UndoLastRound removes the last round
func (h *RoomHandler) UndoLastRound(c *gin.Context) {
	roomID := c.Param("roomId")

	room, err := models.DBGetRoom(roomID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if room == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "room not found"})
		return
	}
	if len(room.Rounds) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no rounds to undo"})
		return
	}

	lastRound := room.Rounds[len(room.Rounds)-1]

	// Reverse score changes
	for _, item := range lastRound.SettledItems {
		for i := range room.Players {
			if room.Players[i].PlayerID == item.To {
				room.Players[i].CurrentScore -= int(item.Amount)
			}
			if room.Players[i].PlayerID == item.From {
				room.Players[i].CurrentScore += int(item.Amount)
			}
		}
	}

	// Update player scores in DB
	for _, p := range room.Players {
		if err := models.DBUpdatePlayerScore(p.PlayerID, p.CurrentScore); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
	}

	// Delete last round
	if err := models.DBDeleteLastRound(roomID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	room.Rounds = room.Rounds[:len(room.Rounds)-1]

	// Broadcast
	h.hub.BroadcastToRoom(roomID, "round:undone", gin.H{"roundId": lastRound.RoundID})
	h.hub.BroadcastToRoom(roomID, "room:update", room)

	c.JSON(http.StatusOK, room)
}

// SettlementService wraps the calculation logic
type SettlementService struct{}

func NewSettlementService() *SettlementService {
	return &SettlementService{}
}

func (s *SettlementService) CalculateRoundSettlement(winners, losers []string, amount float64) []models.SettlementItem {
	var items []models.SettlementItem
	winnerCount := len(winners)
	loserCount := len(losers)

	if winnerCount == 1 && loserCount == 1 {
		items = append(items, models.SettlementItem{From: losers[0], To: winners[0], Amount: amount})
	} else if winnerCount == 1 && loserCount > 1 {
		share := amount / float64(loserCount)
		for _, loser := range losers {
			items = append(items, models.SettlementItem{From: loser, To: winners[0], Amount: share})
		}
	} else if winnerCount > 1 && loserCount == 1 {
		share := amount / float64(winnerCount)
		for _, winner := range winners {
			items = append(items, models.SettlementItem{From: losers[0], To: winner, Amount: share})
		}
	} else {
		share := amount / float64(winnerCount*loserCount)
		for _, loser := range losers {
			for _, winner := range winners {
				items = append(items, models.SettlementItem{From: loser, To: winner, Amount: share})
			}
		}
	}
	return items
}

func (s *SettlementService) CalculateMinimumTransfers(players []models.Player, initialScore int) []models.SettlementItem {
	// Duplicate of services/settlement.go - keep here for handler access
	type balance struct {
		playerID string
		name    string
		net     float64
	}

	var balances []balance
	for _, p := range players {
		balances = append(balances, balance{playerID: p.PlayerID, name: p.Name, net: float64(p.CurrentScore - initialScore)})
	}

	var creditors, debtors []balance
	for _, b := range balances {
		if b.net > 0.01 {
			creditors = append(creditors, b)
		} else if b.net < -0.01 {
			debtors = append(debtors, b)
		}
	}

	// Sort descending by amount
	for i := 0; i < len(creditors)-1; i++ {
		for j := i + 1; j < len(creditors); j++ {
			if creditors[j].net > creditors[i].net {
				creditors[i], creditors[j] = creditors[j], creditors[i]
			}
		}
	}
	for i := 0; i < len(debtors)-1; i++ {
		for j := i + 1; j < len(debtors); j++ {
			if -debtors[j].net > -debtors[i].net {
				debtors[i], debtors[j] = debtors[j], debtors[i]
			}
		}
	}

	var transfers []models.SettlementItem
	i, j := 0, 0
	for i < len(creditors) && j < len(debtors) {
		credit := creditors[i].net
		debt := -debtors[j].net
		amount := credit
		if debt < credit {
			amount = debt
		}
		if amount > 0.01 {
			transfers = append(transfers, models.SettlementItem{From: debtors[j].playerID, To: creditors[i].playerID, Amount: amount})
		}
		creditors[i].net -= amount
		debtors[j].net += amount
		if creditors[i].net < 0.01 {
			i++
		}
		if debtors[j].net > -0.01 {
			j++
		}
	}
	return transfers
}

// PlayerProfile handlers

func GetProfile(c *gin.Context) {
	playerID := c.Param("playerId")
	p, err := models.DBGetPlayer(playerID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if p == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "player not found"})
		return
	}
	c.JSON(http.StatusOK, p)
}

func UpdateProfile(c *gin.Context) {
	playerID := c.Param("playerId")
	var body map[string]string
	if err := json.NewDecoder(c.Request.Body).Decode(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	// Player profile update logic would go here
	_ = playerID
	c.JSON(http.StatusOK, gin.H{"message": "profile updated"})
}

// Record handlers

func ListRecords(c *gin.Context) {
	limit := 20
	offset := 0
	records, err := models.DBListGameRecords(limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"records": records})
}

func GetRecord(c *gin.Context) {
	recordID := c.Param("recordId")
	record, err := models.DBGetGameRecord(recordID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if record == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "record not found"})
		return
	}
	c.JSON(http.StatusOK, record)
}
