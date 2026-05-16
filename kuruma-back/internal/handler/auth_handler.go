package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"kuruma-back/internal/service"
)

type AuthHandler struct {
	auth *service.AuthService
}

type registerRequest struct {
	Account     string `json:"account" binding:"required"`
	Phone       string `json:"phone"`
	Password    string `json:"password" binding:"required"`
	DisplayName string `json:"displayName" binding:"required"`
}

type loginRequest struct {
	Account  string `json:"account"`
	Phone    string `json:"phone"`
	Password string `json:"password" binding:"required"`
}

func NewAuthHandler(auth *service.AuthService) *AuthHandler {
	return &AuthHandler{auth: auth}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req registerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	user, err := h.auth.Register(c.Request.Context(), service.RegisterInput{
		Account:     req.Account,
		Phone:       req.Phone,
		Password:    req.Password,
		DisplayName: req.DisplayName,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidRegisterInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid register input"})
		case errors.Is(err, service.ErrAccountAlreadyExists):
			c.JSON(http.StatusConflict, gin.H{"error": "account already exists"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "register user failed"})
		}
		return
	}

	c.JSON(http.StatusCreated, gin.H{"user": user})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req loginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	result, err := h.auth.Login(c.Request.Context(), service.LoginInput{
		Account:  req.Account,
		Phone:    req.Phone,
		Password: req.Password,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidLoginInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid login input"})
		case errors.Is(err, service.ErrInvalidCredentials):
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid account or password"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":  result.User,
		"token": result.Token,
	})
}
