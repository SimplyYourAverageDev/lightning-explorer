package backend

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

// NewFileSystemManager creates a new filesystem manager instance
func NewFileSystemManager(platform PlatformManagerInterface) *FileSystemManager {
	return &FileSystemManager{
		platform: platform,
	}
}

// SetContext sets the Wails context for event emission
func (fs *FileSystemManager) SetContext(ctx context.Context) {
	fs.ctx = ctx
	fs.eventEmitter = NewEventEmitter(ctx)
}

// ListDirectory lists the contents of a directory with Windows-optimized streaming and concurrency
func (fs *FileSystemManager) ListDirectory(path string) NavigationResponse {
	startTime := time.Now()
	log.Printf("📂 Listing directory with concurrent processing: %s", path)

	if path == "" {
		path = fs.platform.GetHomeDirectory()
	}

	path = filepath.Clean(path)

	info, err := os.Stat(path)
	if err != nil {
		return NavigationResponse{Success: false, Message: fmt.Sprintf("Cannot access path: %v", err)}
	}
	if !info.IsDir() {
		return NavigationResponse{Success: false, Message: "Path is not a directory"}
	}

	parentPath := filepath.Dir(path)
	if parentPath == path {
		parentPath = ""
	}

	// Use our highly optimized concurrent directory listing
	allEntries, err := fs.listDirectoryConcurrent(path)
	if err != nil {
		return NavigationResponse{Success: false, Message: fmt.Sprintf("Cannot read directory: %v", err)}
	}

	// Separate into directories and files
	var files, directories []FileInfo
	for _, entry := range allEntries {
		if entry.IsDir {
			directories = append(directories, entry)
		} else {
			files = append(files, entry)
		}
	}

	contents := DirectoryContents{
		CurrentPath: path,
		ParentPath:  parentPath,
		Files:       files,
		Directories: directories,
		TotalFiles:  len(files),
		TotalDirs:   len(directories),
	}

	processingTime := time.Since(startTime)
	log.Printf("✅ Concurrently listed in %v: %s (%d dirs, %d files)",
		processingTime, path, len(directories), len(files))

	return NavigationResponse{
		Success: true,
		Message: fmt.Sprintf("Directory listed concurrently in %v", processingTime),
		Data:    contents,
	}
}

// listDirectoryConcurrent performs a directory listing using a worker pool for concurrency
func (fs *FileSystemManager) listDirectoryConcurrent(path string) ([]FileInfo, error) {
	// Use Windows-optimized raw listing first
	rawEntries, err := listDirectoryBasicEnhanced(path)
	if err != nil {
		return nil, err
	}

	// Setup worker pool - adjust number of workers based on CPU cores
	numWorkers := runtime.NumCPU()
	if numWorkers > 4 {
		numWorkers = 4 // Cap at 4 workers to avoid excessive I/O contention
	}
	pool := NewWorkerPool(numWorkers)
	pool.Start()

	results := make(chan FileInfo, len(rawEntries))
	var wg sync.WaitGroup

	for _, entry := range rawEntries {
		if fs.shouldSkipFile(entry.Name) {
			continue
		}

		wg.Add(1)
		jobEntry := entry // Capture loop variable
		pool.Submit(Job{
			Execute: func() {
				defer wg.Done()
				// The "enhanced" entry already contains all necessary info.
				// No extra 'stat' call is needed here.
				fileInfo := FileInfo{
					Name:        jobEntry.Name,
					Path:        jobEntry.Path,
					IsDir:       jobEntry.IsDir,
					Size:        jobEntry.Size,
					ModTime:     time.Unix(jobEntry.ModTime, 0),
					Permissions: jobEntry.Permissions,
					Extension:   jobEntry.Extension,
					IsHidden:    jobEntry.IsHidden,
				}
				results <- fileInfo
			},
		})
	}

	// Wait for all jobs to finish, then close the results channel
	go func() {
		wg.Wait()
		close(results)
	}()

	// Collect results
	var allFiles []FileInfo
	for fileInfo := range results {
		allFiles = append(allFiles, fileInfo)
	}

	pool.Wait() // Ensure worker pool is cleaned up

	return allFiles, nil
}

// IsHidden checks if a file is hidden
func (fs *FileSystemManager) IsHidden(path string) bool {
	return fs.platform.IsHidden(path)
}

// GetExtension returns the file extension
func (fs *FileSystemManager) GetExtension(name string) string {
	return fs.platform.GetExtension(name)
}

// CreateFileInfo creates FileInfo from file path and name (backward compatibility)
func (fs *FileSystemManager) CreateFileInfo(basePath string, name string) FileInfo {
	fullPath := filepath.Join(basePath, name)
	info, err := os.Stat(fullPath)
	if err != nil {
		log.Printf("Warning: Error getting file info for %s: %v", fullPath, err)
		// Return basic info even on error
		return FileInfo{
			Name:     name,
			Path:     fullPath,
			IsDir:    false, // Assume not a directory on error
			IsHidden: fs.platform.IsHidden(fullPath),
		}
	}

	return FileInfo{
		Name:        name,
		Path:        fullPath,
		IsDir:       info.IsDir(),
		Size:        info.Size(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().String(),
		Extension:   fs.platform.GetExtension(name),
		IsHidden:    fs.platform.IsHidden(fullPath),
	}
}

// shouldSkipFile determines if a file should be skipped for performance
func (fs *FileSystemManager) shouldSkipFile(name string) bool {
	// Skip certain system files that are typically not needed
	skipPatterns := []string{
		"$RECYCLE.BIN",
		"System Volume Information",
		"pagefile.sys",
		"hiberfil.sys",
		"swapfile.sys",
		".DS_Store",
		".Trashes",
		".Spotlight-V100",
	}

	for _, pattern := range skipPatterns {
		if strings.EqualFold(name, pattern) {
			return true
		}
	}

	return false
}

// GetFileInfo returns detailed information about a specific file
func (fs *FileSystemManager) GetFileInfo(filePath string) (FileInfo, error) {
	log.Printf("Getting file details for: %s", filePath)

	info, err := os.Stat(filePath)
	if err != nil {
		log.Printf("Error getting file details: %v", err)
		return FileInfo{}, err
	}

	return FileInfo{
		Name:        filepath.Base(filePath),
		Path:        filePath,
		IsDir:       info.IsDir(),
		Size:        info.Size(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().String(),
		Extension:   fs.platform.GetExtension(filepath.Base(filePath)),
		IsHidden:    fs.platform.IsHidden(filePath),
	}, nil
}

// NavigateToPath navigates to a specific path with enhanced logging
func (fs *FileSystemManager) NavigateToPath(path string) NavigationResponse {
	log.Printf("🧭 Navigation request: %s", path)
	return fs.ListDirectory(path)
}

// NavigateUp navigates to the parent directory with path validation
func (fs *FileSystemManager) NavigateUp(currentPath string) NavigationResponse {
	if currentPath == "" {
		return NavigationResponse{
			Success: false,
			Message: "No current path provided",
		}
	}

	parentPath := filepath.Dir(currentPath)
	if parentPath == currentPath {
		// Already at root
		return NavigationResponse{
			Success: false,
			Message: "Already at root directory",
		}
	}

	log.Printf("⬆️ Navigate up: %s -> %s", currentPath, parentPath)
	return fs.ListDirectory(parentPath)
}

// FileExists checks if a file exists
func (fs *FileSystemManager) FileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// CreateDirectory creates a new directory with comprehensive security validation
func (fs *FileSystemManager) CreateDirectory(path, name string) NavigationResponse {
	// Input validation and sanitization
	if path == "" {
		return NavigationResponse{
			Success: false,
			Message: "Parent path cannot be empty",
		}
	}

	if name == "" {
		return NavigationResponse{
			Success: false,
			Message: "Directory name cannot be empty",
		}
	}

	// Sanitize and validate the directory name
	sanitizedName, err := fs.validateAndSanitizeFileName(name)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Invalid directory name: %v", err),
		}
	}

	// Clean and validate the parent path
	cleanPath := filepath.Clean(path)
	if !filepath.IsAbs(cleanPath) {
		return NavigationResponse{
			Success: false,
			Message: "Parent path must be absolute",
		}
	}

	// Construct the full path
	fullPath := filepath.Join(cleanPath, sanitizedName)

	// Security check: Ensure the new directory is within the parent directory
	if !fs.isPathWithinParent(fullPath, cleanPath) {
		return NavigationResponse{
			Success: false,
			Message: "Directory creation outside parent directory is not allowed",
		}
	}

	// Check if the directory already exists
	if fs.FileExists(fullPath) {
		return NavigationResponse{
			Success: false,
			Message: "Directory already exists",
		}
	}

	// Validate parent directory exists and is writable
	if err := fs.validateParentDirectory(cleanPath); err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Parent directory validation failed: %v", err),
		}
	}

	err = os.MkdirAll(fullPath, 0755)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to create directory: %v", err),
		}
	}

	log.Printf("📁 Directory created securely: %s", fullPath)
	return NavigationResponse{
		Success: true,
		Message: "Directory created successfully",
	}
}

// validateAndSanitizeFileName validates and sanitizes a filename/directory name
func (fs *FileSystemManager) validateAndSanitizeFileName(name string) (string, error) {
	// Remove leading/trailing whitespace
	name = strings.TrimSpace(name)

	if name == "" {
		return "", fmt.Errorf("name cannot be empty")
	}

	// Check for path traversal attempts
	if strings.Contains(name, "..") {
		return "", fmt.Errorf("path traversal sequences not allowed")
	}

	if strings.Contains(name, "/") || strings.Contains(name, "\\") {
		return "", fmt.Errorf("path separators not allowed in name")
	}

	// Check for reserved names (Windows)
	reservedNames := []string{
		"CON", "PRN", "AUX", "NUL",
		"COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
		"LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
	}

	upperName := strings.ToUpper(name)
	for _, reserved := range reservedNames {
		if upperName == reserved || strings.HasPrefix(upperName, reserved+".") {
			return "", fmt.Errorf("reserved name not allowed: %s", reserved)
		}
	}

	// Check for invalid characters
	invalidChars := []string{"<", ">", ":", "\"", "|", "?", "*"}
	for _, char := range invalidChars {
		if strings.Contains(name, char) {
			return "", fmt.Errorf("invalid character not allowed: %s", char)
		}
	}

	// Check length limits
	if len(name) > 255 {
		return "", fmt.Errorf("name too long (max 255 characters)")
	}

	// Check for names that are just dots or spaces
	if strings.Trim(name, ". ") == "" {
		return "", fmt.Errorf("name cannot consist only of dots and spaces")
	}

	return name, nil
}

// isPathWithinParent checks if childPath is within parentPath (prevents path traversal)
func (fs *FileSystemManager) isPathWithinParent(childPath, parentPath string) bool {
	// Clean both paths
	cleanChild := filepath.Clean(childPath)
	cleanParent := filepath.Clean(parentPath)

	// Get relative path from parent to child
	rel, err := filepath.Rel(cleanParent, cleanChild)
	if err != nil {
		return false
	}

	// If relative path starts with "..", it's outside the parent
	return !strings.HasPrefix(rel, "..") && rel != ".."
}

// validateParentDirectory validates that the parent directory exists and is writable
func (fs *FileSystemManager) validateParentDirectory(parentPath string) error {
	info, err := os.Stat(parentPath)
	if err != nil {
		if os.IsNotExist(err) {
			return fmt.Errorf("parent directory does not exist")
		}
		return fmt.Errorf("cannot access parent directory: %v", err)
	}

	if !info.IsDir() {
		return fmt.Errorf("parent path is not a directory")
	}

	// Test write permission by creating a temporary file
	tempFile := filepath.Join(parentPath, ".lightning_explorer_write_test")
	file, err := os.Create(tempFile)
	if err != nil {
		return fmt.Errorf("parent directory is not writable: %v", err)
	}
	file.Close()
	os.Remove(tempFile)

	return nil
}

// ValidatePath checks if a path is valid and accessible with optimized validation
func (fs *FileSystemManager) ValidatePath(path string) error {
	if path == "" {
		return fmt.Errorf("path cannot be empty")
	}

	info, err := os.Stat(path)
	if err != nil {
		return fmt.Errorf("cannot access path: %v", err)
	}

	if !info.IsDir() {
		return fmt.Errorf("path is not a directory")
	}

	return nil
}

// StreamDirectory streams directory entries in batches via DirectoryBatch events
func (fs *FileSystemManager) StreamDirectory(dir string) {
	if dir == "" {
		dir = fs.platform.GetHomeDirectory()
	}
	dir = filepath.Clean(dir)

	if fs.eventEmitter != nil {
		fs.eventEmitter.EmitDirectoryStart(dir)
	}

	// Validate path and ensure it's a directory
	info, err := os.Stat(dir)
	if err != nil {
		if fs.eventEmitter != nil {
			fs.eventEmitter.EmitDirectoryError("Cannot access path: " + err.Error())
		}
		return
	}
	if !info.IsDir() {
		if fs.eventEmitter != nil {
			fs.eventEmitter.EmitDirectoryError("Path is not a directory")
		}
		return
	}

	// Get all entries using the concurrent method
	allFiles, err := fs.listDirectoryConcurrent(dir)
	if err != nil {
		if fs.eventEmitter != nil {
			fs.eventEmitter.EmitDirectoryError("Cannot read directory: " + err.Error())
		}
		return
	}

	// Batch parameters
	const batchSize = 100
	totalFiles, totalDirs := 0, 0

	// Batch and emit the results
	for i := 0; i < len(allFiles); i += batchSize {
		end := i + batchSize
		if end > len(allFiles) {
			end = len(allFiles)
		}
		batch := allFiles[i:end]

		// Update counts for this batch
		for _, fi := range batch {
			if fi.IsDir {
				totalDirs++
			} else {
				totalFiles++
			}
		}

		fs.eventEmitter.EmitDirectoryBatch(batch)
	}

	// Emit completion event
	if fs.eventEmitter != nil {
		fs.eventEmitter.EmitDirectoryComplete(dir, totalFiles, totalDirs)
	}
}

