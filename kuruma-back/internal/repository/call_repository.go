package repository

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"

	"kuruma-back/internal/model"
)

const (
	CallStatusSignaling    = "signaling"
	CallStatusConnected    = "connected"
	CallStatusDisconnected = "disconnected"
	CallStatusEnded        = "ended"
)

type CallRepository struct {
	db *gorm.DB
}

type CallParticipant struct {
	UserID uint64
	Role   string
}

func NewCallRepository(db *gorm.DB) *CallRepository {
	return &CallRepository{db: db}
}

func (r *CallRepository) StartSignaling(ctx context.Context, sessionID string, participant CallParticipant) (*model.Call, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("session id is empty")
	}

	var call *model.Call
	err := r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		existing, err := findLatestOpenCall(ctx, tx, sessionID)
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if existing != nil {
			applyParticipant(existing, participant)
			existing.Status = CallStatusSignaling
			if err := tx.Save(existing).Error; err != nil {
				return err
			}
			call = existing
			return nil
		}

		now := time.Now()
		next := &model.Call{
			ID:        newUUID(),
			SessionID: sessionID,
			RoomID:    fmt.Sprintf("%s-%s", sessionID, newRandomHex(8)),
			Status:    CallStatusSignaling,
			StartedAt: now,
		}
		applyParticipant(next, participant)
		if err := tx.Create(next).Error; err != nil {
			return err
		}
		call = next
		return nil
	})
	if err != nil {
		return nil, err
	}

	return call, nil
}

func (r *CallRepository) UpdateParticipant(ctx context.Context, sessionID string, participant CallParticipant) (*model.Call, error) {
	return r.updateLatestOpen(ctx, sessionID, func(call *model.Call) {
		applyParticipant(call, participant)
	})
}

func (r *CallRepository) MarkConnected(ctx context.Context, sessionID string, participant CallParticipant) (*model.Call, error) {
	return r.updateLatestOpen(ctx, sessionID, func(call *model.Call) {
		applyParticipant(call, participant)
		call.Status = CallStatusConnected
	})
}

func (r *CallRepository) LatestForSession(ctx context.Context, sessionID string) (*model.Call, error) {
	var call model.Call
	if err := r.db.WithContext(ctx).
		Where("session_id = ?", strings.TrimSpace(sessionID)).
		Order("created_at DESC").
		First(&call).Error; err != nil {
		return nil, err
	}
	return &call, nil
}

func (r *CallRepository) EndLatestOpen(ctx context.Context, sessionID string, status string, reason string) (*model.Call, error) {
	return r.updateLatestOpen(ctx, sessionID, func(call *model.Call) {
		now := time.Now()
		call.Status = status
		call.EndedAt = &now
		if trimmed := strings.TrimSpace(reason); trimmed != "" {
			call.DisconnectReason = &trimmed
		}
	})
}

func (r *CallRepository) updateLatestOpen(ctx context.Context, sessionID string, apply func(*model.Call)) (*model.Call, error) {
	call, err := findLatestOpenCall(ctx, r.db, sessionID)
	if err != nil {
		return nil, err
	}

	apply(call)
	if err := r.db.WithContext(ctx).Save(call).Error; err != nil {
		return nil, err
	}
	return call, nil
}

func findLatestOpenCall(ctx context.Context, db *gorm.DB, sessionID string) (*model.Call, error) {
	var call model.Call
	if err := db.WithContext(ctx).
		Where("session_id = ? AND ended_at IS NULL", strings.TrimSpace(sessionID)).
		Order("created_at DESC").
		First(&call).Error; err != nil {
		return nil, err
	}
	return &call, nil
}

func applyParticipant(call *model.Call, participant CallParticipant) {
	if call == nil || participant.UserID == 0 {
		return
	}

	switch strings.TrimSpace(participant.Role) {
	case "driver":
		call.DriverID = &participant.UserID
	case "police":
		call.PoliceID = &participant.UserID
	}
}

func newUUID() string {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%d-%s", time.Now().UnixNano(), newRandomHex(8))
	}
	bytes[6] = (bytes[6] & 0x0f) | 0x40
	bytes[8] = (bytes[8] & 0x3f) | 0x80

	return fmt.Sprintf("%x-%x-%x-%x-%x", bytes[0:4], bytes[4:6], bytes[6:8], bytes[8:10], bytes[10:])
}

func newRandomHex(size int) string {
	bytes := make([]byte, size)
	if _, err := rand.Read(bytes); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)
}
