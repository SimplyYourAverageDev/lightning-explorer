//go:build windows

package backend

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

var (
	kernel32 = syscall.NewLazyDLL("kernel32.dll")
	advapi32 = syscall.NewLazyDLL("advapi32.dll")
	// user32.dll for clipboard
	user32 = syscall.NewLazyDLL("user32.dll")

	// Kernel32 procedures
	getLogicalDriveStringsW = kernel32.NewProc("GetLogicalDriveStringsW")
	getLogicalDrives        = kernel32.NewProc("GetLogicalDrives")
	getVolumeInformationW   = kernel32.NewProc("GetVolumeInformationW")
	getFileAttributesW      = kernel32.NewProc("GetFileAttributesW")
	setFileAttributesW      = kernel32.NewProc("SetFileAttributesW")
	getCurrentProcess       = kernel32.NewProc("GetCurrentProcess")
	// global alloc / lock / unlock in kernel32
	globalAlloc  = kernel32.NewProc("GlobalAlloc")
	globalLock   = kernel32.NewProc("GlobalLock")
	globalUnlock = kernel32.NewProc("GlobalUnlock")

	// Advapi32 procedures
	openProcessToken       = advapi32.NewProc("OpenProcessToken")
	getTokenInformation    = advapi32.NewProc("GetTokenInformation")
	convertSidToStringSidW = advapi32.NewProc("ConvertSidToStringSidW")
	localFree              = kernel32.NewProc("LocalFree")

	// User32 procedures for clipboard
	openClipboard    = user32.NewProc("OpenClipboard")
	emptyClipboard   = user32.NewProc("EmptyClipboard")
	setClipboardData = user32.NewProc("SetClipboardData")
	closeClipboard   = user32.NewProc("CloseClipboard")

	// New procedure for registering clipboard format
	registerClipboardFormatW = user32.NewProc("RegisterClipboardFormatW")
)

// Windows constants
const (
	FILE_ATTRIBUTE_HIDDEN    = 0x2
	FILE_ATTRIBUTE_DIRECTORY = 0x10
	FILE_ATTRIBUTE_SYSTEM    = 0x4

	TOKEN_QUERY = 0x0008
	TokenUser   = 1

	INVALID_FILE_ATTRIBUTES = 0xFFFFFFFF

	// Clipboard constants
	CF_HDROP      = 15
	GMEM_MOVEABLE = 0x0002
)

// dropfiles + POINT structures for CF_HDROP
type point struct{ X, Y int32 }
type dropfiles struct {
	PFiles uint32 // offset of file list
	Pt     point
	FNC    uint32
	FWide  uint32
}

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
	ret, _, _ := getVolumeInformationW.Call(
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
	_, _, _ = getTokenInformation.Call(
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
		//nolint:unsafeptr // This is the correct Win32 API pattern for TOKEN_USER structure
		sidPtr = *(*uintptr)(unsafe.Pointer(&tokenUserBuffer[0]))
	} else { // 32-bit
		//nolint:unsafeptr // This is the correct Win32 API pattern for TOKEN_USER structure
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
	basePtr := uintptr(unsafe.Pointer(sidStringPtr16))
	for i := 0; i < 1000; i++ { // Reasonable upper bound
		if *(*uint16)(unsafe.Pointer(basePtr + uintptr(i*2))) == 0 {
			sidLength = i
			break
		}
	}

	if sidLength == 0 {
		return "", fmt.Errorf("could not determine SID string length")
	}

	// Create a safe slice of the exact length
	//nolint:unsafeptr // This is the correct Win32 API pattern for ConvertSidToStringSidW result
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

// SetClipboardFilePaths places the given absolute paths on the Windows clipboard as CF_HDROP.
func (p *PlatformManager) SetClipboardFilePaths(paths []string) bool {
	if len(paths) == 0 {
		log.Printf("SetClipboard: No paths provided")
		return false
	}

	log.Printf("SetClipboard: Setting %d file paths to clipboard: %v", len(paths), paths)

	// 1) Open & empty clipboard
	if r, _, err := openClipboard.Call(0); r == 0 {
		log.Printf("SetClipboard: OpenClipboard failed: %v", err)
		return false
	}
	defer closeClipboard.Call()
	emptyClipboard.Call()

	// 2) Build a single UTF-16 buffer of all paths, each '\0', ending with '\0\0'
	var all []uint16
	for _, f := range paths {
		// Ensure we're using absolute paths and normalize separators
		absPath := f
		if !strings.HasPrefix(f, `\\`) && len(f) > 1 && f[1] != ':' {
			// Convert relative paths to absolute if needed
			if wd, err := syscall.Getwd(); err == nil {
				absPath = wd + "\\" + f
			}
		}
		// Convert forward slashes to backslashes for Windows
		absPath = strings.ReplaceAll(absPath, "/", "\\")

		utf, err := syscall.UTF16FromString(absPath)
		if err != nil {
			log.Printf("SetClipboard: Failed to convert path to UTF16: %s, error: %v", absPath, err)
			continue
		}
		// syscall.UTF16FromString already includes null terminator, so append as-is
		all = append(all, utf...)
	}
	// Add final double NUL at end (but syscall.UTF16FromString already added one NUL per string)
	all = append(all, 0)

	// 3) Compute total size = sizeof(dropfiles) + len(all)*2 bytes
	headerSize := unsafe.Sizeof(dropfiles{})
	dataSize := uintptr(len(all) * 2)
	totalSize := headerSize + dataSize

	// 4) Allocate movable global memory block
	hMem, _, err := globalAlloc.Call(GMEM_MOVEABLE, totalSize)
	if hMem == 0 {
		log.Printf("SetClipboard: GlobalAlloc failed: %v", err)
		return false
	}
	// Lock to get pointer
	pMem, _, err := globalLock.Call(hMem)
	if pMem == 0 {
		log.Printf("SetClipboard: GlobalLock failed: %v", err)
		return false
	}
	defer globalUnlock.Call(hMem)

	// 5) Write DROPFILES header
	df := dropfiles{
		PFiles: uint32(headerSize),
		FWide:  1, // wide (UTF-16)
	}
	//nolint:unsafeptr // This is the correct Win32 API pattern for CF_HDROP DROPFILES structure
	*(*dropfiles)(unsafe.Pointer(pMem)) = df

	// 6) Write the path list right after the header
	dataPtrBase := pMem + uintptr(headerSize)
	for i, v := range all {
		//nolint:unsafeptr // This is the correct Win32 API pattern for CF_HDROP string data
		*(*uint16)(unsafe.Pointer(dataPtrBase + uintptr(i*2))) = v
	}

	// 7) Place onto clipboard
	if r, _, err := setClipboardData.Call(CF_HDROP, hMem); r == 0 {
		log.Printf("SetClipboard: SetClipboardData failed: %v", err)
		return false
	}

	// ---- NEW: Also publish CFSTR_FILENAMEW so that apps which rely on this
	//           secondary format (e.g. Microsoft Teams / Slack) keep the
	//           original file name instead of generating a GUID. Only the first
	//           file name is provided which is sufficient for these targets. ----
	if len(paths) > 0 {
		const fileNameW = "FileNameW"
		const fileNameA = "FileName"
		// Register the format and obtain an ID
		uf16, _ := syscall.UTF16PtrFromString(fileNameW)
		cfId, _, _ := registerClipboardFormatW.Call(uintptr(unsafe.Pointer(uf16)))
		if cfId != 0 {
			// The CFSTR_FILENAMEW format must contain ONLY the file name (no path)
			// according to the Windows Shell documentation. Supplying the full path
			// causes some target applications (e.g. Teams, Discord) to generate
			// GUID-based names when pasting. Extract just the base name here.

			fileName := filepath.Base(paths[0])
			w, err := syscall.UTF16FromString(fileName)
			if err == nil {
				size := uintptr(len(w) * 2) // bytes including NUL
				hMemName, _, err := globalAlloc.Call(GMEM_MOVEABLE, size)
				if hMemName != 0 {
					pName, _, _ := globalLock.Call(hMemName)
					if pName != 0 {
						// copy UTF-16 bytes
						for i, v := range w {
							*(*uint16)(unsafe.Pointer(pName + uintptr(i*2))) = v
						}
						globalUnlock.Call(hMemName)

						_, _, err := setClipboardData.Call(cfId, hMemName)
						if err != nil && err.Error() != "The operation completed successfully." {
							log.Printf("SetClipboard: failed to set FileNameW: %v", err)
						}
						// ownership transferred on success; if failure, we can Ignore (OS frees)
					}
				} else {
					log.Printf("SetClipboard: GlobalAlloc for FileNameW failed: %v", err)
				}
			}
		}
		// Also register ANSI FileName for legacy/non-Unicode consumers (e.g., some Electron apps)
		uf16a, _ := syscall.UTF16PtrFromString(fileNameA)
		cfIdA, _, _ := registerClipboardFormatW.Call(uintptr(unsafe.Pointer(uf16a)))
		if cfIdA != 0 {
			fileName := filepath.Base(paths[0])
			// Convert to system code page (ANSI)
			fnameBytes := append(syscall.StringByteSlice(fileName), 0) // include NUL
			sizeA := uintptr(len(fnameBytes))
			hMemNameA, _, err := globalAlloc.Call(GMEM_MOVEABLE, sizeA)
			if hMemNameA != 0 {
				pNameA, _, _ := globalLock.Call(hMemNameA)
				if pNameA != 0 {
					for i, b := range fnameBytes {
						*(*byte)(unsafe.Pointer(pNameA + uintptr(i))) = b
					}
					globalUnlock.Call(hMemNameA)
					_, _, err := setClipboardData.Call(cfIdA, hMemNameA)
					if err != nil && err.Error() != "The operation completed successfully." {
						log.Printf("SetClipboard: failed to set FileName: %v", err)
					}
				}
			} else {
				log.Printf("SetClipboard: GlobalAlloc for FileName failed: %v", err)
			}
		}
	}

	log.Printf("SetClipboard: Successfully set %d file paths to Windows clipboard", len(paths))
	return true
}
