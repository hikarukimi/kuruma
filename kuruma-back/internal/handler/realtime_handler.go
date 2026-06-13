package handler

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"sync"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"

	"kuruma-back/internal/auth"
	"kuruma-back/internal/repository"
	"kuruma-back/internal/service"
)

const (
	RealtimeRolePolice = "police"
	RealtimeRoleDriver = "driver"
)

type RealtimeHandler struct {
	sessions  *service.SessionService
	calls     *repository.CallRepository
	jwtSecret string
	hub       *realtimeHub
	upgrader  websocket.Upgrader
}

type realtimeMessage struct {
	Type      string      `json:"type"`
	SessionID string      `json:"sessionId,omitempty"`
	Role      string      `json:"role,omitempty"`
	Payload   interface{} `json:"payload,omitempty"`
}

type realtimeClient struct {
	conn      *websocket.Conn
	sessionID string
	role      string
	userID    uint64
	send      chan realtimeMessage
	global    bool
}

type realtimeHub struct {
	mu      sync.RWMutex
	rooms   map[string]map[*realtimeClient]struct{}
	globals map[*realtimeClient]struct{}
}

func NewRealtimeHandler(sessions *service.SessionService, calls *repository.CallRepository, jwtSecret string) *RealtimeHandler {
	return &RealtimeHandler{
		sessions:  sessions,
		calls:     calls,
		jwtSecret: jwtSecret,
		hub: &realtimeHub{
			rooms:   make(map[string]map[*realtimeClient]struct{}),
			globals: make(map[*realtimeClient]struct{}),
		},
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (h *RealtimeHandler) ConnectGlobal(c *gin.Context) {
	role := strings.TrimSpace(c.Query("role"))
	token := strings.TrimSpace(c.Query("token"))
	if role != RealtimeRolePolice || token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid websocket query"})
		return
	}

	if _, err := auth.ParseToken(token, h.jwtSecret); err != nil {
		status := http.StatusUnauthorized
		message := "invalid authorization token"
		if errors.Is(err, auth.ErrExpiredToken) {
			message = "authorization token expired"
		}
		c.JSON(status, gin.H{"error": message})
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &realtimeClient{
		conn:   conn,
		role:   role,
		send:   make(chan realtimeMessage, 8),
		global: true,
	}
	h.hub.addGlobal(client)

	go h.writePump(client)
	h.readPump(client)
}

func (h *RealtimeHandler) Connect(c *gin.Context) {
	sessionID := strings.TrimSpace(c.Query("sessionId"))
	role := strings.TrimSpace(c.Query("role"))
	token := strings.TrimSpace(c.Query("token"))
	if sessionID == "" || !validRealtimeRole(role) || token == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid websocket query"})
		return
	}

	claims, err := auth.ParseToken(token, h.jwtSecret)
	if err != nil {
		status := http.StatusUnauthorized
		message := "invalid authorization token"
		if errors.Is(err, auth.ErrExpiredToken) {
			message = "authorization token expired"
		}
		c.JSON(status, gin.H{"error": message})
		return
	}
	userID, _ := strconv.ParseUint(claims.Subject, 10, 64)

	session, err := h.sessions.Get(c.Request.Context(), sessionID)
	if err != nil {
		writeSessionError(c, err)
		return
	}

	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}

	client := &realtimeClient{
		conn:      conn,
		sessionID: sessionID,
		role:      role,
		userID:    userID,
		send:      make(chan realtimeMessage, 8),
	}
	h.hub.add(client)

	if role == RealtimeRoleDriver {
		session, err = h.sessions.SetDriverOnline(c.Request.Context(), sessionID, true)
		if err == nil {
			h.BroadcastSession(session)
		}
	} else {
		client.send <- sessionUpdatedMessage(session)
	}

	go h.writePump(client)
	h.readPump(client)
}

func (h *RealtimeHandler) readPump(client *realtimeClient) {
	defer h.disconnect(client)

	for {
		var message struct {
			Type    string          `json:"type"`
			Payload json.RawMessage `json:"payload,omitempty"`
		}
		if err := client.conn.ReadJSON(&message); err != nil {
			return
		}
		if client.global {
			continue
		}
		if message.Type == "driver.heartbeat" && client.role == RealtimeRoleDriver {
			session, err := h.sessions.SetDriverOnline(context.Background(), client.sessionID, true)
			if err == nil {
				h.BroadcastSession(session)
			}
		}
		if strings.HasPrefix(message.Type, "webrtc.") || strings.HasPrefix(message.Type, "call.") {
			h.recordRealtimeCallEvent(client, message.Type)
			h.hub.forward(client, realtimeMessage{
				Type:      message.Type,
				SessionID: client.sessionID,
				Role:      client.role,
				Payload:   message.Payload,
			})
		}
	}
}

func (h *RealtimeHandler) recordRealtimeCallEvent(client *realtimeClient, messageType string) {
	if h.calls == nil || client == nil {
		return
	}

	ctx := context.Background()
	participant := repository.CallParticipant{
		UserID: client.userID,
		Role:   client.role,
	}

	var err error
	switch messageType {
	case "webrtc.offer":
		_, err = h.calls.StartSignaling(ctx, client.sessionID, participant)
	case "webrtc.answer":
		_, err = h.calls.UpdateParticipant(ctx, client.sessionID, participant)
	case "call.connected":
		_, err = h.calls.MarkConnected(ctx, client.sessionID, participant)
	case "webrtc.leave":
		_, err = h.calls.EndLatestOpen(ctx, client.sessionID, repository.CallStatusDisconnected, "webrtc.leave")
	default:
		return
	}

	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("record %s for session %s: %v", messageType, client.sessionID, err)
	}
}

func (h *RealtimeHandler) writePump(client *realtimeClient) {
	defer client.conn.Close()

	for message := range client.send {
		if err := client.conn.WriteJSON(message); err != nil {
			return
		}
	}
}

func (h *RealtimeHandler) disconnect(client *realtimeClient) {
	if client.global {
		h.hub.removeGlobal(client)
	} else {
		h.hub.remove(client)
	}
	close(client.send)
	client.conn.Close()

	if client.global || client.role != RealtimeRoleDriver {
		return
	}

	session, err := h.sessions.SetDriverOnline(context.Background(), client.sessionID, false)
	if err == nil {
		h.BroadcastSession(session)
	}
}

func (h *RealtimeHandler) BroadcastSession(session *service.Session) {
	h.hub.broadcastSession(session)
}

func (h *RealtimeHandler) BroadcastSessionCreated(session *service.Session) {
	h.hub.broadcastSessionCreated(session)
	h.hub.broadcastSession(session)
}

func (h *realtimeHub) add(client *realtimeClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if h.rooms[client.sessionID] == nil {
		h.rooms[client.sessionID] = make(map[*realtimeClient]struct{})
	}
	h.rooms[client.sessionID][client] = struct{}{}
}

func (h *realtimeHub) addGlobal(client *realtimeClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.globals[client] = struct{}{}
}

func (h *realtimeHub) remove(client *realtimeClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	clients := h.rooms[client.sessionID]
	if clients == nil {
		return
	}
	delete(clients, client)
	if len(clients) == 0 {
		delete(h.rooms, client.sessionID)
	}
}

func (h *realtimeHub) removeGlobal(client *realtimeClient) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.globals, client)
}

func (h *realtimeHub) broadcastSession(session *service.Session) {
	if session == nil {
		return
	}

	message := sessionUpdatedMessage(session)

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.rooms[session.ID] {
		select {
		case client.send <- message:
		default:
		}
	}
}

func (h *realtimeHub) broadcastSessionCreated(session *service.Session) {
	if session == nil {
		return
	}

	message := sessionCreatedMessage(session)

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.globals {
		select {
		case client.send <- message:
		default:
		}
	}
}

func (h *realtimeHub) forward(sender *realtimeClient, message realtimeMessage) {
	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.rooms[sender.sessionID] {
		if client == sender {
			continue
		}

		select {
		case client.send <- message:
		default:
		}
	}
}

func sessionUpdatedMessage(session *service.Session) realtimeMessage {
	return realtimeMessage{
		Type:      "session.updated",
		SessionID: session.ID,
		Payload:   session,
	}
}

func sessionCreatedMessage(session *service.Session) realtimeMessage {
	return realtimeMessage{
		Type:      "session.created",
		SessionID: session.ID,
		Payload:   session,
	}
}

func validRealtimeRole(role string) bool {
	return role == RealtimeRolePolice || role == RealtimeRoleDriver
}
