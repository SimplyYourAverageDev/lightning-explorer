package backend

import (
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

// EnhancedBasicEntry holds complete file information from FindFirstFileExW syscall
// This eliminates the need for additional os.Stat calls on Windows
type EnhancedBasicEntry struct {
	BasicEntry
	Size        int64  `json:"size"`
	ModTime     int64  `json:"modTime"` // Unix timestamp for faster JSON serialization
	Permissions string `json:"permissions"`
}

// listDirectoryBasicEnhanced uses Win32 FindFirstFileExW to get Name+Attrs+Size+ModTime in one syscall
// This is significantly faster than os.ReadDir + per-file stat calls
func listDirectoryBasicEnhanced(dir string) ([]EnhancedBasicEntry, error) {
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
	entries := make([]EnhancedBasicEntry, 0, 64)

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

		// Convert Win32 FILETIME to Unix timestamp (int64)
		// FILETIME is 100-nanosecond intervals since January 1, 1601 (UTC)
		ft := syscall.Filetime{LowDateTime: fd.LastWriteTime.LowDateTime, HighDateTime: fd.LastWriteTime.HighDateTime}
		modTime := ft.Nanoseconds() / 1e9 // Convert to Unix timestamp

		// Calculate file size from high and low parts
		var size int64
		if !isDir {
			size = int64(fd.FileSizeHigh)<<32 + int64(fd.FileSizeLow)
		}

		// Generate basic permissions string from attributes
		permissions := generatePermissionsString(attr, isDir)

		entry := EnhancedBasicEntry{
			BasicEntry: BasicEntry{
				Name:      name,
				Path:      filepath.Join(dir, name),
				IsDir:     isDir,
				IsHidden:  isHidden,
				Extension: ext,
			},
			Size:        size,
			ModTime:     modTime,
			Permissions: permissions,
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

// generatePermissionsString creates a permission string from Windows file attributes
func generatePermissionsString(attr uint32, isDir bool) string {
	var perms []string

	if isDir {
		perms = append(perms, "d")
	} else {
		perms = append(perms, "-")
	}

	// Owner permissions (simplified Windows approach)
	perms = append(perms, "rw")
	if attr&syscall.FILE_ATTRIBUTE_READONLY != 0 {
		perms = append(perms, "-")
	} else {
		perms = append(perms, "w")
	}

	// Group and other permissions (Windows doesn't have these concepts, so simplified)
	perms = append(perms, "r--r--")

	return strings.Join(perms, "")
}
