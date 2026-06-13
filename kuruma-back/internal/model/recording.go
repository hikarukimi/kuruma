package model

import "time"

type Recording struct {
	ID          string     `gorm:"primaryKey;column:id;size:36" json:"id"`
	SessionID   string     `gorm:"column:session_id;size:64;not null;index" json:"sessionId"`
	CallID      *string    `gorm:"column:call_id;size:36;index" json:"callId,omitempty"`
	Call        *Call      `gorm:"foreignKey:CallID" json:"-"`
	Status      string     `gorm:"column:status;size:32;not null;index" json:"status"`
	FilePath    string     `gorm:"column:file_path;size:512;not null" json:"filePath"`
	FileSize    int64      `gorm:"column:file_size;not null" json:"fileSize"`
	MimeType    string     `gorm:"column:mime_type;size:128;not null" json:"mimeType"`
	StartedAt   *time.Time `gorm:"column:started_at" json:"startedAt,omitempty"`
	CompletedAt *time.Time `gorm:"column:completed_at" json:"completedAt,omitempty"`
	CreatedAt   time.Time  `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Recording) TableName() string {
	return "recordings"
}
