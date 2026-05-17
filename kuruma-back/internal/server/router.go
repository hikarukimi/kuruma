package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"kuruma-back/internal/config"
	"kuruma-back/internal/handler"
)

func NewRouter(cfg config.Config, authHandler *handler.AuthHandler, sessionHandler *handler.SessionHandler, realtimeHandler *handler.RealtimeHandler) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), corsMiddleware())

	api := router.Group("/api/v1")
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)

	protected := api.Group("")
	protected.Use(authMiddleware(cfg.JWTSecret))
	protected.POST("/sessions", sessionHandler.Create)
	protected.GET("/sessions", sessionHandler.List)
	protected.GET("/sessions/:id", sessionHandler.Get)
	protected.POST("/sessions/:id/recording/start", sessionHandler.StartRecording)
	protected.POST("/sessions/:id/recording/stop", sessionHandler.StopRecording)
	protected.POST("/sessions/:id/end", sessionHandler.EndCall)
	api.GET("/ws/global", realtimeHandler.ConnectGlobal)
	api.GET("/ws", realtimeHandler.Connect)

	return router
}

func corsMiddleware() gin.HandlerFunc {
	allowedOriginPrefixes := []string{
		"http://localhost:",
		"http://127.0.0.1:",
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		isAllowed := strings.HasPrefix(origin, "exp://")
		if !isAllowed {
			for _, prefix := range allowedOriginPrefixes {
				if strings.HasPrefix(origin, prefix) {
					isAllowed = true
					break
				}
			}
		}
		if isAllowed {
			c.Header("Access-Control-Allow-Origin", origin)
			c.Header("Vary", "Origin")
			c.Header("Access-Control-Allow-Credentials", "true")
			c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
			c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}

		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}
