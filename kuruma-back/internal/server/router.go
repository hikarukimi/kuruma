package server

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"

	"kuruma-back/internal/config"
	"kuruma-back/internal/handler"
)

func NewRouter(cfg config.Config, authHandler *handler.AuthHandler) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery(), corsMiddleware())

	api := router.Group("/api/v1")
	api.POST("/auth/register", authHandler.Register)
	api.POST("/auth/login", authHandler.Login)

	return router
}

func corsMiddleware() gin.HandlerFunc {
	allowedOrigins := map[string]struct{}{
		"http://localhost:5173":  {},
		"http://127.0.0.1:5173":  {},
		"http://localhost:8081":  {},
		"http://127.0.0.1:8081":  {},
		"http://localhost:19006": {},
		"http://127.0.0.1:19006": {},
	}

	return func(c *gin.Context) {
		origin := c.GetHeader("Origin")
		if _, ok := allowedOrigins[origin]; ok || strings.HasPrefix(origin, "exp://") {
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
