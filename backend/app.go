//go:build legacyapp
// +build legacyapp

package backend

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Drive hot-plug is user-visible but not latency-critical – poll every 3 s to cut idle CPU
const pollInterval = 3 * time.Second

// NewApp creates a new App application struct - simplified
func NewApp() *App {
	return &App{
		filesystem: NewFileSystemManager(NewPlatformManager()),
		fileOps:    NewFileOperationsManager(NewPlatformManager()),
		platform:   NewPlatformManager(),
		// drives & terminal are expensive; initialize on first use
	}
}

// Startup is called when the app starts
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Set context on filesystem manager for event emission
	if fsManager, ok := a.filesystem.(*FileSystemManager); ok {
		fsManager.SetContext(ctx)
	}

	// Start background drive monitoring
	go a.monitorDrives()

	// Begin warm preloading in background
	go a.warmPreload()

	// TODO: Add system tray (Windows 11) in future version when Wails v3 stable.

	logPrintln("🚀 Lightning Explorer backend started")
}

// monitorDrives watches for drive additions/removals and emits events to the frontend
func (a *App) monitorDrives() {
	if a.ctx == nil {
		return
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	var prevJSON string
	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			drives := a.GetDriveInfo()
			data, err := json.Marshal(drives)
			if err != nil {
				continue
			}

			current := string(data)
			if current != prevJSON {
				prevJSON = current
				wruntime.EventsEmit(a.ctx, "driveListUpdated", drives)
			}
		}
	}
}

// warmPreload loads heavyweight data (home directory and drive list) once and caches it.
func (a *App) warmPreload() {
	a.warmOnce.Do(func() {
		// Use goroutines for parallel preloading
		var wg sync.WaitGroup
		wg.Add(2)

		// Preload home directory in parallel
		go func() {
			defer wg.Done()
			a.homeDirCache = a.platform.GetHomeDirectory()
		}()

		// Preload drives in parallel
		go func() {
			defer wg.Done()
			a.drivesCache = a.GetDriveInfo()
		}()

		wg.Wait()
		a.warmReady = true

		// Notify frontend that warmup is done
		if a.ctx != nil {
			wruntime.EventsEmit(a.ctx, "warmupDone", true)
		}
	})
}

// GetWarmState returns cached warm-start information to the frontend.
func (a *App) GetWarmState() WarmState {
	// Ensure warm preload has started
	go a.warmPreload()

	return WarmState{
		HomeDir: a.homeDirCache,
		Drives:  a.drivesCache,
		Ready:   a.warmReady,
	}
}

// Core API Methods - simplified, no duplicates

// GetHomeDirectory returns the user's home directory
func (a *App) GetHomeDirectory() string {
	return a.platform.GetHomeDirectory()
}

// GetCurrentWorkingDirectory returns the current working directory
func (a *App) GetCurrentWorkingDirectory() string {
	return a.platform.GetCurrentWorkingDirectory()
}

// GetSystemRoots returns system root paths (drives on Windows, / on Unix)
func (a *App) GetSystemRoots() []string {
	return a.platform.GetSystemRoots()
}

// NavigateToPath navigates to a specified path
func (a *App) NavigateToPath(path string) NavigationResponse {
	return a.filesystem.NavigateToPath(path)
}

// ListDirectory lists contents of a directory
func (a *App) ListDirectory(path string) NavigationResponse {
	return a.filesystem.ListDirectory(path)
}

// GetFileDetails gets detailed information about a file
func (a *App) GetFileDetails(filePath string) FileInfo {
	fileInfo, err := a.filesystem.GetFileInfo(filePath)
	if err != nil {
		logPrintf("Error getting file details: %v", err)
		return FileInfo{}
	}
	return fileInfo
}

// File Operations

// OpenFile opens a file with its default application
func (a *App) OpenFile(filePath string) bool {
	return a.fileOps.OpenFile(filePath)
}

// OpenInSystemExplorer opens the path in system file manager
func (a *App) OpenInSystemExplorer(path string) bool {
	return a.platform.OpenInSystemExplorer(path)
}

// CopyFiles copies files to destination directory
func (a *App) CopyFiles(sourcePaths []string, destDir string) bool {
	return a.fileOps.CopyFiles(sourcePaths, destDir)
}

// MoveFiles moves files to destination directory
func (a *App) MoveFiles(sourcePaths []string, destDir string) bool {
	return a.fileOps.MoveFiles(sourcePaths, destDir)
}

// DeleteFiles permanently deletes files
func (a *App) DeleteFiles(filePaths []string) bool {
	return a.fileOps.DeleteFiles(filePaths)
}

// MoveFilesToRecycleBin moves files to the system recycle bin/trash
func (a *App) MoveFilesToRecycleBin(filePaths []string) bool {
	return a.fileOps.MoveFilesToRecycleBin(filePaths)
}

// RenameFile renames a file or directory
func (a *App) RenameFile(oldPath, newName string) bool {
	return a.fileOps.RenameFile(oldPath, newName)
}

// HideFiles sets the hidden attribute on the specified files
func (a *App) HideFiles(filePaths []string) bool {
	return a.fileOps.HideFiles(filePaths)
}

// CreateDirectory creates a new directory
func (a *App) CreateDirectory(path, name string) NavigationResponse {
	return a.filesystem.CreateDirectory(path, name)
}

// DeletePath deletes a file or directory (alias for compatibility)
func (a *App) DeletePath(path string) NavigationResponse {
	success := a.fileOps.DeleteFiles([]string{path})
	if success {
		return NavigationResponse{
			Success: true,
			Message: "Item deleted successfully",
		}
	}
	return NavigationResponse{
		Success: false,
		Message: "Failed to delete item",
	}
}

// GetDriveInfo returns information about system drives
func (a *App) GetDriveInfo() []DriveInfo {
	a.drivesOnce.Do(func() {
		a.drives = NewDriveManager()
	})
	return a.drives.GetDriveInfo()
}

// Terminal Operations

// OpenPowerShellHere opens PowerShell in the specified directory
func (a *App) OpenPowerShellHere(directoryPath string) bool {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	return a.terminal.OpenPowerShellHere(directoryPath)
}

// Utility Methods

// FormatFileSize formats file size in human readable format
func (a *App) FormatFileSize(size int64) string {
	return a.platform.FormatFileSize(size)
}

// GetQuickAccessPaths returns commonly accessed directories
func (a *App) GetQuickAccessPaths() []DriveInfo {
	a.drivesOnce.Do(func() {
		a.drives = NewDriveManager()
	})
	return a.drives.GetQuickAccessPaths()
}

// OpenTerminalHere opens the system's default terminal in the specified directory
func (a *App) OpenTerminalHere(directoryPath string) bool {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	return a.terminal.OpenTerminalHere(directoryPath)
}

// GetAvailableTerminals returns a list of available terminal applications
func (a *App) GetAvailableTerminals() []string {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	return a.terminal.GetAvailableTerminals()
}

// ValidatePath validates if a path exists and is accessible
func (a *App) ValidatePath(path string) bool {
	err := a.filesystem.ValidatePath(path)
	return err == nil
}

// FileExists checks if a file exists
func (a *App) FileExists(path string) bool {
	return a.filesystem.FileExists(path)
}

// IsHidden checks if a file or directory is hidden
func (a *App) IsHidden(path string) bool {
	return a.platform.IsHidden(path)
}

// ExecuteCommand executes a command in the specified working directory
func (a *App) ExecuteCommand(command string, workingDir string) bool {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	err := a.terminal.ExecuteCommand(command, workingDir)
	return err == nil
}

// CopyFilePathsToClipboard places the given absolute file paths on the OS clipboard
func (a *App) CopyFilePathsToClipboard(paths []string) bool {
	return a.platform.SetClipboardFilePaths(paths)
}

// StreamDirectory begins directory enumeration in a separate goroutine so that
// the frontend call returns immediately. This prevents large directories from
// blocking the JS ↔ Go bridge and noticeably improves perceived performance
// during navigation.
func (a *App) StreamDirectory(dir string) {
	if fsManager, ok := a.filesystem.(*FileSystemManager); ok {
		// Launch the potentially-expensive enumeration in its own goroutine so
		// the bridge call returns right away. The event-based architecture
		// (DirectoryStart/Batch/Complete) already carries all required data
		// back to the frontend, so it is safe to detach here.
		go fsManager.StreamDirectory(dir)
	}
}

// HealthCheck returns application health status
func (a *App) HealthCheck() map[string]interface{} {
	return map[string]interface{}{
		"status":  "healthy",
		"version": "2.0-simplified",
		"ready":   true,
	}
}

// EjectDrive safely ejects a drive using OS-specific methods
func (a *App) EjectDrive(drivePath string) bool {
	log.Printf("🔄 EjectDrive called for: %s", drivePath)

	// Validate input
	if drivePath == "" {
		log.Printf("❌ EjectDrive: empty drive path provided")
		return false
	}

	// Use platform-specific implementation
	switch runtime.GOOS {
	case "windows":
		return a.platform.EjectDriveWindows(drivePath)
	case "darwin":
		// macOS implementation could be added here
		log.Printf("⚠️ EjectDrive: macOS implementation not available")
		return false
	case "linux":
		// Linux implementation could be added here
		log.Printf("⚠️ EjectDrive: Linux implementation not available")
		return false
	default:
		log.Printf("❌ EjectDrive: unsupported platform %s", runtime.GOOS)
		return false
	}
}

// ShowDriveProperties shows drive properties using OS-specific methods
func (a *App) ShowDriveProperties(drivePath string) bool {
	log.Printf("🔄 ShowDriveProperties called for: %s", drivePath)

	// For now, just open the drive in system explorer as properties dialog is complex
	// In a full implementation, you would show a custom properties dialog
	return a.platform.OpenInSystemExplorer(drivePath)
}

// GetContext exposes the internal context for use in main.go (e.g., bringing window to front).
func (a *App) GetContext() context.Context {
	return a.ctx
}

// Settings Management Methods

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
