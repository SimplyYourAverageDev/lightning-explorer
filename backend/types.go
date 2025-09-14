package backend

import (
	"context"
	"sync"
	"time"
)

// FileInfo represents file/directory information
type FileInfo struct {
	Name        string    `json:"name" msgpack:"name"`
	Path        string    `json:"path" msgpack:"path"`
	IsDir       bool      `json:"isDir" msgpack:"isDir"`
	Size        int64     `json:"size" msgpack:"size"`
	ModTime     time.Time `json:"modTime" msgpack:"modTime" ts_type:"string"`
	Permissions string    `json:"permissions" msgpack:"permissions"`
	Extension   string    `json:"extension" msgpack:"extension"`
	IsHidden    bool      `json:"isHidden" msgpack:"isHidden"`
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

// Interfaces for dependency injection and better testability

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
	IsHidden(filePath string) bool
	GetExtension(name string) string
	HideFile(filePath string) bool
	OpenFile(filePath string) bool
	FormatFileSize(size int64) string
	// Copies absolute file paths into the OS clipboard (CF_HDROP)
	SetClipboardFilePaths(paths []string) bool
	// Drive ejection methods
	EjectDriveWindows(drivePath string) bool
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
	filesystem FileSystemManagerInterface
	fileOps    FileOperationsManagerInterface
	platform   PlatformManagerInterface
	drives     DriveManagerInterface
	terminal   TerminalManagerInterface
	// Lazy initialization sync.Once fields
	drivesOnce   sync.Once
	terminalOnce sync.Once

	// Warm startup caches
	homeDirCache string
	drivesCache  []DriveInfo
	warmReady    bool
	warmOnce     sync.Once

	// Settings management
	settings     Settings
	settingsOnce sync.Once
}

// FileSystemManager implementation
type FileSystemManager struct {
	platform     PlatformManagerInterface
	ctx          context.Context
	eventEmitter *EventEmitter
	// dirCache stores recently enumerated directory contents keyed by absolute path.
	// Bounded LRU with TTL and last write time validation for fast repeat navigations
	// without unbounded memory growth.
	dirCache *lruDirCache
}

// FileOperationsManager implementation
type FileOperationsManager struct {
	platform PlatformManagerInterface
}

// PlatformManager implementation
type PlatformManager struct{}

// DriveManager implementation
type DriveManager struct{}

// TerminalManager implementation
type TerminalManager struct{}
