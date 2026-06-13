package model

import "time"

type CallTranscript struct {
	ID           string              `gorm:"primaryKey;column:id;size:36" json:"id"`
	SessionID    string              `gorm:"column:session_id;size:64;not null;index" json:"sessionId"`
	RecordingID  string              `gorm:"column:recording_id;size:36;not null;uniqueIndex" json:"recordingId"`
	Recording    *Recording          `gorm:"foreignKey:RecordingID" json:"-"`
	Status       string              `gorm:"column:status;size:32;not null;index" json:"status"`
	Provider     string              `gorm:"column:provider;size:32;not null" json:"provider"`
	Model        string              `gorm:"column:model;size:64;not null" json:"model"`
	ErrorMessage *string             `gorm:"column:error_message;size:1024" json:"errorMessage,omitempty"`
	CompletedAt  *time.Time          `gorm:"column:completed_at" json:"completedAt,omitempty"`
	CreatedAt    time.Time           `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt    time.Time           `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
	Segments     []TranscriptSegment `gorm:"foreignKey:TranscriptID" json:"segments,omitempty"`
}

func (CallTranscript) TableName() string {
	return "call_transcripts"
}

type TranscriptSegment struct {
	ID           string    `gorm:"primaryKey;column:id;size:36" json:"id"`
	TranscriptID string    `gorm:"column:transcript_id;size:36;not null;index" json:"transcriptId"`
	SessionID    string    `gorm:"column:session_id;size:64;not null;index" json:"sessionId"`
	RecordingID  string    `gorm:"column:recording_id;size:36;not null;index" json:"recordingId"`
	ChunkIndex   int       `gorm:"column:chunk_index;not null" json:"chunkIndex"`
	SegmentIndex int       `gorm:"column:segment_index;not null" json:"segmentIndex"`
	Speaker      string    `gorm:"column:speaker;size:64;not null" json:"speaker"`
	Content      string    `gorm:"column:content;type:text;not null" json:"content"`
	CreatedAt    time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
}

func (TranscriptSegment) TableName() string {
	return "call_transcript_segments"
}
