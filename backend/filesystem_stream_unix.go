//go:build !windows

package backend

import (
	"os"
	"path/filepath"
	"strings"
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

func enumerateDirectoryBasicEnhanced(dir string, includeHidden bool, fn func(EnhancedBasicEntry) bool) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		name := entry.Name()
		isHidden := strings.HasPrefix(name, ".")
		if !includeHidden && isHidden {
			continue
		}

		fullPath := filepath.Join(dir, name)
		info, err := entry.Info()
		if err != nil {
			continue
		}
		isDir := entry.IsDir()

		var ext string
		if !isDir {
			if idx := strings.LastIndexByte(name, '.'); idx >= 0 && idx+1 < len(name) {
				ext = strings.ToLower(name[idx+1:])
			}
		}

		enhanced := EnhancedBasicEntry{
			BasicEntry: BasicEntry{
				Name:      name,
				Path:      fullPath,
				IsDir:     isDir,
				Extension: ext,
				IsHidden:  isHidden,
			},
			Size:        info.Size(),
			ModTime:     info.ModTime().Unix(),
			Permissions: info.Mode().String(),
		}

		if !fn(enhanced) {
			break
		}
	}

	return nil
}

func listDirectoryBasicEnhanced(dir string, includeHidden bool) ([]EnhancedBasicEntry, error) {
	result := make([]EnhancedBasicEntry, 0, 256)
	err := enumerateDirectoryBasicEnhanced(dir, includeHidden, func(entry EnhancedBasicEntry) bool {
		result = append(result, entry)
		return true
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
