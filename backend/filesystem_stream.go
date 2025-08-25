//go:build windows

package backend

import (
	"path/filepath"
	"strings"
	"sync"
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

// Global extension cache to avoid repeated string operations
var (
	extensionCache   = make(map[string]string)
	extensionCacheMu sync.RWMutex
)

// getExtensionCached returns the cached extension for a filename
func getExtensionCached(name string) string {
	extensionCacheMu.RLock()
	if ext, ok := extensionCache[name]; ok {
		extensionCacheMu.RUnlock()
		return ext
	}
	extensionCacheMu.RUnlock()

	// Calculate extension
	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))

	// Cache it
	extensionCacheMu.Lock()
	// Double-check to avoid race condition
	if _, ok := extensionCache[name]; !ok {
		// Limit cache size to prevent unbounded growth
		if len(extensionCache) < 10000 {
			extensionCache[name] = ext
		}
	}
	extensionCacheMu.Unlock()

	return ext
}

// listDirectoryBasicEnhanced uses Win32 FindFirstFileExW to get Name+Attrs+Size+ModTime in one syscall
// This is significantly faster than os.ReadDir + per-file stat calls
func listDirectoryBasicEnhanced(dir string) ([]EnhancedBasicEntry, error) {
	// Use FindExInfoBasic for better performance - skips short name retrieval
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

	// Pre-allocate with generous capacity to minimize reallocations
	// Most directories have < 1000 files
	entries := make([]EnhancedBasicEntry, 0, 256)

	// Pre-calculate the directory path length for faster string concatenation
	dirLen := len(dir)
	if dir[dirLen-1] != '\\' && dir[dirLen-1] != '/' {
		dir = dir + "\\"
		dirLen++
	}

	// Reusable string builder for paths
	pathBuilder := strings.Builder{}
	pathBuilder.Grow(dirLen + 260) // Max path length on Windows

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

		// Get extension for files only using cache
		var ext string
		if !isDir {
			ext = getExtensionCached(name)
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
		permissions := generatePermissionsStringFast(attr, isDir)

		// Build path efficiently
		pathBuilder.Reset()
		pathBuilder.WriteString(dir)
		pathBuilder.WriteString(name)
		fullPath := pathBuilder.String()

		entry := EnhancedBasicEntry{
			BasicEntry: BasicEntry{
				Name:      name,
				Path:      fullPath,
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

// Pre-built permission strings to avoid repeated string operations
var (
	permReadOnly  = "dr--r--"
	permReadWrite = "drw-r--"
	permFileRO    = "-r--r--"
	permFileRW    = "-rw-r--"
)

// generatePermissionsStringFast creates a permission string from Windows file attributes
// using pre-built strings to avoid allocations
func generatePermissionsStringFast(attr uint32, isDir bool) string {
	if isDir {
		if attr&syscall.FILE_ATTRIBUTE_READONLY != 0 {
			return permReadOnly
		}
		return permReadWrite
	}

	if attr&syscall.FILE_ATTRIBUTE_READONLY != 0 {
		return permFileRO
	}
	return permFileRW
}
