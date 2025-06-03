//go:build windows

package backend

import (
	"log"
	"os"
	"syscall"
	"unsafe"
)

// GetSystemRootsWindows uses GetLogicalDriveStringsW for faster drive enumeration.
func (p *PlatformManager) GetSystemRootsWindows() []string {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getLogicalDriveStringsW := kernel32.NewProc("GetLogicalDriveStringsW")

	buffer := make([]uint16, 256) // Max 26 drives * 4 chars (C:\) + nulls + final null
	buflen := uint32(len(buffer))

	ret, _, err := getLogicalDriveStringsW.Call(uintptr(buflen), uintptr(unsafe.Pointer(&buffer[0])))
	if ret == 0 {
		log.Printf("Failed to get logical drive strings: %v", err)
		// Fallback to slower method if API call fails
		return p.getSystemRootsFallback()
	}

	var roots []string
	current := 0
	for i, val := range buffer {
		if val == 0 && i > current { // Null terminator for a path
			if i > current {
				roots = append(roots, syscall.UTF16ToString(buffer[current:i]))
			}
			current = i + 1
			if current >= len(buffer) || buffer[current] == 0 { // Double null terminator indicates end of list
				break
			}
		}
	}
	return roots
}

// getSystemRootsFallback provides fallback drive enumeration for Windows
func (p *PlatformManager) getSystemRootsFallback() []string {
	var roots []string
	// Fallback to original method if Windows API fails
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getLogicalDrives := kernel32.NewProc("GetLogicalDrives")

	ret, _, err := getLogicalDrives.Call()
	if err != nil && ret == 0 {
		// If this also fails, fall back to the original os.Stat method
		for i := 'A'; i <= 'Z'; i++ {
			drive := string(i) + ":\\"
			if _, e := os.Stat(drive); e == nil {
				roots = append(roots, drive)
			}
		}
		return roots
	}

	logicalDrives := uint32(ret)
	for i := 'A'; i <= 'Z'; i++ {
		driveIndex := i - 'A'
		if logicalDrives&(1<<driveIndex) != 0 {
			drive := string(i) + ":\\"
			roots = append(roots, drive)
		}
	}
	return roots
}

// GetWindowsDrivesOptimized uses Windows API for faster drive enumeration with detailed info
func (p *PlatformManager) GetWindowsDrivesOptimized() []DriveInfo {
	var drives []DriveInfo

	// Get all logical drives first
	driveStrings := p.GetSystemRootsWindows()

	for _, driveString := range driveStrings {
		driveInfo := DriveInfo{
			Path:   driveString,
			Letter: string(driveString[0]),
			Name:   "",
		}

		// Try to get volume information using GetVolumeInformationW
		if volumeLabel := p.getVolumeLabel(driveString); volumeLabel != "" {
			driveInfo.Name = volumeLabel + " (" + driveString[:2] + ")"
		} else {
			driveInfo.Name = "Drive " + driveString[:2]
		}

		drives = append(drives, driveInfo)
	}

	return drives
}

// getVolumeLabel gets the volume label for a drive using GetVolumeInformationW
func (p *PlatformManager) getVolumeLabel(drivePath string) string {
	kernel32 := syscall.NewLazyDLL("kernel32.dll")
	getVolumeInformationW := kernel32.NewProc("GetVolumeInformationW")

	// Convert drive path to UTF16 pointer
	drivePathPtr, err := syscall.UTF16PtrFromString(drivePath)
	if err != nil {
		return ""
	}

	// Buffer for volume name
	volumeNameBuffer := make([]uint16, 261) // MAX_PATH + 1
	volumeNameSize := uint32(len(volumeNameBuffer))

	// Call GetVolumeInformationW
	ret, _, err := getVolumeInformationW.Call(
		uintptr(unsafe.Pointer(drivePathPtr)),
		uintptr(unsafe.Pointer(&volumeNameBuffer[0])),
		uintptr(volumeNameSize),
		0, // Volume serial number (not needed)
		0, // Maximum component length (not needed)
		0, // File system flags (not needed)
		0, // File system name buffer (not needed)
		0, // File system name size (not needed)
	)

	if ret == 0 {
		// API call failed, return empty string
		return ""
	}

	// Convert UTF16 buffer to string
	return syscall.UTF16ToString(volumeNameBuffer)
}
