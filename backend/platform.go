package backend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
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

// GetSystemRoots returns system root paths (drives on Windows, / on Unix)
func (p *PlatformManager) GetSystemRoots() []string {
	var roots []string

	switch runtime.GOOS {
	case "windows":
		// Use the optimized Windows-specific method
		return p.GetSystemRootsWindows()
	default:
		// Unix-like systems start from root
		roots = append(roots, "/")
	}
	return roots
}

// OpenInSystemExplorer opens the given path in the system's default file manager
func (p *PlatformManager) OpenInSystemExplorer(path string) bool {
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
		log.Printf("OpenInSystemExplorer not supported on %s", runtime.GOOS)
		return false
	}

	err := exec.Command(cmd, args...).Start()
	if err != nil {
		log.Printf("Error opening in system explorer: %v", err)
		return false
	}
	return true
}

// OpenFile opens a file with its default application
func (p *PlatformManager) OpenFile(filePath string) bool {
	log.Printf("Opening file with default application: %s", filePath)

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Use rundll32 with shell32.dll to open file without showing command prompt
		cmd = exec.Command("rundll32.exe", "shell32.dll,ShellExec_RunDLL", filePath)
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	case "darwin":
		cmd = exec.Command("open", filePath)
	case "linux":
		cmd = exec.Command("xdg-open", filePath)
	default:
		log.Printf("Unsupported operating system: %s", runtime.GOOS)
		return false
	}

	err := cmd.Start()
	if err != nil {
		log.Printf("Error opening file: %v", err)
		return false
	}

	log.Printf("Successfully opened file: %s", filePath)
	return true
}

// IsHiddenWindows checks if a file has the Windows hidden attribute
func (p *PlatformManager) IsHiddenWindows(filePath string) bool {
	if runtime.GOOS != "windows" {
		return false
	}

	// Use native Windows API instead of attrib command
	return p.IsHiddenWindowsNative(filePath)
}

// IsHiddenMac checks if a file is hidden on macOS
func (p *PlatformManager) IsHiddenMac(filePath string) bool {
	if runtime.GOOS != "darwin" {
		return false
	}

	fileName := filepath.Base(filePath)
	// Files starting with dot are hidden on macOS
	return strings.HasPrefix(fileName, ".")
}

// IsHiddenLinux checks if a file is hidden on Linux
func (p *PlatformManager) IsHiddenLinux(filePath string) bool {
	if runtime.GOOS != "linux" {
		return false
	}

	fileName := filepath.Base(filePath)
	// Files starting with dot are hidden on Linux
	return strings.HasPrefix(fileName, ".")
}

// IsHidden checks if a file/directory is hidden using OS-specific methods
func (p *PlatformManager) IsHidden(filePath string) bool {
	// Check for dot prefix (universal Unix convention)
	fileName := filepath.Base(filePath)
	if strings.HasPrefix(fileName, ".") {
		return true
	}

	// Check OS-specific hidden attributes
	switch runtime.GOOS {
	case "windows":
		return p.IsHiddenWindows(filePath)
	case "darwin":
		return p.IsHiddenMac(filePath)
	case "linux":
		return p.IsHiddenLinux(filePath)
	default:
		return false
	}
}

// HideFileWindows sets the hidden attribute on Windows using native API
func (p *PlatformManager) HideFileWindows(filePath string) bool {
	if runtime.GOOS != "windows" {
		return false
	}

	// Use native Windows API instead of attrib command
	return p.HideFileWindowsNative(filePath)
}

// HideFileMac hides file on macOS by adding a dot prefix (if not already hidden)
func (p *PlatformManager) HideFileMac(filePath string) bool {
	if runtime.GOOS != "darwin" {
		return false
	}

	log.Printf("Hiding file on macOS: %s", filePath)

	fileName := filepath.Base(filePath)
	if strings.HasPrefix(fileName, ".") {
		log.Printf("File is already hidden: %s", filePath)
		return true
	}

	dir := filepath.Dir(filePath)
	newPath := filepath.Join(dir, "."+fileName)

	err := os.Rename(filePath, newPath)
	if err != nil {
		log.Printf("Failed to hide file on macOS: %v", err)
		return false
	}

	log.Printf("Successfully hid file on macOS: %s -> %s", filePath, newPath)
	return true
}

// HideFileLinux hides file on Linux by adding a dot prefix (if not already hidden)
func (p *PlatformManager) HideFileLinux(filePath string) bool {
	if runtime.GOOS != "linux" {
		return false
	}

	log.Printf("Hiding file on Linux: %s", filePath)

	fileName := filepath.Base(filePath)
	if strings.HasPrefix(fileName, ".") {
		log.Printf("File is already hidden: %s", filePath)
		return true
	}

	dir := filepath.Dir(filePath)
	newPath := filepath.Join(dir, "."+fileName)

	err := os.Rename(filePath, newPath)
	if err != nil {
		log.Printf("Failed to hide file on Linux: %v", err)
		return false
	}

	log.Printf("Successfully hid file on Linux: %s -> %s", filePath, newPath)
	return true
}

// HideFile sets the hidden attribute on a file using OS-specific methods
func (p *PlatformManager) HideFile(filePath string) bool {
	switch runtime.GOOS {
	case "windows":
		return p.HideFileWindows(filePath)
	case "darwin":
		return p.HideFileMac(filePath)
	case "linux":
		return p.HideFileLinux(filePath)
	default:
		log.Printf("Hide file not supported on %s", runtime.GOOS)
		return false
	}
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
