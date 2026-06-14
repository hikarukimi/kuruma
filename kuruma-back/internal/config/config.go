package config

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/goccy/go-yaml"
)

const (
	appConfigPath = "configs/app.yaml"
)

type Config struct {
	AppName            string
	Env                string
	Port               string
	DBDriver           string
	DBDSN              string
	JWTSecret          string
	JWTExpiresHours    int
	StorageLocalPath   string
	FFmpegPath         string
	BigModelAPIKey     string
	BigModelEndpoint   string
	BigModelModel      string
	BigModelMaxAudioMB int
}

func Load() Config {
	cfg, err := loadFile(appConfigPath)
	if err != nil {
		panic(fmt.Errorf("load config %s: %w", appConfigPath, err))
	}

	return cfg
}

func (c Config) HTTPAddress() string {
	return ":" + c.Port
}

func loadFile(path string) (Config, error) {
	cfg := Config{
		AppName:            "",
		Env:                "",
		Port:               "",
		DBDriver:           "",
		DBDSN:              "",
		JWTSecret:          "kuruma-dev-secret",
		JWTExpiresHours:    24,
		StorageLocalPath:   "./storage",
		BigModelEndpoint:   "https://open.bigmodel.cn/api/paas/v4/audio/transcriptions",
		BigModelModel:      "glm-asr-2512",
		BigModelMaxAudioMB: 25,
	}

	data, err := os.ReadFile(filepath.Clean(path))
	if err != nil {
		return Config{}, err
	}

	var fileConfig struct {
		App struct {
			Name string `yaml:"name"`
			Env  string `yaml:"env"`
		} `yaml:"app"`
		HTTP struct {
			Port string `yaml:"port"`
		} `yaml:"http"`
		Database struct {
			Driver string `yaml:"driver"`
			DSN    string `yaml:"dsn"`
		} `yaml:"database"`
		Auth struct {
			JWTSecret       string `yaml:"jwt_secret"`
			JWTExpiresHours int    `yaml:"jwt_expires_hours"`
		} `yaml:"auth"`
		Storage struct {
			LocalPath string `yaml:"local_path"`
		} `yaml:"storage"`
		Transcription struct {
			FFmpegPath string `yaml:"ffmpeg_path"`
		} `yaml:"transcription"`
		BigModel struct {
			APIKey     string `yaml:"api_key"`
			Endpoint   string `yaml:"endpoint"`
			Model      string `yaml:"model"`
			MaxAudioMB int    `yaml:"max_audio_mb"`
		} `yaml:"bigmodel"`
	}

	if err := yaml.Unmarshal(data, &fileConfig); err != nil {
		return Config{}, err
	}

	if fileConfig.App.Name != "" {
		cfg.AppName = fileConfig.App.Name
	}
	if fileConfig.App.Env != "" {
		cfg.Env = fileConfig.App.Env
	}
	if fileConfig.HTTP.Port != "" {
		cfg.Port = fileConfig.HTTP.Port
	}
	if fileConfig.Database.Driver != "" {
		cfg.DBDriver = fileConfig.Database.Driver
	}
	if fileConfig.Database.DSN != "" {
		cfg.DBDSN = fileConfig.Database.DSN
	}
	if fileConfig.Auth.JWTSecret != "" {
		cfg.JWTSecret = fileConfig.Auth.JWTSecret
	}
	if fileConfig.Auth.JWTExpiresHours > 0 {
		cfg.JWTExpiresHours = fileConfig.Auth.JWTExpiresHours
	}
	if fileConfig.Storage.LocalPath != "" {
		cfg.StorageLocalPath = fileConfig.Storage.LocalPath
	}
	if fileConfig.Transcription.FFmpegPath != "" {
		cfg.FFmpegPath = fileConfig.Transcription.FFmpegPath
	}
	if fileConfig.BigModel.APIKey != "" {
		cfg.BigModelAPIKey = fileConfig.BigModel.APIKey
	}
	if fileConfig.BigModel.Endpoint != "" {
		cfg.BigModelEndpoint = fileConfig.BigModel.Endpoint
	}
	if fileConfig.BigModel.Model != "" {
		cfg.BigModelModel = fileConfig.BigModel.Model
	}
	if fileConfig.BigModel.MaxAudioMB > 0 {
		cfg.BigModelMaxAudioMB = fileConfig.BigModel.MaxAudioMB
	}

	return cfg, nil
}
