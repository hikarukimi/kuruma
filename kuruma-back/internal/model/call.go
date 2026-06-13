package model

import "time"

type Call struct {
	ID               string     `gorm:"primaryKey;column:id;size:36" json:"id"`
	SessionID        string     `gorm:"column:session_id;size:64;not null;index:idx_calls_session_created,priority:1" json:"sessionId"`
	DriverID         *uint64    `gorm:"column:driver_id;index" json:"driverId,omitempty"`
	PoliceID         *uint64    `gorm:"column:police_id;index" json:"policeId,omitempty"`
	Driver           *User      `gorm:"foreignKey:DriverID" json:"-"`
	Police           *User      `gorm:"foreignKey:PoliceID" json:"-"`
	RoomID           string     `gorm:"column:room_id;size:96;not null;uniqueIndex" json:"roomId"`
	Status           string     `gorm:"column:status;size:32;not null;index" json:"status"`
	StartedAt        time.Time  `gorm:"column:started_at;not null" json:"startedAt"`
	EndedAt          *time.Time `gorm:"column:ended_at" json:"endedAt,omitempty"`
	DisconnectReason *string    `gorm:"column:disconnect_reason;size:128" json:"disconnectReason,omitempty"`
	CreatedAt        time.Time  `gorm:"column:created_at;autoCreateTime;index:idx_calls_session_created,priority:2" json:"createdAt"`
	UpdatedAt        time.Time  `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (Call) TableName() string {
	return "calls"
}
