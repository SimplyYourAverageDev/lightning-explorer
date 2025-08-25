//go:build !windows

package backend

import (
	"os"
	"path/filepath"
	"strings"
	"sync"
)

// BasicEntry holds minimal info for instant UI rendering
type BasicEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Extension string `json:"extension"`
	IsHidden  bool   `json:"isHidden"`
}

// EnhancedBasicEntry holds complete file information
type EnhancedBasicEntry struct {
	BasicEntry
	Size        int64  `json:"size"`
	ModTime     int64  `json:"modTime"`
	Permissions string `json:"permissions"`
}

var (
	extensionCache   = make(map[string]string)
	extensionCacheMu sync.RWMutex
)

func getExtensionCached(name string) string {
	extensionCacheMu.RLock()
	if ext, ok := extensionCache[name]; ok {
		extensionCacheMu.RUnlock()
		return ext
	}
	extensionCacheMu.RUnlock()

	ext := strings.ToLower(strings.TrimPrefix(filepath.Ext(name), "."))

	extensionCacheMu.Lock()
	if _, ok := extensionCache[name]; !ok {
		if len(extensionCache) < 10000 {
			extensionCache[name] = ext
		}
	}
	extensionCacheMu.Unlock()

	return ext
}

// listDirectoryBasicEnhanced uses standard library to enumerate directory entries
func listDirectoryBasicEnhanced(dir string) ([]EnhancedBasicEntry, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	result := make([]EnhancedBasicEntry, 0, len(entries))
	for _, entry := range entries {
		name := entry.Name()
		fullPath := filepath.Join(dir, name)
		info, err := entry.Info()
		if err != nil {
			continue
		}
		isDir := entry.IsDir()
		isHidden := strings.HasPrefix(name, ".")
		ext := ""
		if !isDir {
			ext = getExtensionCached(name)
		}
		result = append(result, EnhancedBasicEntry{
			BasicEntry: BasicEntry{
				Name:      name,
				Path:      fullPath,
				IsDir:     isDir,
				IsHidden:  isHidden,
				Extension: ext,
			},
			Size:        info.Size(),
			ModTime:     info.ModTime().Unix(),
			Permissions: info.Mode().String(),
		})
	}

	return result, nil
}
