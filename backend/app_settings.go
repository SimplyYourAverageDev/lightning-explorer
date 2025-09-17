package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

func (a *App) GetSettings() Settings {
	a.settingsOnce.Do(func() {
		a.loadSettings()
	})
	return a.settings
}

func (a *App) SaveSettings(newSettings Settings) error {
	a.settings = newSettings
	if fs, ok := a.filesystem.(*FileSystemManager); ok {
		fs.SetShowHidden(newSettings.ShowHiddenFiles)
	}
	return a.saveSettingsToFile()
}

func (a *App) loadSettings() {
	a.settings = Settings{
		BackgroundStartup: true,
		Theme:             "system",
		ShowHiddenFiles:   false,
	}

	settingsPath := a.getSettingsPath()
	if data, err := os.ReadFile(settingsPath); err == nil {
		if err := json.Unmarshal(data, &a.settings); err != nil {
			logPrintln("⚠️ Failed to parse settings file, using defaults:", err)
		}
		if a.settings.PinnedFolders == nil {
			a.settings.PinnedFolders = []string{}
		}
	}

	if fs, ok := a.filesystem.(*FileSystemManager); ok {
		fs.SetShowHidden(a.settings.ShowHiddenFiles)
	}
}

func (a *App) saveSettingsToFile() error {
	settingsPath := a.getSettingsPath()

	if err := os.MkdirAll(filepath.Dir(settingsPath), 0755); err != nil {
		return fmt.Errorf("failed to create settings directory: %w", err)
	}

	data, err := json.MarshalIndent(a.settings, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal settings: %w", err)
	}

	if err := os.WriteFile(settingsPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write settings file: %w", err)
	}

	logPrintln("💾 Settings saved to:", settingsPath)
	return nil
}

func (a *App) getSettingsPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		homeDir, _ := os.UserHomeDir()
		configDir = filepath.Join(homeDir, ".config")
	}

	return filepath.Join(configDir, "lightning-explorer", "settings.json")
}

func (a *App) HealthCheck() map[string]interface{} {
	return map[string]interface{}{
		"status":  "healthy",
		"version": "2.0-simplified",
		"ready":   true,
	}
}

func (a *App) GetContext() context.Context {
	return a.ctx
}
