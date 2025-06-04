//go:build windows

package backend

import (
	"fmt"
	"log"
	"os"
	"strings"
	"syscall"
	"unsafe"
)

var (
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")

	// Kernel32 procedures
	getLogicalDriveStringsW = kernel32.NewProc("GetLogicalDriveStringsW")
	getLogicalDrives        = kernel32.NewProc("GetLogicalDrives")
	getVolumeInformationW   = kernel32.NewProc("GetVolumeInformationW")
	getFileAttributesW      = kernel32.NewProc("GetFileAttributesW")
	setFileAttributesW      = kernel32.NewProc("SetFileAttributesW")
	getCurrentProcess       = kernel32.NewProc("GetCurrentProcess")

	// Advapi32 procedures
	openProcessToken       = advapi32.NewProc("OpenProcessToken")
	getTokenInformation    = advapi32.NewProc("GetTokenInformation")
	lookupAccountSidW      = advapi32.NewProc("LookupAccountSidW")
	convertSidToStringSidW = advapi32.NewProc("ConvertSidToStringSidW")
	localFree              = kernel32.NewProc("LocalFree")
)

// Windows constants
const (
	FILE_ATTRIBUTE_HIDDEN    = 0x2
	FILE_ATTRIBUTE_DIRECTORY = 0x10
	FILE_ATTRIBUTE_SYSTEM    = 0x4

	TOKEN_QUERY = 0x0008
	TokenUser   = 1

	INVALID_FILE_ATTRIBUTES = 0xFFFFFFFF
)

// GetSystemRootsWindows uses GetLogicalDriveStringsW for faster drive enumeration.
func (p *PlatformManager) GetSystemRootsWindows() []string {
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

// IsHiddenWindowsNative checks if a file has the Windows hidden attribute using native API
func (p *PlatformManager) IsHiddenWindowsNative(filePath string) bool {
	filePathPtr, err := syscall.UTF16PtrFromString(filePath)
	if err != nil {
		return false
	}

	ret, _, _ := getFileAttributesW.Call(uintptr(unsafe.Pointer(filePathPtr)))
	if ret == INVALID_FILE_ATTRIBUTES {
		return false
	}

	attributes := uint32(ret)
	return (attributes&FILE_ATTRIBUTE_HIDDEN != 0) || (attributes&FILE_ATTRIBUTE_SYSTEM != 0)
}

// HideFileWindowsNative sets the hidden attribute on Windows using native API
func (p *PlatformManager) HideFileWindowsNative(filePath string) bool {
	log.Printf("Setting hidden attribute on Windows using native API: %s", filePath)

	filePathPtr, err := syscall.UTF16PtrFromString(filePath)
	if err != nil {
		log.Printf("Failed to convert file path to UTF16: %v", err)
		return false
	}

	// Get current attributes first
	ret, _, _ := getFileAttributesW.Call(uintptr(unsafe.Pointer(filePathPtr)))
	if ret == INVALID_FILE_ATTRIBUTES {
		log.Printf("Failed to get current file attributes")
		return false
	}

	currentAttributes := uint32(ret)
	newAttributes := currentAttributes | FILE_ATTRIBUTE_HIDDEN

	// Set the new attributes with hidden flag
	ret, _, err = setFileAttributesW.Call(
		uintptr(unsafe.Pointer(filePathPtr)),
		uintptr(newAttributes),
	)

	if ret == 0 {
		log.Printf("Failed to set hidden attribute: %v", err)
		return false
	}

	log.Printf("Successfully set hidden attribute using native API: %s", filePath)
	return true
}

// GetCurrentUserSIDNative gets the current user's SID using native Windows APIs with proper memory safety
func (p *PlatformManager) GetCurrentUserSIDNative() (string, error) {
	// Get current process handle
	processHandle, _, err := getCurrentProcess.Call()
	if processHandle == 0 {
		return "", fmt.Errorf("failed to get current process handle: %v", err)
	}

	// Open process token
	var tokenHandle syscall.Handle
	ret, _, err := openProcessToken.Call(
		processHandle,
		TOKEN_QUERY,
		uintptr(unsafe.Pointer(&tokenHandle)),
	)
	if ret == 0 {
		return "", fmt.Errorf("failed to open process token: %v", err)
	}
	defer syscall.CloseHandle(tokenHandle)

	// Get token information size
	var tokenUserSize uint32
	ret, _, _ = getTokenInformation.Call(
		uintptr(tokenHandle),
		TokenUser,
		0,
		0,
		uintptr(unsafe.Pointer(&tokenUserSize)),
	)

	// Check if we got a valid size
	if tokenUserSize == 0 {
		return "", fmt.Errorf("failed to get token user information size")
	}

	// Allocate buffer for token user info
	tokenUserBuffer := make([]byte, tokenUserSize)
	ret, _, err = getTokenInformation.Call(
		uintptr(tokenHandle),
		TokenUser,
		uintptr(unsafe.Pointer(&tokenUserBuffer[0])),
		uintptr(tokenUserSize),
		uintptr(unsafe.Pointer(&tokenUserSize)),
	)
	if ret == 0 {
		return "", fmt.Errorf("failed to get token user information: %v", err)
	}

	// Extract SID from token user structure
	// TOKEN_USER structure: first 8 bytes is SID pointer (on 64-bit) or 4 bytes (on 32-bit)
	var sidPtr uintptr
	if unsafe.Sizeof(uintptr(0)) == 8 { // 64-bit
		sidPtr = *(*uintptr)(unsafe.Pointer(&tokenUserBuffer[0]))
	} else { // 32-bit
		sidPtr = uintptr(*(*uint32)(unsafe.Pointer(&tokenUserBuffer[0])))
	}

	// Validate SID pointer
	if sidPtr == 0 {
		return "", fmt.Errorf("invalid SID pointer in token user structure")
	}

	// Convert SID to string
	var sidStringPtr uintptr
	ret, _, err = convertSidToStringSidW.Call(
		sidPtr,
		uintptr(unsafe.Pointer(&sidStringPtr)),
	)
	if ret == 0 {
		return "", fmt.Errorf("failed to convert SID to string: %v", err)
	}
	defer localFree.Call(sidStringPtr)

	// Validate SID string pointer
	if sidStringPtr == 0 {
		return "", fmt.Errorf("invalid SID string pointer returned by ConvertSidToStringSidW")
	}

	// CRITICAL FIX: Use proper UTF16ToString with safe null-terminated slice
	// This prevents buffer overflow and memory corruption
	sidStringPtr16 := (*uint16)(unsafe.Pointer(sidStringPtr))

	// Find the length of the null-terminated UTF16 string safely
	var sidLength int
	for i := 0; i < 1000; i++ { // Reasonable upper bound
		if *(*uint16)(unsafe.Pointer(uintptr(unsafe.Pointer(sidStringPtr16)) + uintptr(i*2))) == 0 {
			sidLength = i
			break
		}
	}

	if sidLength == 0 {
		return "", fmt.Errorf("could not determine SID string length")
	}

	// Create a safe slice of the exact length
	sidSlice := (*[1000]uint16)(unsafe.Pointer(sidStringPtr16))[:sidLength:sidLength]
	sidString := syscall.UTF16ToString(sidSlice)

	// Additional validation: Check if SID string is reasonable
	if sidString == "" {
		return "", fmt.Errorf("empty SID string returned")
	}

	// Basic SID format validation (should start with S-)
	if !strings.HasPrefix(sidString, "S-") {
		return "", fmt.Errorf("invalid SID format: %s", sidString)
	}

	// Length validation (Windows SIDs are typically 15-184 characters)
	if len(sidString) < 10 || len(sidString) > 200 {
		return "", fmt.Errorf("SID string length out of expected range: %d characters", len(sidString))
	}

	return sidString, nil
}
