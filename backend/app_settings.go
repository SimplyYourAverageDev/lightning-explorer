package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// GetSettings returns the current application settings
func (a *App) GetSettings() Settings {
	a.settingsOnce.Do(func() {
		a.loadSettings()
	})
	return a.settings
}

// SaveSettings saves the application settings to disk
func (a *App) SaveSettings(newSettings Settings) error {
	a.settings = newSettings
	return a.saveSettingsToFile()
}

// loadSettings loads settings from file or creates defaults
func (a *App) loadSettings() {
	// Default settings
	a.settings = Settings{
		BackgroundStartup: true, // Default to enabled for better UX
		Theme:             "system",
		ShowHiddenFiles:   false,
	}

	// Try to load from file
	settingsPath := a.getSettingsPath()
	if data, err := os.ReadFile(settingsPath); err == nil {
		if err := json.Unmarshal(data, &a.settings); err != nil {
			logPrintln("⚠️ Failed to parse settings file, using defaults:", err)
		}
	}
}

// saveSettingsToFile saves settings to the user's config directory
func (a *App) saveSettingsToFile() error {
	settingsPath := a.getSettingsPath()

	// Ensure directory exists
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

// getSettingsPath returns the path to the settings file
func (a *App) getSettingsPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		// Fallback to user home directory
		homeDir, _ := os.UserHomeDir()
		configDir = filepath.Join(homeDir, ".config")
	}

	return filepath.Join(configDir, "lightning-explorer", "settings.json")
}

// HealthCheck returns application health status
func (a *App) HealthCheck() map[string]interface{} {
	return map[string]interface{}{
		"status":  "healthy",
		"version": "2.0-simplified",
		"ready":   true,
	}
}

// GetContext exposes the internal context for use in main.go
func (a *App) GetContext() context.Context {
	return a.ctx
}
