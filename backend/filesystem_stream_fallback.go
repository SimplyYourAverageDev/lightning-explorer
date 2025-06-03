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

// HydratedEntry holds complete file information for background processing
type HydratedEntry struct {
	BasicEntry
	Size        int64  `json:"size"`
	ModTime     int64  `json:"modTime"` // Unix timestamp for faster JSON serialization
	Permissions string `json:"permissions"`
}

// listDirectoryBasic provides the same interface as Windows version but uses standard Go calls
func listDirectoryBasic(dir string) ([]BasicEntry, error) {
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

		// Basic hidden file detection for Unix systems
		isHidden := strings.HasPrefix(name, ".")

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
