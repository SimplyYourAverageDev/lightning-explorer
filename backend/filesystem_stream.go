//go:build windows

package backend

import (
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"
)

// BasicEntry holds minimal info for instant UI rendering
type BasicEntry struct {
	Name      string `json:"name"`
	Path      string `json:"path"`
	IsDir     bool   `json:"isDir"`
	Extension string `json:"extension"`
	IsHidden  bool   `json:"isHidden"`
}

// EnhancedBasicEntry holds complete file information from FindFirstFileExW syscall
type EnhancedBasicEntry struct {
	BasicEntry
	Size        int64  `json:"size"`
	ModTime     int64  `json:"modTime"`
	Permissions string `json:"permissions"`
}

func enumerateDirectoryBasicEnhanced(dir string, includeHidden bool, fn func(EnhancedBasicEntry) bool) error {
	search := filepath.Join(dir, "*")
	searchPtr, err := syscall.UTF16PtrFromString(search)
	if err != nil {
		return err
	}

	var fd syscall.Win32finddata

	var handle syscall.Handle
	if proc := syscall.NewLazyDLL("kernel32.dll").NewProc("FindFirstFileExW"); proc.Find() == nil {
		const findExInfoBasic = 1
		const findExSearchNameMatch = 0
		const findFirstExLargeFetch = 2
		r1, _, e1 := proc.Call(
			uintptr(unsafe.Pointer(searchPtr)),
			uintptr(findExInfoBasic),
			uintptr(unsafe.Pointer(&fd)),
			uintptr(findExSearchNameMatch),
			0,
			uintptr(findFirstExLargeFetch),
		)
		if r1 != uintptr(invalidHandleValue) && r1 != 0 {
			handle = syscall.Handle(r1)
		} else {
			h, err2 := syscall.FindFirstFile(searchPtr, &fd)
			if err2 != nil {
				if e1 != nil {
					return e1
				}
				return err2
			}
			handle = h
		}
	} else {
		h, err2 := syscall.FindFirstFile(searchPtr, &fd)
		if err2 != nil {
			return err2
		}
		handle = h
	}
	defer syscall.FindClose(handle)

	dirSuffix := "\\"
	if strings.HasSuffix(dir, "\\") || strings.HasSuffix(dir, "/") {
		dirSuffix = ""
	}

	pathBuilder := strings.Builder{}
	pathBuilder.Grow(len(dir) + 260)

	for {
		name := syscall.UTF16ToString(fd.FileName[:])
		attr := fd.FileAttributes
		isDir := attr&syscall.FILE_ATTRIBUTE_DIRECTORY != 0
		isHidden := attr&syscall.FILE_ATTRIBUTE_HIDDEN != 0 || attr&syscall.FILE_ATTRIBUTE_SYSTEM != 0

		if name != "." && name != ".." {
			if includeHidden || !isHidden {
				var ext string
				if !isDir {
					if idx := strings.LastIndexByte(name, '.'); idx >= 0 && idx+1 < len(name) {
						ext = strings.ToLower(name[idx+1:])
					}
				}

				ft := syscall.Filetime{LowDateTime: fd.LastWriteTime.LowDateTime, HighDateTime: fd.LastWriteTime.HighDateTime}
				modTime := ft.Nanoseconds() / 1e9

				var size int64
				if !isDir {
					size = int64(fd.FileSizeHigh)<<32 + int64(fd.FileSizeLow)
				}

				permissions := generatePermissionsStringFast(attr, isDir)

				pathBuilder.Reset()
				pathBuilder.WriteString(dir)
				pathBuilder.WriteString(dirSuffix)
				pathBuilder.WriteString(name)

				entry := EnhancedBasicEntry{
					BasicEntry: BasicEntry{
						Name:      name,
						Path:      pathBuilder.String(),
						IsDir:     isDir,
						Extension: ext,
						IsHidden:  isHidden,
					},
					Size:        size,
					ModTime:     modTime,
					Permissions: permissions,
				}

				if !fn(entry) {
					return nil
				}
			}
		}

		err = syscall.FindNextFile(handle, &fd)
		if err != nil {
			if err == syscall.ERROR_NO_MORE_FILES {
				break
			}
			return err
		}
	}

	return nil
}

func listDirectoryBasicEnhanced(dir string, includeHidden bool) ([]EnhancedBasicEntry, error) {
	entries := make([]EnhancedBasicEntry, 0, 256)
	err := enumerateDirectoryBasicEnhanced(dir, includeHidden, func(entry EnhancedBasicEntry) bool {
		entries = append(entries, entry)
		return true
	})
	if err != nil {
		return nil, err
	}
	return entries, nil
}

const (
	invalidHandleValue = ^uintptr(0)
)

var (
	permReadOnly  = "dr--r--"
	permReadWrite = "drw-r--"
	permFileRO    = "-r--r--"
	permFileRW    = "-rw-r--"
)

func generatePermissionsStringFast(attr uint32, isDir bool) string {
	if isDir {
		if attr&syscall.FILE_ATTRIBUTE_READONLY != 0 {
			return permReadOnly
		}
		return permReadWrite
	}
	if attr&syscall.FILE_ATTRIBUTE_READONLY != 0 {
		return permFileRO
	}
	return permFileRW
}
