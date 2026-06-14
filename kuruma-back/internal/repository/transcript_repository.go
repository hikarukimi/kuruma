package repository

import (
	"context"
	"strings"
	"time"

	"gorm.io/gorm"

	"kuruma-back/internal/model"
)

const (
	TranscriptStatusProcessing = "processing"
	TranscriptStatusCompleted  = "completed"
	TranscriptStatusFailed     = "failed"
)

type TranscriptRepository struct {
	db *gorm.DB
}

type SaveTranscriptSegmentInput struct {
	ChunkIndex   int
	SegmentIndex int
	Speaker      string
	Content      string
}

func NewTranscriptRepository(db *gorm.DB) *TranscriptRepository {
	return &TranscriptRepository{db: db}
}

func (r *TranscriptRepository) Start(ctx context.Context, recording model.Recording, provider string, modelName string) (*model.CallTranscript, error) {
	var transcript model.CallTranscript
	err := r.db.WithContext(ctx).
		Where("recording_id = ?", strings.TrimSpace(recording.ID)).
		First(&transcript).Error
	if err == nil {
		return &transcript, nil
	}
	if err != nil && err != gorm.ErrRecordNotFound {
		return nil, err
	}

	transcript = model.CallTranscript{
		ID:          newUUID(),
		SessionID:   recording.SessionID,
		RecordingID: recording.ID,
		Status:      TranscriptStatusProcessing,
		Provider:    provider,
		Model:       modelName,
	}
	if err := r.db.WithContext(ctx).Create(&transcript).Error; err != nil {
		return nil, err
	}

	return &transcript, nil
}

func (r *TranscriptRepository) FindByRecording(ctx context.Context, sessionID string, recordingID string) (*model.CallTranscript, error) {
	var transcript model.CallTranscript
	err := r.db.WithContext(ctx).
		Preload("Segments", orderTranscriptSegments).
		Where("session_id = ? AND recording_id = ?", strings.TrimSpace(sessionID), strings.TrimSpace(recordingID)).
		First(&transcript).Error
	if err != nil {
		return nil, err
	}
	return &transcript, nil
}

func (r *TranscriptRepository) Complete(ctx context.Context, transcript *model.CallTranscript, segments []SaveTranscriptSegmentInput) error {
	if transcript == nil {
		return gorm.ErrRecordNotFound
	}

	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("transcript_id = ?", transcript.ID).Delete(&model.TranscriptSegment{}).Error; err != nil {
			return err
		}

		nextSegments := make([]model.TranscriptSegment, 0, len(segments))
		for _, segment := range segments {
			content := strings.TrimSpace(segment.Content)
			if content == "" {
				continue
			}
			speaker := strings.TrimSpace(segment.Speaker)
			if speaker == "" {
				speaker = "说话人1"
			}
			nextSegments = append(nextSegments, model.TranscriptSegment{
				ID:           newUUID(),
				TranscriptID: transcript.ID,
				SessionID:    transcript.SessionID,
				RecordingID:  transcript.RecordingID,
				ChunkIndex:   segment.ChunkIndex,
				SegmentIndex: segment.SegmentIndex,
				Speaker:      speaker,
				Content:      content,
			})
		}
		if len(nextSegments) > 0 {
			if err := tx.Create(&nextSegments).Error; err != nil {
				return err
			}
		}

		now := time.Now()
		return tx.Model(transcript).Updates(map[string]any{
			"status":        TranscriptStatusCompleted,
			"error_message": nil,
			"completed_at":  &now,
		}).Error
	})
}

func (r *TranscriptRepository) Fail(ctx context.Context, transcript *model.CallTranscript, errMessage string) error {
	if transcript == nil {
		return gorm.ErrRecordNotFound
	}

	errMessage = strings.TrimSpace(errMessage)
	if errMessage == "" {
		errMessage = "transcription failed"
	}

	return r.db.WithContext(ctx).Model(transcript).Updates(map[string]any{
		"status":        TranscriptStatusFailed,
		"error_message": errMessage,
	}).Error
}

func (r *TranscriptRepository) ListBySession(ctx context.Context, sessionID string) ([]model.CallTranscript, error) {
	var transcripts []model.CallTranscript
	err := r.db.WithContext(ctx).
		Preload("Segments", orderTranscriptSegments).
		Where("session_id = ?", strings.TrimSpace(sessionID)).
		Order("created_at ASC").
		Find(&transcripts).Error
	return transcripts, err
}

func orderTranscriptSegments(db *gorm.DB) *gorm.DB {
	return db.Order("chunk_index ASC, segment_index ASC, created_at ASC")
}
