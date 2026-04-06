package ws

import (
	"card-account/internal/models"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for dev
	},
}

type Client struct {
	Conn     *websocket.Conn
	PlayerID string
	RoomID   string
	Send     chan []byte
}

type Hub struct {
	rooms      map[string]map[string]*Client // roomID -> playerID -> Client
	register   chan *Client
	unregister chan *Client
	broadcast  chan *BroadcastMsg
	mu         sync.RWMutex
}

type BroadcastMsg struct {
	RoomID  string
	Message []byte
	Exclude string // playerID to exclude
}

func NewHub() *Hub {
	return &Hub{
		rooms:      make(map[string]map[string]*Client),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		broadcast:  make(chan *BroadcastMsg, 100),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.rooms[client.RoomID]; !ok {
				h.rooms[client.RoomID] = make(map[string]*Client)
			}
			h.rooms[client.RoomID][client.PlayerID] = client
			h.mu.Unlock()
			log.Printf("[WS] Client registered: player=%s room=%s", client.PlayerID, client.RoomID)

		case client := <-h.unregister:
			h.mu.Lock()
			if room, ok := h.rooms[client.RoomID]; ok {
				if _, ok := room[client.PlayerID]; ok {
					delete(room, client.PlayerID)
					close(client.Send)
					if len(room) == 0 {
						delete(h.rooms, client.RoomID)
					}
				}
			}
			h.mu.Unlock()
			log.Printf("[WS] Client unregistered: player=%s room=%s", client.PlayerID, client.RoomID)

		case msg := <-h.broadcast:
			h.mu.RLock()
			if room, ok := h.rooms[msg.RoomID]; ok {
				for pid, client := range room {
					if pid != msg.Exclude {
						select {
						case client.Send <- msg.Message:
						default:
							close(client.Send)
							delete(room, pid)
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastToRoom sends a message to all clients in a room
func (h *Hub) BroadcastToRoom(roomID string, msgType string, payload interface{}) {
	msg := models.WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[WS] Marshal error: %v", err)
		return
	}
	h.broadcast <- &BroadcastMsg{
		RoomID:  roomID,
		Message: data,
	}
}

// BroadcastToRoomExclude sends to all except one player
func (h *Hub) BroadcastToRoomExclude(roomID string, msgType string, payload interface{}, excludePlayerID string) {
	msg := models.WSMessage{
		Type:    msgType,
		Payload: payload,
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[WS] Marshal error: %v", err)
		return
	}
	h.broadcast <- &BroadcastMsg{
		RoomID:  roomID,
		Message: data,
		Exclude: excludePlayerID,
	}
}

// GetRoomClients returns the number of clients in a room
func (h *Hub) GetRoomClients(roomID string) int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	if room, ok := h.rooms[roomID]; ok {
		return len(room)
	}
	return 0
}

func (h *Hub) HandleWS(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WS] Upgrade error: %v", err)
		return
	}

	client := &Client{
		Conn:   conn,
		Send:   make(chan []byte, 256),
		RoomID: r.URL.Query().Get("roomId"),
		PlayerID: r.URL.Query().Get("playerId"),
	}

	// Read auth info from first message
	conn.SetReadDeadline(time.Now().Add(10 * time.Second))
	_, msg, err := conn.ReadMessage()
	if err != nil {
		log.Printf("[WS] Auth read error: %v", err)
		conn.Close()
		return
	}

	var authMsg map[string]string
	if err := json.Unmarshal(msg, &authMsg); err != nil {
		log.Printf("[WS] Auth unmarshal error: %v", err)
		conn.Close()
		return
	}

	if authMsg["type"] == "auth" {
		client.PlayerID = authMsg["playerId"]
		client.RoomID = authMsg["roomId"]
	} else {
		log.Printf("[WS] First message not auth")
		conn.Close()
		return
	}

	conn.SetReadDeadline(time.Time{}) // reset

	h.register <- client

	go client.writePump()
	go client.readPump(h)
}

func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.Conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *Client) readPump(h *Hub) {
	defer func() {
		h.unregister <- c
		c.Conn.Close()
	}()

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
