package backend

import (
	"context"
	"sync"
	"time"
)

// FileInfo represents file/directory information
type FileInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	IsDir       bool      `json:"isDir"`
	Size        int64     `json:"size"`
	ModTime     time.Time `json:"modTime"`
	Permissions string    `json:"permissions"`
	Extension   string    `json:"extension"`
	IsHidden    bool      `json:"isHidden"`
}

// DirectoryContents represents the contents of a directory
type DirectoryContents struct {
	CurrentPath string     `json:"currentPath"`
	ParentPath  string     `json:"parentPath"`
	Files       []FileInfo `json:"files"`
	Directories []FileInfo `json:"directories"`
	TotalFiles  int        `json:"totalFiles"`
	TotalDirs   int        `json:"totalDirs"`
}

// NavigationResponse represents navigation result
type NavigationResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    DirectoryContents `json:"data"`
}

// CacheEntry represents a cached directory entry for performance optimization
type CacheEntry struct {
	Contents  DirectoryContents `json:"contents"`
	Timestamp time.Time         `json:"timestamp"`
	ModTime   time.Time         `json:"modTime"`
}

// DriveInfo represents information about a system drive
type DriveInfo struct {
	Path   string `json:"path"`
	Letter string `json:"letter"`
	Name   string `json:"name"`
}

// Interfaces for dependency injection and better testability

// CacheManagerInterface defines the cache management contract
type CacheManagerInterface interface {
	Get(path string) (*CacheEntry, bool)
	Set(path string, entry *CacheEntry)
	Clear()
	CleanOldEntries()
}

// FileSystemManagerInterface defines the file system operations contract
type FileSystemManagerInterface interface {
	ListDirectory(path string) NavigationResponse
	GetFileInfo(path string) (FileInfo, error)
	CreateFileInfo(basePath string, name string) FileInfo
	IsHidden(path string) bool
	GetExtension(name string) string
	NavigateToPath(path string) NavigationResponse
	NavigateUp(currentPath string) NavigationResponse
	CreateDirectory(path, name string) NavigationResponse
	ValidatePath(path string) error
	FileExists(path string) bool
}

// FileOperationsManagerInterface defines file operations contract
type FileOperationsManagerInterface interface {
	CopyFiles(sourcePaths []string, destDir string) bool
	MoveFiles(sourcePaths []string, destDir string) bool
	DeleteFiles(filePaths []string) bool
	MoveFilesToRecycleBin(filePaths []string) bool
	RenameFile(oldPath, newName string) bool
	HideFiles(filePaths []string) bool
	OpenFile(filePath string) bool
}

// PlatformManagerInterface defines OS-specific operations contract
type PlatformManagerInterface interface {
	GetHomeDirectory() string
	GetCurrentWorkingDirectory() string
	GetSystemRoots() []string
	OpenInSystemExplorer(path string) bool
	IsHiddenWindows(filePath string) bool
	IsHiddenMac(filePath string) bool
	IsHiddenLinux(filePath string) bool
	IsHidden(filePath string) bool
	GetExtension(name string) string
	HideFile(filePath string) bool
	OpenFile(filePath string) bool
	FormatFileSize(size int64) string
}

// DriveManagerInterface defines drive management contract
type DriveManagerInterface interface {
	GetDriveInfo() []DriveInfo
	GetQuickAccessPaths() []DriveInfo
}

// TerminalManagerInterface defines terminal operations contract
type TerminalManagerInterface interface {
	OpenPowerShellHere(directoryPath string) bool
	OpenTerminalHere(directoryPath string) bool
	GetAvailableTerminals() []string
	ExecuteCommand(command string, workingDir string) error
}

// App struct - Main application structure with dependency injection
type App struct {
	ctx        context.Context
	cache      CacheManagerInterface
	filesystem FileSystemManagerInterface
	fileOps    FileOperationsManagerInterface
	platform   PlatformManagerInterface
	drives     DriveManagerInterface
	terminal   TerminalManagerInterface
}

// CacheManager implementation
type CacheManager struct {
	dirCache   map[string]*CacheEntry
	lastAccess map[string]time.Time
	cacheMutex sync.RWMutex
}

// FileSystemManager implementation
type FileSystemManager struct {
	cache    CacheManagerInterface
	platform PlatformManagerInterface
}

// FileOperationsManager implementation
type FileOperationsManager struct {
	cache    CacheManagerInterface
	platform PlatformManagerInterface
}

// PlatformManager implementation
type PlatformManager struct{}

// DriveManager implementation
type DriveManager struct{}

// TerminalManager implementation
type TerminalManager struct{}
