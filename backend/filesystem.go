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

// ListDirectory lists the contents of a directory with streaming optimization
func (fs *FileSystemManager) ListDirectory(path string) NavigationResponse {
	startTime := time.Now()
	log.Printf("📂 Listing directory with streaming: %s", path)

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

	// Use optimized enumeration
	basicEntries, err := listDirectoryBasic(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Cannot read directory: %v", err),
		}
	}

	// Filter out skipped files
	var filteredEntries []BasicEntry
	for _, entry := range basicEntries {
		if !fs.shouldSkipFile(entry.Name) {
			filteredEntries = append(filteredEntries, entry)
		}
	}

	// Split into first page and rest for background processing
	const pageSize = 100
	firstPage := filteredEntries
	var rest []BasicEntry

	if len(filteredEntries) > pageSize {
		firstPage = filteredEntries[:pageSize]
		rest = filteredEntries[pageSize:]
	}

	// Convert first page to FileInfo with minimal data
	files := make([]FileInfo, 0, pageSize/2)
	directories := make([]FileInfo, 0, pageSize/2)

	for _, entry := range firstPage {
		// Create minimal FileInfo for immediate display
		fileInfo := FileInfo{
			Name:        entry.Name,
			Path:        entry.Path,
			IsDir:       entry.IsDir,
			Extension:   entry.Extension,
			IsHidden:    entry.IsHidden,
			Size:        0,           // Defer size calculation
			ModTime:     time.Time{}, // Defer mod time
			Permissions: "",          // Defer permissions
		}

		if entry.IsDir {
			directories = append(directories, fileInfo)
		} else {
			files = append(files, fileInfo)
		}
	}

	// Sort first page for immediate display
	sort.Slice(directories, func(i, j int) bool {
		return strings.ToLower(directories[i].Name) < strings.ToLower(directories[j].Name)
	})
	sort.Slice(files, func(i, j int) bool {
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	// Get parent path
	parentPath := filepath.Dir(path)
	if parentPath == path {
		parentPath = ""
	}

	// Build immediate response
	contents := DirectoryContents{
		CurrentPath: path,
		ParentPath:  parentPath,
		Files:       files,
		Directories: directories,
		TotalFiles:  len(files),
		TotalDirs:   len(directories),
	}

	// Start background hydration if we have remaining entries
	if len(rest) > 0 {
		go fs.hydrateRemainingEntries(path, rest)
	}

	processingTime := time.Since(startTime)
	log.Printf("✅ First page listed in %v: %s (%d dirs, %d files, %d deferred)",
		processingTime, path, len(directories), len(files), len(rest))

	return NavigationResponse{
		Success: true,
		Message: fmt.Sprintf("Directory listed (first page) in %v", processingTime),
		Data:    contents,
	}
}

// hydrateRemainingEntries processes remaining entries in background
func (fs *FileSystemManager) hydrateRemainingEntries(basePath string, entries []BasicEntry) {
	log.Printf("🔄 Starting background hydration for %d entries", len(entries))

	for _, entry := range entries {
		// Get full file info with stat data
		info, err := os.Stat(entry.Path)
		if err != nil {
			log.Printf("⚠️ Failed to stat %s: %v", entry.Path, err)
			continue
		}

		// Create complete FileInfo
		fileInfo := FileInfo{
			Name:        entry.Name,
			Path:        entry.Path,
			IsDir:       entry.IsDir,
			Size:        info.Size(),
			ModTime:     info.ModTime(),
			Permissions: info.Mode().String(),
			Extension:   entry.Extension,
			IsHidden:    entry.IsHidden,
		}

		// Emit hydration event to frontend
		if fs.eventEmitter != nil {
			fs.eventEmitter.EmitDirectoryHydrate(fileInfo)
		}
	}

	// Emit completion event
	if fs.eventEmitter != nil {
		fs.eventEmitter.EmitDirectoryComplete(basePath, len(entries), 0)
	}

	log.Printf("✅ Background hydration completed for %s", basePath)
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

// processEntriesConcurrent processes directory entries concurrently with worker pool
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

// CreateDirectory creates a new directory
func (fs *FileSystemManager) CreateDirectory(path, name string) NavigationResponse {
	fullPath := filepath.Join(path, name)

	err := os.MkdirAll(fullPath, 0755)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to create directory: %v", err),
		}
	}

	log.Printf("📁 Directory created: %s", fullPath)
	return NavigationResponse{
		Success: true,
		Message: "Directory created successfully",
	}
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
