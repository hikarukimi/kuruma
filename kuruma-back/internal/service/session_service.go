package service

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"
)

const (
	LocationStatusReady         = "ready"
	NetworkStatusGood           = "good"
	CallStatusActive            = "active"
	CallStatusEnded             = "ended"
	RecordingStatusIdle         = "idle"
	RecordingStatusOn           = "recording"
	SignalingStatusConnected    = "connected"
	SignalingStatusDisconnected = "disconnected"
	SignalingStatusIdle         = "idle"
)

var ErrSessionNotFound = errors.New("session not found")

type Session struct {
	ID                string    `json:"id"`
	DriverID          uint64    `json:"driverId,omitempty"`
	DriverName        string    `json:"driverName"`
	DriverPhoneMasked string    `json:"driverPhoneMasked"`
	Description       string    `json:"description"`
	LocationStatus    string    `json:"locationStatus"`
	LocationText      string    `json:"locationText"`
	NetworkStatus     string    `json:"networkStatus"`
	DriverOnline      bool      `json:"driverOnline"`
	SignalingStatus   string    `json:"signalingStatus"`
	RecordingStatus   string    `json:"recordingStatus"`
	CallStatus        string    `json:"callStatus"`
	CreatedAt         time.Time `json:"createdAt"`
	UpdatedAt         time.Time `json:"updatedAt"`
}

type CreateSessionInput struct {
	DriverID          uint64
	DriverName        string
	DriverPhoneMasked string
	Description       string
	LocationStatus    string
	LocationText      string
	NetworkStatus     string
	DriverOnline      *bool
	SignalingStatus   string
	RecordingStatus   string
	CallStatus        string
}

type SessionService struct {
	mu       sync.RWMutex
	nextSeq  int
	sessions map[string]*Session
}

func NewSessionService() *SessionService {
	return &SessionService{
		nextSeq:  1,
		sessions: make(map[string]*Session),
	}
}

func (s *SessionService) Create(ctx context.Context, input CreateSessionInput) (*Session, error) {
	_ = ctx

	s.mu.Lock()
	defer s.mu.Unlock()

	now := time.Now()
	driverName := strings.TrimSpace(input.DriverName)
	driverPhoneMasked := strings.TrimSpace(input.DriverPhoneMasked)
	driverOnline := false
	if input.DriverOnline != nil {
		driverOnline = *input.DriverOnline
	}
	if input.DriverID != 0 {
		if session := s.findReusableDriverSession(input.DriverID); session != nil {
			applyCreateInput(session, input, now)
			return cloneSession(session), nil
		}
	}

	session := &Session{
		ID:                s.nextID(now),
		DriverID:          input.DriverID,
		DriverName:        driverName,
		DriverPhoneMasked: driverPhoneMasked,
		Description:       strings.TrimSpace(input.Description),
		LocationStatus:    defaultString(input.LocationStatus, LocationStatusReady),
		LocationText:      strings.TrimSpace(input.LocationText),
		NetworkStatus:     defaultString(input.NetworkStatus, NetworkStatusGood),
		DriverOnline:      driverOnline,
		SignalingStatus:   defaultString(input.SignalingStatus, SignalingStatusIdle),
		RecordingStatus:   defaultString(input.RecordingStatus, RecordingStatusIdle),
		CallStatus:        defaultString(input.CallStatus, CallStatusActive),
		CreatedAt:         now,
		UpdatedAt:         now,
	}
	s.sessions[session.ID] = session
	s.nextSeq++

	return cloneSession(session), nil
}

func (s *SessionService) findReusableDriverSession(driverID uint64) *Session {
	var unclaimed *Session
	unclaimedCount := 0

	for _, session := range s.sessions {
		if session.DriverID == driverID && session.CallStatus != CallStatusEnded {
			return session
		}
		if session.DriverID == 0 && session.CallStatus != CallStatusEnded {
			unclaimedCount++
			unclaimed = session
		}
	}
	if unclaimedCount == 1 {
		unclaimed.DriverID = driverID
		return unclaimed
	}

	return nil
}

func (s *SessionService) List(ctx context.Context) ([]*Session, error) {
	_ = ctx

	s.mu.RLock()
	defer s.mu.RUnlock()

	sessions := make([]*Session, 0, len(s.sessions))
	for _, session := range s.sessions {
		sessions = append(sessions, cloneSession(session))
	}

	return sessions, nil
}

func (s *SessionService) Get(ctx context.Context, id string) (*Session, error) {
	_ = ctx

	s.mu.RLock()
	defer s.mu.RUnlock()

	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}

	return cloneSession(session), nil
}

func (s *SessionService) StartRecording(ctx context.Context, id string) (*Session, error) {
	return s.update(ctx, id, func(session *Session) {
		session.RecordingStatus = RecordingStatusOn
	})
}

func (s *SessionService) StopRecording(ctx context.Context, id string) (*Session, error) {
	return s.update(ctx, id, func(session *Session) {
		session.RecordingStatus = RecordingStatusIdle
	})
}

func (s *SessionService) EndCall(ctx context.Context, id string) (*Session, error) {
	return s.update(ctx, id, func(session *Session) {
		session.CallStatus = CallStatusEnded
		session.RecordingStatus = RecordingStatusIdle
	})
}

func (s *SessionService) SetDriverOnline(ctx context.Context, id string, online bool) (*Session, error) {
	return s.update(ctx, id, func(session *Session) {
		session.DriverOnline = online
		if online {
			session.SignalingStatus = SignalingStatusConnected
			return
		}
		session.SignalingStatus = SignalingStatusDisconnected
	})
}

func (s *SessionService) update(ctx context.Context, id string, apply func(*Session)) (*Session, error) {
	_ = ctx

	s.mu.Lock()
	defer s.mu.Unlock()

	session, ok := s.sessions[id]
	if !ok {
		return nil, ErrSessionNotFound
	}

	apply(session)
	session.UpdatedAt = time.Now()

	return cloneSession(session), nil
}

func (s *SessionService) nextID(now time.Time) string {
	return fmt.Sprintf("ACC-%s-%04d", now.Format("20060102"), s.nextSeq)
}

func cloneSession(session *Session) *Session {
	if session == nil {
		return nil
	}

	clone := *session
	return &clone
}

func applyCreateInput(session *Session, input CreateSessionInput, now time.Time) {
	if driverName := strings.TrimSpace(input.DriverName); driverName != "" {
		session.DriverName = driverName
	}
	if driverPhoneMasked := strings.TrimSpace(input.DriverPhoneMasked); driverPhoneMasked != "" {
		session.DriverPhoneMasked = driverPhoneMasked
	}
	if description := strings.TrimSpace(input.Description); description != "" {
		session.Description = description
	}
	session.LocationStatus = defaultString(input.LocationStatus, session.LocationStatus)
	if locationText := strings.TrimSpace(input.LocationText); locationText != "" {
		session.LocationText = locationText
	}
	session.NetworkStatus = defaultString(input.NetworkStatus, session.NetworkStatus)
	if input.DriverOnline != nil {
		session.DriverOnline = *input.DriverOnline
	}
	session.UpdatedAt = now
}

func defaultString(value string, fallback string) string {
	value = strings.TrimSpace(value)
	if value == "" {
		return fallback
	}
	return value
}
