package backend

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
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

// ListDirectory lists the contents of a directory with Windows-optimized streaming
func (fs *FileSystemManager) ListDirectory(path string) NavigationResponse {
	startTime := time.Now()
	log.Printf("📂 Listing directory with Windows-optimized streaming: %s", path)

	if path == "" {
		path = fs.platform.GetHomeDirectory()
	}

	// Clean and validate path
	path = filepath.Clean(path)

	// Quick existence check first
	info, err := os.Stat(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Cannot access path: %v", err),
		}
	}

	if !info.IsDir() {
		return NavigationResponse{
			Success: false,
			Message: "Path is not a directory",
		}
	}

	// Get parent path
	parentPath := filepath.Dir(path)
	if parentPath == path {
		parentPath = ""
	}

	// Use Windows-optimized enhanced directory listing with FindFirstFileExW
	enhancedEntries, err := listDirectoryBasicEnhanced(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Cannot read directory: %v", err),
		}
	}

	log.Printf("🚀 Using Windows enhanced directory listing for %s", path)

	// Filter out skipped files
	var filteredEntries []EnhancedBasicEntry
	for _, entry := range enhancedEntries {
		if !fs.shouldSkipFile(entry.Name) {
			filteredEntries = append(filteredEntries, entry)
		}
	}

	// Split into first page and rest for background processing
	const pageSize = 100
	firstPage := filteredEntries
	var rest []EnhancedBasicEntry

	if len(filteredEntries) > pageSize {
		firstPage = filteredEntries[:pageSize]
		rest = filteredEntries[pageSize:]
	}

	// Convert first page to FileInfo - NO ADDITIONAL STAT CALLS NEEDED!
	files := make([]FileInfo, 0, pageSize/2)
	directories := make([]FileInfo, 0, pageSize/2)

	for _, entry := range firstPage {
		// Create FileInfo directly from enhanced entry data - no stat() needed!
		fileInfo := FileInfo{
			Name:        entry.Name,
			Path:        entry.Path,
			IsDir:       entry.IsDir,
			Extension:   entry.Extension,
			IsHidden:    entry.IsHidden,
			Size:        entry.Size,
			ModTime:     time.Unix(entry.ModTime, 0),
			Permissions: entry.Permissions,
		}

		// Debug log to verify file sizes are being calculated
		if !entry.IsDir && entry.Size > 0 {
			log.Printf("📊 File size from Windows enhanced listing: %s = %d bytes", entry.Name, entry.Size)
		}

		if entry.IsDir {
			directories = append(directories, fileInfo)
		} else {
			files = append(files, fileInfo)
		}
	}

	// Start background hydration for remaining enhanced entries
	if len(rest) > 0 {
		go func(entries []EnhancedBasicEntry) {
			// Give UI a chance to render first
			time.Sleep(200 * time.Millisecond)
			fs.hydrateRemainingEntriesEnhanced(path, entries)
		}(rest)
	}

	// Sort first page for immediate display with precomputed keys
	sort.Slice(directories, func(i, j int) bool {
		return directories[i].Name < directories[j].Name // Already sorted by Windows API
	})
	sort.Slice(files, func(i, j int) bool {
		return files[i].Name < files[j].Name // Already sorted by Windows API
	})

	// Build immediate response
	contents := DirectoryContents{
		CurrentPath: path,
		ParentPath:  parentPath,
		Files:       files,
		Directories: directories,
		TotalFiles:  len(files),
		TotalDirs:   len(directories),
	}

	processingTime := time.Since(startTime)
	log.Printf("✅ Windows enhanced first page listed in %v: %s (%d dirs, %d files, %d deferred)",
		processingTime, path, len(directories), len(files), len(rest))

	return NavigationResponse{
		Success: true,
		Message: fmt.Sprintf("Directory listed (Windows enhanced) in %v", processingTime),
		Data:    contents,
	}
}

// hydrateRemainingEntriesEnhanced processes remaining enhanced entries in background with batching
// These entries already have full file information, so no additional stat calls needed
func (fs *FileSystemManager) hydrateRemainingEntriesEnhanced(basePath string, entries []EnhancedBasicEntry) {
	log.Printf("🔄 Starting enhanced background hydration for %d entries with batching", len(entries))

	const batchSize = 50 // Process 50 files at a time to reduce frontend state updates

	for i := 0; i < len(entries); i += batchSize {
		end := i + batchSize
		if end > len(entries) {
			end = len(entries)
		}

		// Create batch of FileInfo entries
		batch := make([]FileInfo, 0, end-i)
		for j := i; j < end; j++ {
			entry := entries[j]

			// Create FileInfo directly from enhanced entry - no stat needed!
			fileInfo := FileInfo{
				Name:        entry.Name,
				Path:        entry.Path,
				IsDir:       entry.IsDir,
				Size:        entry.Size,
				ModTime:     time.Unix(entry.ModTime, 0),
				Permissions: entry.Permissions,
				Extension:   entry.Extension,
				IsHidden:    entry.IsHidden,
			}

			batch = append(batch, fileInfo)
		}

		// Emit batch to frontend
		if fs.eventEmitter != nil {
			fs.eventEmitter.EmitDirectoryBatch(batch)
		}

		// Small delay between batches to allow UI to update
		time.Sleep(50 * time.Millisecond)
	}

	// Emit completion event
	if fs.eventEmitter != nil {
		fs.eventEmitter.EmitDirectoryComplete(basePath, len(entries), 0)
	}

	log.Printf("✅ Enhanced background hydration completed for %s with %d batches", basePath, (len(entries)+batchSize-1)/batchSize)
}

// processEntriesSync processes directory entries synchronously with optimizations
func (fs *FileSystemManager) processEntriesSync(path string, entries []os.DirEntry, files, directories []FileInfo) ([]FileInfo, []FileInfo) {
	for _, entry := range entries {
		// Skip processing certain system files early for performance
		name := entry.Name()
		if fs.shouldSkipFile(name) {
			continue
		}

		fileInfo := fs.CreateFileInfoOptimized(path, name, entry)

		if fileInfo.IsDir {
			directories = append(directories, fileInfo)
		} else {
			files = append(files, fileInfo)
		}
	}
	return files, directories
}

// processEntriesConcurrent processes directory entries concurrently with worker pool (legacy - not used with Windows enhanced listing)
func (fs *FileSystemManager) processEntriesConcurrent(path string, entries []os.DirEntry) ([]FileInfo, []FileInfo) {
	// Optimized worker pool size based on entry count and CPU cores
	numWorkers := 6 // Sweet spot for most systems
	if len(entries) < 200 {
		numWorkers = 3
	}

	type workItem struct {
		entry os.DirEntry
		index int
	}

	type result struct {
		fileInfo FileInfo
		isDir    bool
		index    int
	}

	entryChan := make(chan workItem, len(entries))
	resultChan := make(chan result, len(entries))

	// Start worker goroutines
	var wg sync.WaitGroup
	for i := 0; i < numWorkers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for item := range entryChan {
				// Skip certain files early
				if fs.shouldSkipFile(item.entry.Name()) {
					continue
				}

				fileInfo := fs.CreateFileInfoOptimized(path, item.entry.Name(), item.entry)
				resultChan <- result{
					fileInfo: fileInfo,
					isDir:    fileInfo.IsDir,
					index:    item.index,
				}
			}
		}()
	}

	// Send work items
	go func() {
		defer close(entryChan)
		for i, entry := range entries {
			entryChan <- workItem{entry: entry, index: i}
		}
	}()

	// Close result channel when all workers are done
	go func() {
		wg.Wait()
		close(resultChan)
	}()

	// Collect results
	files := make([]FileInfo, 0, len(entries)/2)
	directories := make([]FileInfo, 0, len(entries)/2)

	for res := range resultChan {
		if res.isDir {
			directories = append(directories, res.fileInfo)
		} else {
			files = append(files, res.fileInfo)
		}
	}

	return files, directories
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

// CreateFileInfoOptimized creates FileInfo with performance optimizations
func (fs *FileSystemManager) CreateFileInfoOptimized(basePath string, name string, entry os.DirEntry) FileInfo {
	fullPath := filepath.Join(basePath, name)

	// Use DirEntry info when possible to avoid extra stat calls
	var info os.FileInfo
	var err error

	if entry != nil {
		info, err = entry.Info()
	} else {
		info, err = os.Stat(fullPath)
	}

	if err != nil {
		log.Printf("Warning: Error getting file info for %s: %v", fullPath, err)
		// Return basic info even on error
		return FileInfo{
			Name:     name,
			Path:     fullPath,
			IsDir:    entry != nil && entry.IsDir(),
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

// CreateFileInfo creates FileInfo from file path and name (backward compatibility)
func (fs *FileSystemManager) CreateFileInfo(basePath string, name string) FileInfo {
	return fs.CreateFileInfoOptimized(basePath, name, nil)
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

// IsHidden checks if a file/directory is hidden
func (fs *FileSystemManager) IsHidden(path string) bool {
	return fs.platform.IsHidden(path)
}

// GetExtension returns the file extension
func (fs *FileSystemManager) GetExtension(name string) string {
	return fs.platform.GetExtension(name)
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
