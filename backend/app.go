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

	app := &App{
		filesystem:    filesystem,
		fileOps:       fileOps,
		platform:      platform,
		drives:        drives,
		terminal:      terminal,
		serialization: GetSerializationUtils(),
	}

	return app
}

// Startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Set context on filesystem manager for event emission
	if fsManager, ok := a.filesystem.(*FileSystemManager); ok {
		fsManager.SetContext(ctx)
	}

	log.Println("🚀 Lightning Explorer backend started with modular architecture")
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

// NavigateToPath - DEPRECATED: Use NavigateToPathOptimized (MessagePack) instead
func (a *App) NavigateToPath(path string) NavigationResponse {
	log.Printf("⚠️ DEPRECATED API called: NavigateToPath - Use NavigateToPathOptimized instead")
	return a.filesystem.NavigateToPath(path)
}

// NavigateUp - DEPRECATED: Use NavigateToPathOptimized (MessagePack) instead
func (a *App) NavigateUp(currentPath string) NavigationResponse {
	log.Printf("⚠️ DEPRECATED API called: NavigateUp - Use NavigateToPathOptimized instead")
	return a.filesystem.NavigateUp(currentPath)
}

// ListDirectory - DEPRECATED: Use ListDirectoryOptimized (MessagePack) instead
func (a *App) ListDirectory(path string) NavigationResponse {
	log.Printf("⚠️ DEPRECATED API called: ListDirectory - Use ListDirectoryOptimized instead")
	return a.filesystem.ListDirectory(path)
}

// GetFileDetails - DEPRECATED: Use GetFileDetailsOptimized (MessagePack) instead
func (a *App) GetFileDetails(filePath string) FileInfo {
	log.Printf("⚠️ DEPRECATED API called: GetFileDetails - Use GetFileDetailsOptimized instead")
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

// GetDriveInfo - DEPRECATED: Use GetDriveInfoOptimized (MessagePack) instead
func (a *App) GetDriveInfo() []map[string]interface{} {
	log.Printf("⚠️ DEPRECATED API called: GetDriveInfo - Use GetDriveInfoOptimized instead")
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

// Enhanced API methods with MessagePack support

// NavigateToPathOptimized returns navigation data using MessagePack encoding
func (a *App) NavigateToPathOptimized(path string) interface{} {
	response := a.filesystem.NavigateToPath(path)

	// Log size comparison for performance monitoring
	LogSerializationComparison(response, "NavigateToPath")

	serialized, err := a.serialization.SerializeNavigationResponse(response)
	if err != nil {
		log.Printf("❌ Serialization error: %v", err)
		return response // Fall back to regular JSON
	}

	return serialized
}

// ListDirectoryOptimized returns directory listing using MessagePack encoding
func (a *App) ListDirectoryOptimized(path string) interface{} {
	response := a.filesystem.ListDirectory(path)

	// Log size comparison for performance monitoring
	LogSerializationComparison(response, "ListDirectory")

	serialized, err := a.serialization.SerializeNavigationResponse(response)
	if err != nil {
		log.Printf("❌ Serialization error: %v", err)
		return response // Fall back to regular JSON
	}

	return serialized
}

// GetFileDetailsOptimized returns file details using MessagePack encoding
func (a *App) GetFileDetailsOptimized(filePath string) interface{} {
	fileInfo, err := a.filesystem.GetFileInfo(filePath)
	if err != nil {
		log.Printf("Error getting file details: %v", err)
		return FileInfo{}
	}

	// Log size comparison for performance monitoring
	LogSerializationComparison(fileInfo, "FileInfo")

	serialized, serializeErr := a.serialization.SerializeFileInfo(fileInfo)
	if serializeErr != nil {
		log.Printf("❌ Serialization error: %v", serializeErr)
		return fileInfo // Fall back to regular JSON
	}

	return serialized
}

// GetDriveInfoOptimized returns drive information using MessagePack encoding
func (a *App) GetDriveInfoOptimized() interface{} {
	drives := a.drives.GetDriveInfo()

	// Log size comparison for performance monitoring
	LogSerializationComparison(drives, "DriveInfo")

	serialized, err := a.serialization.SerializeDriveInfoSlice(drives)
	if err != nil {
		log.Printf("❌ Serialization error: %v", err)
		// Fall back to legacy format
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

	return serialized
}

// SetSerializationMode forces MessagePack Base64 mode only - no JSON allowed
func (a *App) SetSerializationMode(mode int) bool {
	// FORCE MessagePack Base64 mode only - reject any other modes
	if mode != 2 {
		log.Printf("❌ Rejected serialization mode %d - only MessagePack Base64 (mode 2) is allowed", mode)
		return false
	}

	SetSerializationMode(SerializationMsgPackBase64)
	log.Println("🔄 Confirmed MessagePack Base64 serialization mode (forced)")
	return true
}

// GetSerializationMode always returns MessagePack Base64 mode (forced)
func (a *App) GetSerializationMode() int {
	// Always return MessagePack Base64 mode - no other modes allowed
	return 2 // SerializationMsgPackBase64
}

// BenchmarkSerialization runs a benchmark comparison between JSON and MessagePack
func (a *App) BenchmarkSerialization(path string) map[string]interface{} {
	response := a.filesystem.ListDirectory(path)

	if !response.Success {
		return map[string]interface{}{
			"error": "Failed to read directory for benchmark",
		}
	}

	sizes := BenchmarkSerializationSizes(response)

	result := map[string]interface{}{
		"path":        path,
		"sizes":       sizes,
		"files_count": response.Data.TotalFiles,
		"dirs_count":  response.Data.TotalDirs,
	}

	if jsonSize, exists := sizes["json"]; exists {
		if msgPackSize, exists := sizes["msgpack"]; exists {
			reduction := float64(jsonSize-msgPackSize) / float64(jsonSize) * 100
			result["size_reduction_percent"] = reduction
			result["msgpack_advantage"] = reduction > 0
		}
	}

	log.Printf("📊 Serialization benchmark for %s completed", path)
	return result
}
