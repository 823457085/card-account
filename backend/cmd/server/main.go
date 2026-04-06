package main

import (
	"card-account/internal/handlers"
	"card-account/internal/models"
	"card-account/internal/ws"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
)

func main() {
	dataDir := "data"
	if env := os.Getenv("DATA_DIR"); env != "" {
		dataDir = env
	}

	// Initialize database
	if err := models.InitDB(dataDir); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer models.CloseDB()

	// Initialize WebSocket hub
	hub := ws.NewHub()
	go hub.Run()

	// Initialize handlers
	roomHandler := handlers.NewRoomHandler(hub)

	// Setup Gin router
	gin.SetMode(gin.ReleaseMode)
	r := gin.Default()

	// CORS middleware
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	// WebSocket endpoint
	r.GET("/ws", func(c *gin.Context) {
		hub.HandleWS(c.Writer, c.Request)
	})

	// API routes
	api := r.Group("/api")
	{
		// Rooms
		api.POST("/rooms", roomHandler.CreateRoom)
		api.GET("/rooms", roomHandler.ListRooms)
		api.GET("/rooms/:roomId", roomHandler.GetRoom)
		api.GET("/rooms/:roomId/qrcode", roomHandler.GetRoomQRCode)
		api.POST("/rooms/:roomId/join", roomHandler.JoinRoom)
		api.POST("/rooms/:roomId/leave", roomHandler.LeaveRoom)
		api.DELETE("/rooms/:roomId", roomHandler.DeleteRoom)
		api.PUT("/rooms/:roomId/tea-fee", roomHandler.UpdateTeaFee)
		api.POST("/rooms/:roomId/settle", roomHandler.SettleRoom)

		// Rounds
		api.POST("/rooms/:roomId/rounds", roomHandler.AddRound)
		api.DELETE("/rooms/:roomId/rounds/last", roomHandler.UndoLastRound)

		// Records
		api.GET("/records", handlers.ListRecords)
		api.GET("/records/:recordId", handlers.GetRecord)

		// Profiles
		api.GET("/profiles/:playerId", handlers.GetProfile)
		api.PUT("/profiles/:playerId", handlers.UpdateProfile)
	}

	// Graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-quit
		log.Println("Shutting down server...")
		os.Exit(0)
	}()

	port := os.Getenv("PORT")
	if port == "" {
		port = "3000"
	}

	log.Printf("Server starting on :%s", port)
	log.Printf("WebSocket available at ws://localhost:%s/ws", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
