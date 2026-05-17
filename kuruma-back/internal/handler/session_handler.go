package handler

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"kuruma-back/internal/service"
)

type SessionHandler struct {
	sessions    *service.SessionService
	broadcaster SessionBroadcaster
}

type createSessionRequest struct {
	DriverName        string `json:"driverName"`
	DriverPhoneMasked string `json:"driverPhoneMasked"`
	Description       string `json:"description"`
	LocationStatus    string `json:"locationStatus"`
	NetworkStatus     string `json:"networkStatus"`
	DriverOnline      *bool  `json:"driverOnline"`
	SignalingStatus   string `json:"signalingStatus"`
	RecordingStatus   string `json:"recordingStatus"`
	CallStatus        string `json:"callStatus"`
}

type SessionBroadcaster interface {
	BroadcastSession(session *service.Session)
	BroadcastSessionCreated(session *service.Session)
}

func NewSessionHandler(sessions *service.SessionService) *SessionHandler {
	return &SessionHandler{sessions: sessions}
}

func (h *SessionHandler) SetBroadcaster(broadcaster SessionBroadcaster) {
	h.broadcaster = broadcaster
}

func (h *SessionHandler) Create(c *gin.Context) {
	var req createSessionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	session, err := h.sessions.Create(c.Request.Context(), service.CreateSessionInput{
		DriverName:        req.DriverName,
		DriverPhoneMasked: req.DriverPhoneMasked,
		Description:       req.Description,
		LocationStatus:    req.LocationStatus,
		NetworkStatus:     req.NetworkStatus,
		DriverOnline:      req.DriverOnline,
		SignalingStatus:   req.SignalingStatus,
		RecordingStatus:   req.RecordingStatus,
		CallStatus:        req.CallStatus,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "create session failed"})
		return
	}

	h.broadcastCreated(session)
	c.JSON(http.StatusCreated, gin.H{"session": session})
}

func (h *SessionHandler) List(c *gin.Context) {
	sessions, err := h.sessions.List(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list sessions failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"sessions": sessions})
}

func (h *SessionHandler) Get(c *gin.Context) {
	session, err := h.sessions.Get(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) StartRecording(c *gin.Context) {
	session, err := h.sessions.StartRecording(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}

	h.broadcast(session)
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) StopRecording(c *gin.Context) {
	session, err := h.sessions.StopRecording(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}

	h.broadcast(session)
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) EndCall(c *gin.Context) {
	session, err := h.sessions.EndCall(c.Request.Context(), c.Param("id"))
	if err != nil {
		writeSessionError(c, err)
		return
	}

	h.broadcast(session)
	c.JSON(http.StatusOK, gin.H{"session": session})
}

func (h *SessionHandler) broadcast(session *service.Session) {
	if h.broadcaster != nil {
		h.broadcaster.BroadcastSession(session)
	}
}

func (h *SessionHandler) broadcastCreated(session *service.Session) {
	if h.broadcaster != nil {
		h.broadcaster.BroadcastSessionCreated(session)
	}
}

func writeSessionError(c *gin.Context, err error) {
	if errors.Is(err, service.ErrSessionNotFound) {
		c.JSON(http.StatusNotFound, gin.H{"error": "session not found"})
		return
	}

	c.JSON(http.StatusInternalServerError, gin.H{"error": "session operation failed"})
}
