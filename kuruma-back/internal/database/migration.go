package database

import (
	"fmt"

	"gorm.io/gorm"

	"kuruma-back/internal/model"
)

func AutoMigrate(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("database is nil")
	}

	return db.AutoMigrate(migrationModels()...)
}

func migrationModels() []any {
	return []any{
		&model.User{},
		&model.Call{},
		&model.Recording{},
		&model.CallTranscript{},
		&model.TranscriptSegment{},
	}
}
