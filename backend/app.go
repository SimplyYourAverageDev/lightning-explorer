package backend

import (
	"context"
)

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

	logPrintln("🚀 Lightning Explorer backend started")
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

// HealthCheck returns application health status
func (a *App) HealthCheck() map[string]interface{} {
	return map[string]interface{}{
		"status":  "healthy",
		"version": "2.0-simplified",
		"ready":   true,
	}
}
