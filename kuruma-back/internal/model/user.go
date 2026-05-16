package model

import "time"

type User struct {
	ID          uint64    `gorm:"primaryKey;column:id" json:"id"`
	Account     string    `gorm:"column:account;size:64;not null;uniqueIndex" json:"account"`
	Phone       *string   `gorm:"column:phone;size:20;uniqueIndex" json:"phone,omitempty"`
	Password    string    `gorm:"column:password;size:255;not null" json:"-"`
	Role        string    `gorm:"column:role;size:20;not null" json:"role"`
	DisplayName string    `gorm:"column:display_name;size:64;not null" json:"displayName"`
	CreatedAt   time.Time `gorm:"column:created_at;autoCreateTime" json:"createdAt"`
	UpdatedAt   time.Time `gorm:"column:updated_at;autoUpdateTime" json:"updatedAt"`
}

func (User) TableName() string {
	return "users"
}
