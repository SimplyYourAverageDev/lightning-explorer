package backend

import (
	"log"
	"runtime"
)

// GetDriveInfo returns information about system drives
func (a *App) GetDriveInfo() []DriveInfo {
	return a.driveMgr().GetDriveInfo()
}

// GetQuickAccessPaths returns commonly accessed directories
func (a *App) GetQuickAccessPaths() []DriveInfo {
	return a.driveMgr().GetQuickAccessPaths()
}

// EjectDrive safely ejects a drive using OS-specific methods
func (a *App) EjectDrive(drivePath string) bool {
	log.Printf("🔄 EjectDrive called for: %s", drivePath)

	// Validate input
	if drivePath == "" {
		log.Printf("❌ EjectDrive: empty drive path provided")
		return false
	}

	// Use platform-specific implementation
	switch runtime.GOOS {
	case "windows":
		return a.platform.EjectDriveWindows(drivePath)
	default:
		log.Printf("❌ EjectDrive: unsupported platform %s", runtime.GOOS)
		return false
	}
}

// ShowDriveProperties shows drive properties using OS-specific methods
func (a *App) ShowDriveProperties(drivePath string) bool {
	log.Printf("🔄 ShowDriveProperties called for: %s", drivePath)
	return a.platform.OpenInSystemExplorer(drivePath)
}
