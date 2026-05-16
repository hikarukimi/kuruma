package database

import (
	"fmt"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"kuruma-back/internal/config"
)

func Open(cfg config.Config) (*gorm.DB, error) {
	switch cfg.DBDriver {
	case "postgres", "postgresql":
		return gorm.Open(postgres.Open(cfg.DBDSN), &gorm.Config{
			Logger:         logger.Default.LogMode(logger.Warn),
			TranslateError: true,
		})
	default:
		return nil, fmt.Errorf("unsupported database driver %q", cfg.DBDriver)
	}
}
