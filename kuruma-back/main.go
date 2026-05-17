package main

import (
	"log"

	"kuruma-back/internal/config"
	"kuruma-back/internal/database"
	"kuruma-back/internal/handler"
	"kuruma-back/internal/repository"
	"kuruma-back/internal/server"
	"kuruma-back/internal/service"
)

func main() {
	cfg := config.Load()

	db, err := database.Open(cfg)
	if err != nil {
		log.Fatalf("connect database: %v", err)
	}
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("migrate database: %v", err)
	}

	userRepository := repository.NewUserRepository(db)
	authService := service.NewAuthService(userRepository, cfg.JWTSecret, cfg.JWTExpiresHours)
	authHandler := handler.NewAuthHandler(authService)
	sessionService := service.NewSessionService()
	sessionHandler := handler.NewSessionHandler(sessionService)
	realtimeHandler := handler.NewRealtimeHandler(sessionService, cfg.JWTSecret)
	sessionHandler.SetBroadcaster(realtimeHandler)

	router := server.NewRouter(cfg, authHandler, sessionHandler, realtimeHandler)
	if err := router.Run(cfg.HTTPAddress()); err != nil {
		log.Fatalf("start server: %v", err)
	}
}
