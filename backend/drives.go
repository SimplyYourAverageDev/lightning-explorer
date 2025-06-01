package backend

import (
	"fmt"
	"log"
	"os"
	"runtime"
)

// NewDriveManager creates a new drive manager instance
func NewDriveManager() *DriveManager {
	return &DriveManager{}
}

// GetDriveInfo returns information about available drives
func (d *DriveManager) GetDriveInfo() []DriveInfo {
	var drives []DriveInfo

	switch runtime.GOOS {
	case "windows":
		drives = d.getWindowsDrives()
	case "darwin":
		drives = d.getMacVolumes()
	case "linux":
		drives = d.getLinuxMountPoints()
	default:
		log.Printf("Drive enumeration not supported on %s", runtime.GOOS)
	}

	return drives
}

// getWindowsDrives returns Windows drive information
func (d *DriveManager) getWindowsDrives() []DriveInfo {
	var drives []DriveInfo

	for i := 'A'; i <= 'Z'; i++ {
		drive := fmt.Sprintf("%c:\\", i)
		if _, err := os.Stat(drive); err == nil {
			driveInfo := DriveInfo{
				Path:   drive,
				Letter: string(i),
				Name:   fmt.Sprintf("Drive %c:", i),
			}

			// Try to get more detailed drive information
			if driveType := d.getWindowsDriveType(drive); driveType != "" {
				driveInfo.Name = fmt.Sprintf("%s (%s)", driveInfo.Name, driveType)
			}

			drives = append(drives, driveInfo)
		}
	}

	return drives
}

// getWindowsDriveType gets the type of Windows drive (if possible)
func (d *DriveManager) getWindowsDriveType(drive string) string {
	// This is a simplified implementation
	// In a more advanced version, you could use Windows API calls
	// to get detailed drive information like volume labels, types, etc.

	// For now, we'll just return empty string
	// Future enhancement: Use syscalls to get actual drive type
	return ""
}

// getMacVolumes returns macOS volume information
func (d *DriveManager) getMacVolumes() []DriveInfo {
	var drives []DriveInfo

	// Add root volume
	drives = append(drives, DriveInfo{
		Path:   "/",
		Letter: "",
		Name:   "Macintosh HD",
	})

	// Add /Volumes if it exists
	if _, err := os.Stat("/Volumes"); err == nil {
		if entries, err := os.ReadDir("/Volumes"); err == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					volumePath := fmt.Sprintf("/Volumes/%s", entry.Name())
					drives = append(drives, DriveInfo{
						Path:   volumePath,
						Letter: "",
						Name:   entry.Name(),
					})
				}
			}
		}
	}

	return drives
}

// getLinuxMountPoints returns Linux mount point information
func (d *DriveManager) getLinuxMountPoints() []DriveInfo {
	var drives []DriveInfo

	// Add root filesystem
	drives = append(drives, DriveInfo{
		Path:   "/",
		Letter: "",
		Name:   "Root Filesystem",
	})

	// Add common mount points
	commonMounts := []struct {
		path string
		name string
	}{
		{"/home", "Home"},
		{"/media", "Media"},
		{"/mnt", "Mount"},
		{"/opt", "Optional"},
		{"/usr", "User Programs"},
		{"/var", "Variable Data"},
	}

	for _, mount := range commonMounts {
		if _, err := os.Stat(mount.path); err == nil {
			drives = append(drives, DriveInfo{
				Path:   mount.path,
				Letter: "",
				Name:   mount.name,
			})
		}
	}

	return drives
}

// GetSystemRoots returns system root paths for quick navigation
func (d *DriveManager) GetSystemRoots() []string {
	var roots []string

	switch runtime.GOOS {
	case "windows":
		// Get all available drive letters
		for i := 'A'; i <= 'Z'; i++ {
			drive := fmt.Sprintf("%c:\\", i)
			if _, err := os.Stat(drive); err == nil {
				roots = append(roots, drive)
			}
		}
	default:
		// Unix-like systems start from root
		roots = append(roots, "/")
	}

	return roots
}

// GetQuickAccessPaths returns commonly accessed directories for quick navigation
func (d *DriveManager) GetQuickAccessPaths() []DriveInfo {
	var quickPaths []DriveInfo

	switch runtime.GOOS {
	case "windows":
		quickPaths = d.getWindowsQuickAccess()
	case "darwin":
		quickPaths = d.getMacQuickAccess()
	case "linux":
		quickPaths = d.getLinuxQuickAccess()
	}

	return quickPaths
}

// getWindowsQuickAccess returns Windows quick access paths
func (d *DriveManager) getWindowsQuickAccess() []DriveInfo {
	var quickPaths []DriveInfo

	// Get common Windows directories
	homeDir, _ := os.UserHomeDir()

	commonPaths := []struct {
		path string
		name string
	}{
		{homeDir, "Home"},
		{fmt.Sprintf("%s\\Desktop", homeDir), "Desktop"},
		{fmt.Sprintf("%s\\Documents", homeDir), "Documents"},
		{fmt.Sprintf("%s\\Downloads", homeDir), "Downloads"},
		{fmt.Sprintf("%s\\Pictures", homeDir), "Pictures"},
		{fmt.Sprintf("%s\\Music", homeDir), "Music"},
		{fmt.Sprintf("%s\\Videos", homeDir), "Videos"},
		{"C:\\Program Files", "Program Files"},
		{"C:\\Program Files (x86)", "Program Files (x86)"},
		{"C:\\Windows", "Windows"},
	}

	for _, path := range commonPaths {
		if _, err := os.Stat(path.path); err == nil {
			quickPaths = append(quickPaths, DriveInfo{
				Path:   path.path,
				Letter: "",
				Name:   path.name,
			})
		}
	}

	return quickPaths
}

// getMacQuickAccess returns macOS quick access paths
func (d *DriveManager) getMacQuickAccess() []DriveInfo {
	var quickPaths []DriveInfo

	homeDir, _ := os.UserHomeDir()

	commonPaths := []struct {
		path string
		name string
	}{
		{homeDir, "Home"},
		{fmt.Sprintf("%s/Desktop", homeDir), "Desktop"},
		{fmt.Sprintf("%s/Documents", homeDir), "Documents"},
		{fmt.Sprintf("%s/Downloads", homeDir), "Downloads"},
		{fmt.Sprintf("%s/Pictures", homeDir), "Pictures"},
		{fmt.Sprintf("%s/Music", homeDir), "Music"},
		{fmt.Sprintf("%s/Movies", homeDir), "Movies"},
		{"/Applications", "Applications"},
		{"/System", "System"},
		{"/Users", "Users"},
	}

	for _, path := range commonPaths {
		if _, err := os.Stat(path.path); err == nil {
			quickPaths = append(quickPaths, DriveInfo{
				Path:   path.path,
				Letter: "",
				Name:   path.name,
			})
		}
	}

	return quickPaths
}

// getLinuxQuickAccess returns Linux quick access paths
func (d *DriveManager) getLinuxQuickAccess() []DriveInfo {
	var quickPaths []DriveInfo

	homeDir, _ := os.UserHomeDir()

	commonPaths := []struct {
		path string
		name string
	}{
		{homeDir, "Home"},
		{fmt.Sprintf("%s/Desktop", homeDir), "Desktop"},
		{fmt.Sprintf("%s/Documents", homeDir), "Documents"},
		{fmt.Sprintf("%s/Downloads", homeDir), "Downloads"},
		{fmt.Sprintf("%s/Pictures", homeDir), "Pictures"},
		{fmt.Sprintf("%s/Music", homeDir), "Music"},
		{fmt.Sprintf("%s/Videos", homeDir), "Videos"},
		{"/usr", "User Programs"},
		{"/opt", "Optional Software"},
		{"/etc", "Configuration"},
		{"/var", "Variable Data"},
	}

	for _, path := range commonPaths {
		if _, err := os.Stat(path.path); err == nil {
			quickPaths = append(quickPaths, DriveInfo{
				Path:   path.path,
				Letter: "",
				Name:   path.name,
			})
		}
	}

	return quickPaths
}
