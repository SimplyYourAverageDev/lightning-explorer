//go:build windows

package backend

import (
	"log"
	"path/filepath"
	"syscall"
	"unsafe"
)

func (fo *FileOperationsManager) moveToWindowsRecycleBinNative(filePaths []string) bool {
	log.Printf("Moving files to Windows Recycle Bin using native API")

	if len(filePaths) == 0 {
		return true
	}

	var pathsUTF16 []uint16
	for _, path := range filePaths {
		clean := filepath.Clean(path)
		if !filepath.IsAbs(clean) {
			log.Printf("Error: File path must be absolute: %s", path)
			return false
		}
		pathUTF16, err := syscall.UTF16FromString(clean)
		if err != nil {
			log.Printf("Failed to convert path to UTF16: %s, error: %v", clean, err)
			return false
		}
		pathsUTF16 = append(pathsUTF16, pathUTF16[:len(pathUTF16)-1]...)
		pathsUTF16 = append(pathsUTF16, 0)
	}
	pathsUTF16 = append(pathsUTF16, 0)

	fileOp := SHFILEOPSTRUCT{
		Hwnd:   0,
		WFunc:  FO_DELETE,
		PFrom:  uintptr(unsafe.Pointer(&pathsUTF16[0])),
		PTo:    0,
		FFlags: FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT,
	}

	ret, _, err := shFileOperationW.Call(uintptr(unsafe.Pointer(&fileOp)))
	if ret != 0 {
		log.Printf("SHFileOperationW failed with code %d: %v", ret, err)
		return false
	}

	return true
}
