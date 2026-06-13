package repository

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"strings"
	"time"

	"gorm.io/gorm"

	"kuruma-back/internal/model"
)

const RecordingStatusCompleted = "completed"

var ErrRecordingPathOutsideStorage = fmt.Errorf("recording path is outside storage")

type RecordingRepository struct {
	db         *gorm.DB
	storageDir string
}

type SaveRecordingInput struct {
	SessionID string
	CallID    *string
	File      *multipart.FileHeader
	MimeType  string
	StartedAt *time.Time
}

func NewRecordingRepository(db *gorm.DB, storageDir string) *RecordingRepository {
	return &RecordingRepository{
		db:         db,
		storageDir: storageDir,
	}
}

func (r *RecordingRepository) SaveUploaded(ctx context.Context, input SaveRecordingInput) (*model.Recording, error) {
	sessionID := strings.TrimSpace(input.SessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("session id is empty")
	}
	if input.File == nil {
		return nil, fmt.Errorf("recording file is empty")
	}

	source, err := input.File.Open()
	if err != nil {
		return nil, err
	}
	defer source.Close()

	recordingID := newUUID()
	now := time.Now()
	recordingsDir := filepath.Join(r.storageDir, "recordings", sessionID)
	if err := os.MkdirAll(recordingsDir, 0755); err != nil {
		return nil, err
	}

	extension := recordingExtension(input.File.Filename, input.MimeType)
	fileName := fmt.Sprintf("%s%s", recordingID, extension)
	filePath := filepath.Join(recordingsDir, fileName)
	target, err := os.Create(filePath)
	if err != nil {
		return nil, err
	}
	defer target.Close()

	size, err := io.Copy(target, source)
	if err != nil {
		return nil, err
	}

	startedAt := input.StartedAt
	if startedAt == nil {
		startedAt = &now
	}
	mimeType := strings.TrimSpace(input.MimeType)
	if mimeType == "" {
		mimeType = input.File.Header.Get("Content-Type")
	}
	if mimeType == "" {
		mimeType = "application/octet-stream"
	}

	recording := &model.Recording{
		ID:          recordingID,
		SessionID:   sessionID,
		CallID:      input.CallID,
		Status:      RecordingStatusCompleted,
		FilePath:    filePath,
		FileSize:    size,
		MimeType:    mimeType,
		StartedAt:   startedAt,
		CompletedAt: &now,
	}
	if err := r.db.WithContext(ctx).Create(recording).Error; err != nil {
		_ = os.Remove(filePath)
		return nil, err
	}

	return recording, nil
}

func (r *RecordingRepository) ListBySession(ctx context.Context, sessionID string) ([]model.Recording, error) {
	sessionID = strings.TrimSpace(sessionID)
	if sessionID == "" {
		return nil, fmt.Errorf("session id is empty")
	}

	var recordings []model.Recording
	err := r.db.WithContext(ctx).
		Where("session_id = ?", sessionID).
		Order("created_at DESC").
		Find(&recordings).Error
	return recordings, err
}

func (r *RecordingRepository) FindForSession(ctx context.Context, sessionID string, recordingID string) (*model.Recording, error) {
	sessionID = strings.TrimSpace(sessionID)
	recordingID = strings.TrimSpace(recordingID)
	if sessionID == "" || recordingID == "" {
		return nil, gorm.ErrRecordNotFound
	}

	var recording model.Recording
	if err := r.db.WithContext(ctx).
		Where("session_id = ? AND id = ?", sessionID, recordingID).
		First(&recording).Error; err != nil {
		return nil, err
	}

	return &recording, nil
}

func (r *RecordingRepository) Open(recording *model.Recording) (*os.File, string, error) {
	if recording == nil {
		return nil, "", gorm.ErrRecordNotFound
	}

	baseDir, err := filepath.Abs(r.storageDir)
	if err != nil {
		return nil, "", err
	}
	filePath := recording.FilePath
	filePath, err = filepath.Abs(filepath.Clean(filePath))
	if err != nil {
		return nil, "", err
	}

	if filePath != baseDir && !strings.HasPrefix(filePath, baseDir+string(os.PathSeparator)) {
		return nil, "", ErrRecordingPathOutsideStorage
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, "", err
	}

	fileName := recording.ID + strings.ToLower(filepath.Ext(filePath))
	return file, fileName, nil
}

func recordingExtension(fileName string, mimeType string) string {
	extension := strings.ToLower(filepath.Ext(fileName))
	if extension != "" {
		return extension
	}

	mimeType = strings.ToLower(strings.TrimSpace(mimeType))
	switch {
	case strings.Contains(mimeType, "webm"):
		return ".webm"
	case strings.Contains(mimeType, "mp4"):
		return ".mp4"
	case strings.Contains(mimeType, "wav"):
		return ".wav"
	case strings.Contains(mimeType, "mpeg"), strings.Contains(mimeType, "mp3"):
		return ".mp3"
	default:
		return ".bin"
	}
}
