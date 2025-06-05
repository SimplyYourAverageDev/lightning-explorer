package backend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
)

// NewPlatformManager creates a new platform manager instance
func NewPlatformManager() *PlatformManager {
	return &PlatformManager{}
}

// GetHomeDirectory returns the user's home directory
func (p *PlatformManager) GetHomeDirectory() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("Error getting home directory: %v", err)
		return ""
	}
	return homeDir
}

// GetCurrentWorkingDirectory returns the current working directory
func (p *PlatformManager) GetCurrentWorkingDirectory() string {
	cwd, err := os.Getwd()
	if err != nil {
		log.Printf("Error getting current working directory: %v", err)
		return ""
	}
	return cwd
}

// GetSystemRoots returns Windows system root paths (drives)
func (p *PlatformManager) GetSystemRoots() []string {
	// Use the optimized Windows-specific method
	return p.GetSystemRootsWindows()
}

// OpenInSystemExplorer opens the given path in Windows Explorer
func (p *PlatformManager) OpenInSystemExplorer(path string) bool {
	cmd := "explorer"
	args := []string{path}

	err := exec.Command(cmd, args...).Start()
	if err != nil {
		log.Printf("Error opening in Windows Explorer: %v", err)
		return false
	}
	return true
}

// OpenFile opens a file with its default Windows application
func (p *PlatformManager) OpenFile(filePath string) bool {
	log.Printf("Opening file with default Windows application: %s", filePath)

	// Use rundll32 with shell32.dll to open file without showing command prompt
	cmd := exec.Command("rundll32.exe", "shell32.dll,ShellExec_RunDLL", filePath)
	cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}

	err := cmd.Start()
	if err != nil {
		log.Printf("Error opening file with Windows default application: %v", err)
		return false
	}

	log.Printf("Successfully opened file with Windows default application: %s", filePath)
	return true
}

// IsHiddenWindows checks if a file has the Windows hidden attribute
func (p *PlatformManager) IsHiddenWindows(filePath string) bool {
	// Use native Windows API instead of attrib command
	return p.IsHiddenWindowsNative(filePath)
}

// IsHidden checks if a file/directory is hidden using Windows methods
func (p *PlatformManager) IsHidden(filePath string) bool {
	// Check for dot prefix (common convention, but not typical on Windows)
	fileName := filepath.Base(filePath)
	if strings.HasPrefix(fileName, ".") {
		return true
	}

	// Check Windows-specific hidden attributes
	return p.IsHiddenWindows(filePath)
}

// HideFileWindows sets the hidden attribute on Windows using native API
func (p *PlatformManager) HideFileWindows(filePath string) bool {
	// Use native Windows API instead of attrib command
	return p.HideFileWindowsNative(filePath)
}

// HideFile sets the hidden attribute on a file using Windows methods
func (p *PlatformManager) HideFile(filePath string) bool {
	return p.HideFileWindows(filePath)
}

// GetExtension returns the file extension in lowercase
func (p *PlatformManager) GetExtension(name string) string {
	ext := filepath.Ext(name)
	if ext != "" {
		return strings.ToLower(ext[1:]) // Remove the dot and convert to lowercase
	}
	return ""
}

// FormatFileSize formats file size in human readable format
func (p *PlatformManager) FormatFileSize(size int64) string {
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
