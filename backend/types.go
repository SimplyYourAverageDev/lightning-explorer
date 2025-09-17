package backend

import (
	"context"
	"sync"
	"time"
)

// FileInfo represents file/directory information
// ModTime is stored as Unix seconds to minimise allocations and payload sizes.
type FileInfo struct {
	Name        string `json:"name" msgpack:"name"`
	Path        string `json:"path" msgpack:"path"`
	IsDir       bool   `json:"isDir" msgpack:"isDir"`
	Size        int64  `json:"size" msgpack:"size"`
	ModTime     int64  `json:"modTime" msgpack:"modTime"`
	Permissions string `json:"permissions" msgpack:"permissions"`
	Extension   string `json:"extension" msgpack:"extension"`
	IsHidden    bool   `json:"isHidden" msgpack:"isHidden"`
}

// DirectoryContents represents the contents of a directory
type DirectoryContents struct {
	CurrentPath string     `json:"currentPath" msgpack:"currentPath"`
	ParentPath  string     `json:"parentPath" msgpack:"parentPath"`
	Files       []FileInfo `json:"files" msgpack:"files"`
	Directories []FileInfo `json:"directories" msgpack:"directories"`
	TotalFiles  int        `json:"totalFiles" msgpack:"totalFiles"`
	TotalDirs   int        `json:"totalDirs" msgpack:"totalDirs"`
}

// NavigationResponse represents navigation result
type NavigationResponse struct {
	Success bool              `json:"success" msgpack:"success"`
	Message string            `json:"message" msgpack:"message"`
	Data    DirectoryContents `json:"data" msgpack:"data"`
}

// DriveInfo represents information about a system drive
type DriveInfo struct {
	Path   string `json:"path" msgpack:"path"`
	Letter string `json:"letter" msgpack:"letter"`
	Name   string `json:"name" msgpack:"name"`
}

// WarmState represents cached warm-start data sent to the frontend.
type WarmState struct {
	HomeDir string      `json:"homeDir" msgpack:"homeDir"`
	Drives  []DriveInfo `json:"drives" msgpack:"drives"`
	Ready   bool        `json:"ready" msgpack:"ready"`
}

// Settings represents application configuration
type Settings struct {
	BackgroundStartup bool     `json:"backgroundStartup" msgpack:"backgroundStartup"`
	Theme             string   `json:"theme" msgpack:"theme"`
	ShowHiddenFiles   bool     `json:"showHiddenFiles" msgpack:"showHiddenFiles"`
	PinnedFolders     []string `json:"pinnedFolders,omitempty" msgpack:"pinnedFolders"`
}

// FileSystemManagerInterface defines the file system operations contract
type FileSystemManagerInterface interface {
	ListDirectory(path string) NavigationResponse
	GetFileInfo(path string) (FileInfo, error)
	IsHidden(path string) bool
	GetExtension(name string) string
	NavigateToPath(path string) NavigationResponse
	CreateDirectory(path, name string) NavigationResponse
	ValidatePath(path string) error
	FileExists(path string) bool
	StreamDirectory(dir string)
	SetShowHidden(includeHidden bool)
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
	GetWindowsDrivesOptimized() []DriveInfo
	OpenInSystemExplorer(path string) bool
	IsHidden(filePath string) bool
	GetExtension(name string) string
	HideFile(filePath string) bool
	OpenFile(filePath string) bool
	FormatFileSize(size int64) string
	SetClipboardFilePaths(paths []string) bool
	EjectDriveWindows(drivePath string) bool
	WatchDriveChanges(ctx context.Context) (<-chan struct{}, error)
}

// DriveManagerInterface defines drive management contract
type DriveManagerInterface interface {
	GetDriveInfo() []DriveInfo
	GetQuickAccessPaths() []DriveInfo
	InvalidateCaches()
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
	filesystem FileSystemManagerInterface
	fileOps    FileOperationsManagerInterface
	platform   PlatformManagerInterface
	drives     DriveManagerInterface
	terminal   TerminalManagerInterface

	drivesOnce   sync.Once
	terminalOnce sync.Once

	homeDirCache string
	drivesCache  []DriveInfo
	warmReady    bool
	warmOnce     sync.Once

	settings     Settings
	settingsOnce sync.Once
}

// FileSystemManager implementation
type FileSystemManager struct {
	platform     PlatformManagerInterface
	ctx          context.Context
	eventEmitter *EventEmitter
	dirCache     *lruDirCache
	showHidden   bool
	purgeOnce    sync.Once
}

// FileOperationsManager implementation
type FileOperationsManager struct {
	platform PlatformManagerInterface
}

// PlatformManager implementation
type PlatformManager struct {
	driveCacheMu     sync.RWMutex
	driveCache       []DriveInfo
	driveCacheExpiry time.Time

	volumeCacheMu sync.RWMutex
	volumeCache   map[string]volumeLabelCacheEntry
}

// DriveManager implementation
type DriveManager struct {
	platform PlatformManagerInterface
	mu       sync.RWMutex

	driveCache       []DriveInfo
	driveCacheExpiry time.Time

	quickAccessCache       []DriveInfo
	quickAccessCacheExpiry time.Time
}

// TerminalManager implementation
type TerminalManager struct{}

type volumeLabelCacheEntry struct {
	label   string
	expires time.Time
}
