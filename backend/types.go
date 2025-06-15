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
	ModTime     time.Time `json:"modTime" msgpack:"modTime"`
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

// Interfaces for dependency injection and better testability

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
	IsHidden(filePath string) bool
	GetExtension(name string) string
	HideFile(filePath string) bool
	OpenFile(filePath string) bool
	FormatFileSize(size int64) string
	// Native Windows API methods
	IsHiddenWindowsNative(filePath string) bool
	HideFileWindowsNative(filePath string) bool
	GetCurrentUserSIDNative() (string, error)
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
}

// FileSystemManager implementation
type FileSystemManager struct {
	platform     PlatformManagerInterface
	ctx          context.Context
	eventEmitter *EventEmitter
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
