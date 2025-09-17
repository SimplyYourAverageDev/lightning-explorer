//go:build !windows

package backend

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// NewPlatformManager creates a new platform manager instance
func NewPlatformManager() *PlatformManager {
	return &PlatformManager{
		volumeCache: make(map[string]volumeLabelCacheEntry),
	}
}

func (p *PlatformManager) GetWindowsDrivesOptimized() []DriveInfo {
	return nil
}

func (p *PlatformManager) invalidateDriveCaches() {}

func (p *PlatformManager) WatchDriveChanges(ctx context.Context) (<-chan struct{}, error) {
	return nil, fmt.Errorf("drive change monitoring not supported on %s", runtime.GOOS)
}

// GetHomeDirectory returns the user's home directory
func (p *PlatformManager) GetHomeDirectory() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		logPrintf("Error getting home directory: %v", err)
		return ""
	}
	return homeDir
}

// GetCurrentWorkingDirectory returns the current working directory
func (p *PlatformManager) GetCurrentWorkingDirectory() string {
	cwd, err := os.Getwd()
	if err != nil {
		logPrintf("Error getting current working directory: %v", err)
		return ""
	}
	return cwd
}

// GetSystemRoots returns system root paths for quick navigation
func (p *PlatformManager) GetSystemRoots() []string {
	// For Unix-like systems, the root is always '/'
	return []string{"/"}
}

// OpenInSystemExplorer opens the given path in the system file explorer
func (p *PlatformManager) OpenInSystemExplorer(path string) bool {
	var cmd *exec.Cmd
	if runtime.GOOS == "darwin" {
		cmd = exec.Command("open", path)
	} else {
		cmd = exec.Command("xdg-open", path)
	}

	if err := cmd.Start(); err != nil {
		logPrintf("Error opening path in system explorer: %v", err)
		return false
	}
	return true
}

// OpenFile opens a file with its default application
func (p *PlatformManager) OpenFile(filePath string) bool {
	return p.OpenInSystemExplorer(filePath)
}

// IsHiddenWindows is not applicable on non-Windows platforms
func (p *PlatformManager) IsHiddenWindows(filePath string) bool {
	return false
}

// IsHidden checks if a file/directory is hidden using Unix conventions
func (p *PlatformManager) IsHidden(filePath string) bool {
	name := filepath.Base(filePath)
	return strings.HasPrefix(name, ".")
}

// GetExtension returns the file extension in lowercase
func (p *PlatformManager) GetExtension(name string) string {
	return strings.TrimPrefix(strings.ToLower(filepath.Ext(name)), ".")
}

// HideFile renames the file to start with a dot to hide it
func (p *PlatformManager) HideFile(filePath string) bool {
	if p.IsHidden(filePath) {
		return true
	}

	dir := filepath.Dir(filePath)
	base := filepath.Base(filePath)
	newPath := filepath.Join(dir, "."+base)
	if err := os.Rename(filePath, newPath); err != nil {
		logPrintf("Error hiding file %s: %v", filePath, err)
		return false
	}
	return true
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
