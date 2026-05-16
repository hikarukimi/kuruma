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
	AppName  string
	Env      string
	Port     string
	DBDriver string
	DBDSN    string
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
		AppName:  "",
		Env:      "",
		Port:     "",
		DBDriver: "",
		DBDSN:    "",
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

	return cfg, nil
}
