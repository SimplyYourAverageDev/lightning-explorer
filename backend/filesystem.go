package backend

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

const (
	streamBatchSize    = 128
	cacheSweepInterval = 2 * time.Minute
)

var wireBatchPool = sync.Pool{New: func() interface{} {
	slice := make([]WireEntry, 0, streamBatchSize)
	return &slice
}}

func NewFileSystemManager(platform PlatformManagerInterface) *FileSystemManager {
	return &FileSystemManager{
		platform: platform,
		dirCache: newLRUDirCache(256, 60*time.Second),
	}
}

func (fs *FileSystemManager) SetContext(ctx context.Context) {
	fs.ctx = ctx
	fs.eventEmitter = NewEventEmitter(ctx)
	fs.purgeOnce.Do(func() {
		go fs.cachePurgeLoop()
	})
}

func (fs *FileSystemManager) cachePurgeLoop() {
	ticker := time.NewTicker(cacheSweepInterval)
	defer ticker.Stop()
	for {
		select {
		case <-ticker.C:
			if fs.dirCache != nil {
				fs.dirCache.PurgeExpired()
			}
		case <-fs.ctx.Done():
			return
		}
	}
}

func (fs *FileSystemManager) SetShowHidden(includeHidden bool) {
	fs.showHidden = includeHidden
}

func (fs *FileSystemManager) ListDirectory(path string) NavigationResponse {
	startTime := time.Now()
	logPrintf("?? Listing directory: %s", path)

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

	modUnix := info.ModTime().Unix()

	if fs.dirCache != nil {
		if entry, ok := fs.dirCache.Get(path, modUnix); ok {
			return fs.buildDirectoryResponse(path, entry.files, startTime)
		}
	}

	allEntries, err := fs.listDirectoryFast(path)
	if err != nil {
		return NavigationResponse{Success: false, Message: fmt.Sprintf("Cannot read directory: %v", err)}
	}

	if fs.dirCache != nil {
		fs.dirCache.Put(path, allEntries, modUnix)
	}

	return fs.buildDirectoryResponse(path, allEntries, startTime)
}

func (fs *FileSystemManager) listDirectoryFast(path string) ([]FileInfo, error) {
	entries := make([]FileInfo, 0, 256)
	err := enumerateDirectoryBasicEnhanced(path, fs.showHidden, func(entry EnhancedBasicEntry) bool {
		if fs.shouldSkipFile(entry.Name, entry.IsHidden) {
			return true
		}
		entries = append(entries, fs.toFileInfo(entry))
		return true
	})
	if err != nil {
		return nil, err
	}
	return entries, nil
}

func (fs *FileSystemManager) toFileInfo(entry EnhancedBasicEntry) FileInfo {
	return FileInfo{
		Name:        entry.Name,
		Path:        entry.Path,
		IsDir:       entry.IsDir,
		Size:        entry.Size,
		ModTime:     entry.ModTime,
		Permissions: entry.Permissions,
		Extension:   entry.Extension,
		IsHidden:    entry.IsHidden,
	}
}

func (fs *FileSystemManager) IsHidden(path string) bool {
	return fs.platform.IsHidden(path)
}

func (fs *FileSystemManager) GetExtension(name string) string {
	return fs.platform.GetExtension(name)
}

func (fs *FileSystemManager) shouldSkipFile(name string, isHidden bool) bool {
	if !fs.showHidden && isHidden {
		return true
	}

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

func (fs *FileSystemManager) GetFileInfo(filePath string) (FileInfo, error) {
	logPrintf("Getting file details for: %s", filePath)

	info, err := os.Stat(filePath)
	if err != nil {
		logPrintf("Error getting file details: %v", err)
		return FileInfo{}, err
	}

	return FileInfo{
		Name:        filepath.Base(filePath),
		Path:        filePath,
		IsDir:       info.IsDir(),
		Size:        info.Size(),
		ModTime:     info.ModTime().Unix(),
		Permissions: info.Mode().String(),
		Extension:   fs.platform.GetExtension(filepath.Base(filePath)),
		IsHidden:    fs.platform.IsHidden(filePath),
	}, nil
}

func (fs *FileSystemManager) NavigateToPath(path string) NavigationResponse {
	logPrintf("?? Navigation request: %s", path)
	return fs.ListDirectory(path)
}

func (fs *FileSystemManager) FileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

func (fs *FileSystemManager) StreamDirectory(dir string) {
	if dir == "" {
		dir = fs.platform.GetHomeDirectory()
	}
	dir = filepath.Clean(dir)

	if fs.eventEmitter != nil {
		fs.eventEmitter.EmitDirectoryStart(dir)
	}

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

	modUnix := info.ModTime().Unix()

	if fs.dirCache != nil {
		if entry, ok := fs.dirCache.Get(dir, modUnix); ok {
			fs.streamFromSnapshot(dir, entry.files)
			return
		}
	}

	fs.streamByEnumerating(dir, modUnix)
}

func (fs *FileSystemManager) streamFromSnapshot(dir string, files []FileInfo) {
	totalFiles, totalDirs := 0, 0
	batchPtr := wireBatchPool.Get().(*[]WireEntry)
	batch := (*batchPtr)[:0]

	for _, fi := range files {
		if fi.IsDir {
			totalDirs++
		} else {
			totalFiles++
		}
		batch = append(batch, wireFromFileInfo(fi))
		if len(batch) >= streamBatchSize {
			fs.emitWireBatch(batch)
			batch = batch[:0]
		}
	}

	if len(batch) > 0 {
		fs.emitWireBatch(batch)
	}
	wireBatchPool.Put(batchPtr)

	if fs.eventEmitter != nil {
		fs.eventEmitter.EmitDirectoryComplete(dir, totalFiles, totalDirs)
	}
}

func (fs *FileSystemManager) streamByEnumerating(dir string, modUnix int64) {
	totalFiles, totalDirs := 0, 0
	batchPtr := wireBatchPool.Get().(*[]WireEntry)
	batch := (*batchPtr)[:0]

	var cacheEntries []FileInfo
	cacheLimit := 0
	if fs.dirCache != nil {
		cacheEntries = make([]FileInfo, 0, 256)
		cacheLimit = fs.dirCache.maxEntriesLimit()
	}
	cacheExceeded := false

	err := enumerateDirectoryBasicEnhanced(dir, fs.showHidden, func(entry EnhancedBasicEntry) bool {
		if fs.shouldSkipFile(entry.Name, entry.IsHidden) {
			return true
		}
		fi := fs.toFileInfo(entry)
		if fi.IsDir {
			totalDirs++
		} else {
			totalFiles++
		}

		if cacheEntries != nil && !cacheExceeded {
			cacheEntries = append(cacheEntries, fi)
			if cacheLimit > 0 && len(cacheEntries) > cacheLimit {
				cacheEntries = nil
				cacheExceeded = true
			}
		}

		batch = append(batch, wireFromFileInfo(fi))
		if len(batch) >= streamBatchSize {
			fs.emitWireBatch(batch)
			batch = batch[:0]
		}
		return true
	})

	if err != nil {
		wireBatchPool.Put(batchPtr)
		if fs.eventEmitter != nil {
			fs.eventEmitter.EmitDirectoryError("Cannot read directory: " + err.Error())
		}
		return
	}

	if len(batch) > 0 {
		fs.emitWireBatch(batch)
	}
	wireBatchPool.Put(batchPtr)

	if fs.eventEmitter != nil {
		fs.eventEmitter.EmitDirectoryComplete(dir, totalFiles, totalDirs)
	}

	if fs.dirCache != nil && cacheEntries != nil {
		fs.dirCache.Put(dir, cacheEntries, modUnix)
	}
}

func (fs *FileSystemManager) emitWireBatch(batch []WireEntry) {
	if fs.eventEmitter == nil || len(batch) == 0 {
		return
	}
	if mp, err := GetSerializationUtils().encodeMsgPackBinary(batch); err == nil {
		fs.eventEmitter.EmitDirectoryBatchMP(mp, len(batch))
	}
}

func (fs *FileSystemManager) buildDirectoryResponse(path string, allEntries []FileInfo, start time.Time) NavigationResponse {
	parentPath := filepath.Dir(path)
	if parentPath == path {
		parentPath = ""
	}

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

	processingTime := time.Since(start)
	logPrintf("? Directory listed in %v: %s (%d dirs, %d files)", processingTime, path, len(directories), len(files))

	return NavigationResponse{
		Success: true,
		Message: fmt.Sprintf("Directory listed in %v", processingTime),
		Data:    contents,
	}
}

func (fs *FileSystemManager) CreateDirectory(path, name string) NavigationResponse {
	if path == "" {
		return NavigationResponse{Success: false, Message: "Parent path cannot be empty"}
	}
	if name == "" {
		return NavigationResponse{Success: false, Message: "Directory name cannot be empty"}
	}

	sanitizedName, err := fs.validateAndSanitizeFileName(name)
	if err != nil {
		return NavigationResponse{Success: false, Message: fmt.Sprintf("Invalid directory name: %v", err)}
	}

	cleanPath := filepath.Clean(path)
	if !filepath.IsAbs(cleanPath) {
		return NavigationResponse{Success: false, Message: "Parent path must be absolute"}
	}

	fullPath := filepath.Join(cleanPath, sanitizedName)
	if !fs.isPathWithinParent(fullPath, cleanPath) {
		return NavigationResponse{Success: false, Message: "Directory creation outside parent directory is not allowed"}
	}

	if fs.FileExists(fullPath) {
		return NavigationResponse{Success: false, Message: "Directory already exists"}
	}

	if err := fs.validateParentDirectory(cleanPath); err != nil {
		return NavigationResponse{Success: false, Message: fmt.Sprintf("Parent directory validation failed: %v", err)}
	}

	if err := os.MkdirAll(fullPath, 0755); err != nil {
		return NavigationResponse{Success: false, Message: fmt.Sprintf("Failed to create directory: %v", err)}
	}

	logPrintf("?? Directory created securely: %s", fullPath)
	return NavigationResponse{Success: true, Message: "Directory created successfully"}
}

func (fs *FileSystemManager) validateAndSanitizeFileName(name string) (string, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return "", fmt.Errorf("name cannot be empty")
	}

	if strings.Contains(name, "..") {
		return "", fmt.Errorf("path traversal sequences not allowed")
	}
	if strings.ContainsAny(name, "/\\") {
		return "", fmt.Errorf("path separators not allowed in name")
	}

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

	invalidChars := []string{"<", ">", ":", "\"", "|", "?", "*"}
	for _, char := range invalidChars {
		if strings.Contains(name, char) {
			return "", fmt.Errorf("invalid character not allowed: %s", char)
		}
	}

	if len(name) > 255 {
		return "", fmt.Errorf("name too long (max 255 characters)")
	}

	if strings.Trim(name, ". ") == "" {
		return "", fmt.Errorf("name cannot consist only of dots and spaces")
	}

	return name, nil
}

func (fs *FileSystemManager) isPathWithinParent(childPath, parentPath string) bool {
	cleanChild := filepath.Clean(childPath)
	cleanParent := filepath.Clean(parentPath)

	rel, err := filepath.Rel(cleanParent, cleanChild)
	if err != nil {
		return false
	}

	return !strings.HasPrefix(rel, "..") && rel != ".."
}

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

	tempFile := filepath.Join(parentPath, ".lightning_explorer_write_test")
	file, err := os.Create(tempFile)
	if err != nil {
		return fmt.Errorf("parent directory is not writable: %v", err)
	}
	file.Close()
	os.Remove(tempFile)

	return nil
}

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
