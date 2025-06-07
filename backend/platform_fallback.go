//go:build !windows

package backend

import (
	"fmt"
)

// Native Windows API stub implementations for non-Windows platforms
func (p *PlatformManager) IsHiddenWindowsNative(filePath string) bool {
	// This should not be called on non-Windows platforms
	return false
}

func (p *PlatformManager) HideFileWindowsNative(filePath string) bool {
	// This should not be called on non-Windows platforms
	return false
}

func (p *PlatformManager) GetCurrentUserSIDNative() (string, error) {
	return "", fmt.Errorf("native SID retrieval only available on Windows")
}

// No CF_HDROP clipboard on non-Windows
func (p *PlatformManager) SetClipboardFilePaths(paths []string) bool {
	return false
}
