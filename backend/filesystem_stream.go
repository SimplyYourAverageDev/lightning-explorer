//go:build windows

package backend

import (
	"os"
	"path/filepath"
	"strings"
	"syscall"
)

// BasicEntry holds minimal info for instant UI rendering
type BasicEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Extension string `json:"extension"`
	IsHidden  bool   `json:"isHidden"`
}

// HydratedEntry holds complete file information for background processing
type HydratedEntry struct {
	BasicEntry
	Size        int64  `json:"size"`
	ModTime     int64  `json:"modTime"` // Unix timestamp for faster JSON serialization
	Permissions string `json:"permissions"`
}

// listDirectoryBasic uses Win32 FindFirstFileExW to get Name+Attrs in one syscall
// This is significantly faster than os.ReadDir + per-file stat calls
func listDirectoryBasic(dir string) ([]BasicEntry, error) {
	search := filepath.Join(dir, "*")
	searchPtr, err := syscall.UTF16PtrFromString(search)
	if err != nil {
		return nil, err
	}

	var fd syscall.Win32finddata
	handle, err := syscall.FindFirstFile(searchPtr, &fd)
	if err != nil {
		return nil, err
	}
	defer syscall.FindClose(handle)

	// Pre-allocate with reasonable capacity
	entries := make([]BasicEntry, 0, 64)

	for {
		name := syscall.UTF16ToString(fd.FileName[:])

		// Skip current and parent directory entries
		if name == "." || name == ".." {
			err = syscall.FindNextFile(handle, &fd)
			if err != nil {
				if err == syscall.ERROR_NO_MORE_FILES {
					break
				}
				return entries, err // Return partial results on error
			}
			continue
		}

		// Extract file attributes from Win32 data
		attr := fd.FileAttributes
		isDir := attr&syscall.FILE_ATTRIBUTE_DIRECTORY != 0
		isHidden := attr&syscall.FILE_ATTRIBUTE_HIDDEN != 0 ||
			attr&syscall.FILE_ATTRIBUTE_SYSTEM != 0

		// Get extension for files only
		var ext string
		if !isDir {
			ext = strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
		}

		entry := BasicEntry{
			Name:      name,
			Path:      filepath.Join(dir, name),
			IsDir:     isDir,
			IsHidden:  isHidden,
			Extension: ext,
		}

		entries = append(entries, entry)

		err = syscall.FindNextFile(handle, &fd)
		if err != nil {
			if err == syscall.ERROR_NO_MORE_FILES {
				break
			}
			return entries, err // Return partial results on error
		}
	}

	return entries, nil
}

// listDirectoryBasicFallback provides fallback for non-Windows systems
func listDirectoryBasicFallback(dir string, platform PlatformManagerInterface) ([]BasicEntry, error) {
	// Use os package for cross-platform compatibility
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	basic := make([]BasicEntry, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		fullPath := filepath.Join(dir, name)

		// Use entry.Info() to get file info
		info, err := entry.Info()
		if err != nil {
			continue // Skip files we can't stat
		}

		isDir := info.IsDir()
		isHidden := platform.IsHidden(fullPath)

		var ext string
		if !isDir && len(name) > 0 {
			ext = strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))
		}

		basic = append(basic, BasicEntry{
			Name:      name,
			Path:      fullPath,
			IsDir:     isDir,
			IsHidden:  isHidden,
			Extension: ext,
		})
	}

	return basic, nil
}
