package backend

import (
	"context"
	"log"
)

// NewApp creates a new App application struct with dependency injection
func NewApp() *App {
	// Create all manager instances
	platform := NewPlatformManager()
	filesystem := NewFileSystemManager(platform)
	fileOps := NewFileOperationsManager(platform)
	drives := NewDriveManager()
	terminal := NewTerminalManager()

	return &App{
		filesystem: filesystem,
		fileOps:    fileOps,
		platform:   platform,
		drives:     drives,
		terminal:   terminal,
	}
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Set context on filesystem manager for event emission
	if fsManager, ok := a.filesystem.(*FileSystemManager); ok {
		fsManager.SetContext(ctx)
	}

	log.Println("🚀 Blueprint File Explorer backend started with modular architecture")
}

// API Methods for Wails Frontend

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

// NavigateToPath navigates to a specific path
func (a *App) NavigateToPath(path string) NavigationResponse {
	return a.filesystem.NavigateToPath(path)
}

// NavigateUp navigates to the parent directory
func (a *App) NavigateUp(currentPath string) NavigationResponse {
	return a.filesystem.NavigateUp(currentPath)
}

// ListDirectory lists the contents of a directory
func (a *App) ListDirectory(path string) NavigationResponse {
	return a.filesystem.ListDirectory(path)
}

// GetFileDetails returns detailed information about a file
func (a *App) GetFileDetails(filePath string) FileInfo {
	fileInfo, err := a.filesystem.GetFileInfo(filePath)
	if err != nil {
		log.Printf("Error getting file details: %v", err)
		return FileInfo{}
	}
	return fileInfo
}

// OpenFile opens a file with its default application
func (a *App) OpenFile(filePath string) bool {
	return a.fileOps.OpenFile(filePath)
}

// OpenInSystemExplorer opens the given path in the system's default file manager
func (a *App) OpenInSystemExplorer(path string) bool {
	return a.platform.OpenInSystemExplorer(path)
}

// CopyFiles copies files from source paths to destination directory
func (a *App) CopyFiles(sourcePaths []string, destDir string) bool {
	return a.fileOps.CopyFiles(sourcePaths, destDir)
}

// MoveFiles moves files from source paths to destination directory
func (a *App) MoveFiles(sourcePaths []string, destDir string) bool {
	return a.fileOps.MoveFiles(sourcePaths, destDir)
}

// DeleteFiles permanently deletes the specified files and directories
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

// GetDriveInfo returns information about available drives
func (a *App) GetDriveInfo() []map[string]interface{} {
	drives := a.drives.GetDriveInfo()

	// Convert to the expected format for backward compatibility
	var result []map[string]interface{}
	for _, drive := range drives {
		result = append(result, map[string]interface{}{
			"path":   drive.Path,
			"letter": drive.Letter,
			"name":   drive.Name,
		})
	}

	return result
}

// OpenPowerShellHere opens PowerShell 7 in the specified directory
func (a *App) OpenPowerShellHere(directoryPath string) bool {
	return a.terminal.OpenPowerShellHere(directoryPath)
}

// FormatFileSize formats file size in human readable format
func (a *App) FormatFileSize(size int64) string {
	return a.platform.FormatFileSize(size)
}

// Additional API methods for enhanced functionality

// GetQuickAccessPaths returns commonly accessed directories for quick navigation
func (a *App) GetQuickAccessPaths() []map[string]interface{} {
	paths := a.drives.GetQuickAccessPaths()

	var result []map[string]interface{}
	for _, path := range paths {
		result = append(result, map[string]interface{}{
			"path":   path.Path,
			"letter": path.Letter,
			"name":   path.Name,
		})
	}

	return result
}

// OpenTerminalHere opens the system's default terminal in the specified directory
func (a *App) OpenTerminalHere(directoryPath string) bool {
	return a.terminal.OpenTerminalHere(directoryPath)
}

// GetAvailableTerminals returns a list of available terminal applications
func (a *App) GetAvailableTerminals() []string {
	return a.terminal.GetAvailableTerminals()
}

// ValidatePath checks if a path is valid and accessible
func (a *App) ValidatePath(path string) bool {
	err := a.filesystem.ValidatePath(path)
	return err == nil
}

// FileExists checks if a file exists
func (a *App) FileExists(path string) bool {
	return a.filesystem.FileExists(path)
}

// IsHidden checks if a file/directory is hidden
func (a *App) IsHidden(path string) bool {
	return a.platform.IsHidden(path)
}

// ExecuteCommand executes a command in the background (useful for scripts)
func (a *App) ExecuteCommand(command string, workingDir string) bool {
	err := a.terminal.ExecuteCommand(command, workingDir)
	return err == nil
}

// Health check method for monitoring
func (a *App) HealthCheck() map[string]interface{} {
	return map[string]interface{}{
		"status":  "healthy",
		"modules": []string{"filesystem", "fileops", "platform", "drives", "terminal"},
	}
}

// PrefetchDirectory pre-loads directory contents for faster navigation
// This method is called when hovering over folders to improve perceived performance
func (a *App) PrefetchDirectory(path string) NavigationResponse {
	// Use the same method as NavigateToPath but mark it as prefetch for logging
	log.Printf("🔄 Prefetching directory: %s", path)

	response := a.filesystem.ListDirectory(path)

	if response.Success {
		log.Printf("✅ Prefetched directory %s: %d files, %d dirs",
			path, response.Data.TotalFiles, response.Data.TotalDirs)
	} else {
		log.Printf("❌ Failed to prefetch directory %s: %s", path, response.Message)
	}

	return response
}
