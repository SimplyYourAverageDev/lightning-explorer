package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"time"
)

// App struct
type App struct {
	ctx context.Context
}

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

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	log.Println("File Explorer app started")
}

// GetHomeDirectory returns the user's home directory
func (a *App) GetHomeDirectory() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("Error getting home directory: %v", err)
		return ""
	}
	return homeDir
}

// GetCurrentWorkingDirectory returns the current working directory
func (a *App) GetCurrentWorkingDirectory() string {
	cwd, err := os.Getwd()
	if err != nil {
		log.Printf("Error getting current working directory: %v", err)
		return ""
	}
	return cwd
}

// GetSystemRoots returns system root paths (drives on Windows, / on Unix)
func (a *App) GetSystemRoots() []string {
	var roots []string

	if runtime.GOOS == "windows" {
		// Get all drives on Windows
		for i := 'A'; i <= 'Z'; i++ {
			drive := fmt.Sprintf("%c:\\", i)
			if _, err := os.Stat(drive); err == nil {
				roots = append(roots, drive)
			}
		}
	} else {
		// Unix-like systems start from root
		roots = append(roots, "/")
	}

	return roots
}

// ListDirectory lists the contents of a directory
func (a *App) ListDirectory(path string) NavigationResponse {
	log.Printf("Listing directory: %s", path)

	if path == "" {
		path = a.GetHomeDirectory()
	}

	// Clean and validate path
	path = filepath.Clean(path)

	// Check if path exists and is accessible
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

	entries, err := os.ReadDir(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Cannot read directory: %v", err),
		}
	}

	var files []FileInfo
	var directories []FileInfo

	for _, entry := range entries {
		fileInfo := a.createFileInfo(path, entry)

		if fileInfo.IsDir {
			directories = append(directories, fileInfo)
		} else {
			files = append(files, fileInfo)
		}
	}

	// Sort directories and files alphabetically
	sort.Slice(directories, func(i, j int) bool {
		return strings.ToLower(directories[i].Name) < strings.ToLower(directories[j].Name)
	})
	sort.Slice(files, func(i, j int) bool {
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	// Get parent path
	parentPath := filepath.Dir(path)
	if parentPath == path {
		parentPath = "" // At root
	}

	contents := DirectoryContents{
		CurrentPath: path,
		ParentPath:  parentPath,
		Files:       files,
		Directories: directories,
		TotalFiles:  len(files),
		TotalDirs:   len(directories),
	}

	return NavigationResponse{
		Success: true,
		Message: "Directory listed successfully",
		Data:    contents,
	}
}

// createFileInfo creates FileInfo from DirEntry
func (a *App) createFileInfo(basePath string, entry fs.DirEntry) FileInfo {
	fullPath := filepath.Join(basePath, entry.Name())

	info, err := entry.Info()
	if err != nil {
		log.Printf("Error getting file info for %s: %v", fullPath, err)
		return FileInfo{
			Name:     entry.Name(),
			Path:     fullPath,
			IsDir:    entry.IsDir(),
			IsHidden: a.isHidden(entry.Name()),
		}
	}

	return FileInfo{
		Name:        entry.Name(),
		Path:        fullPath,
		IsDir:       entry.IsDir(),
		Size:        info.Size(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().String(),
		Extension:   a.getExtension(entry.Name()),
		IsHidden:    a.isHidden(entry.Name()),
	}
}

// isHidden checks if a file/directory is hidden
func (a *App) isHidden(name string) bool {
	if strings.HasPrefix(name, ".") {
		return true
	}

	// Additional Windows hidden file check could be added here
	// using syscalls if needed

	return false
}

// getExtension returns the file extension
func (a *App) getExtension(name string) string {
	ext := filepath.Ext(name)
	if ext != "" {
		return strings.ToLower(ext[1:]) // Remove the dot and convert to lowercase
	}
	return ""
}

// NavigateToPath navigates to a specific path
func (a *App) NavigateToPath(path string) NavigationResponse {
	log.Printf("Navigating to path: %s", path)
	return a.ListDirectory(path)
}

// NavigateUp navigates to the parent directory
func (a *App) NavigateUp(currentPath string) NavigationResponse {
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

	return a.ListDirectory(parentPath)
}

// GetFileDetails returns detailed information about a file
func (a *App) GetFileDetails(filePath string) FileInfo {
	log.Printf("Getting file details for: %s", filePath)

	info, err := os.Stat(filePath)
	if err != nil {
		log.Printf("Error getting file details: %v", err)
		return FileInfo{}
	}

	return FileInfo{
		Name:        filepath.Base(filePath),
		Path:        filePath,
		IsDir:       info.IsDir(),
		Size:        info.Size(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().String(),
		Extension:   a.getExtension(filepath.Base(filePath)),
		IsHidden:    a.isHidden(filepath.Base(filePath)),
	}
}

// FormatFileSize formats file size in human readable format
func (a *App) FormatFileSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}

	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	units := []string{"KB", "MB", "GB", "TB", "PB"}
	return fmt.Sprintf("%.1f %s", float64(size)/float64(div), units[exp])
}

// OpenInSystemExplorer opens the given path in the system's default file manager
func (a *App) OpenInSystemExplorer(path string) bool {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "explorer"
		args = []string{path}
	case "darwin":
		cmd = "open"
		args = []string{path}
	case "linux":
		cmd = "xdg-open"
		args = []string{path}
	default:
		return false
	}

	err := exec.Command(cmd, args...).Start()
	return err == nil
}

// GetDriveInfo returns information about available drives (Windows specific)
func (a *App) GetDriveInfo() []map[string]interface{} {
	var drives []map[string]interface{}

	if runtime.GOOS != "windows" {
		return drives
	}

	for i := 'A'; i <= 'Z'; i++ {
		drive := fmt.Sprintf("%c:\\", i)
		if _, err := os.Stat(drive); err == nil {
			// Try to get more info about the drive
			drives = append(drives, map[string]interface{}{
				"path":   drive,
				"letter": string(i),
				"name":   fmt.Sprintf("Drive %c:", i),
			})
		}
	}

	return drives
}

// CreateDirectory creates a new directory
func (a *App) CreateDirectory(path, name string) NavigationResponse {
	fullPath := filepath.Join(path, name)

	err := os.MkdirAll(fullPath, 0755)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to create directory: %v", err),
		}
	}

	return NavigationResponse{
		Success: true,
		Message: "Directory created successfully",
	}
}

// DeletePath deletes a file or directory
func (a *App) DeletePath(path string) NavigationResponse {
	err := os.RemoveAll(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to delete: %v", err),
		}
	}

	return NavigationResponse{
		Success: true,
		Message: "Item deleted successfully",
	}
}
