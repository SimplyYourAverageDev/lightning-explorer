package backend

import (
	"log"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"unsafe"
)

var (
	shell32 = syscall.NewLazyDLL("shell32.dll")

	// Shell32 procedures for enhanced file operations
	shFileOperationW = shell32.NewProc("SHFileOperationW")
)

// Windows constants for file operations
const (
	FO_DELETE = 0x0003
	FO_MOVE   = 0x0001
	FO_COPY   = 0x0002

	FOF_ALLOWUNDO      = 0x0040
	FOF_NOCONFIRMATION = 0x0010
	FOF_SILENT         = 0x0004

	CSIDL_BITBUCKET = 0x000a
)

// SHFILEOPSTRUCT represents the Windows SHFILEOPSTRUCT structure
type SHFILEOPSTRUCT struct {
	Hwnd                  uintptr
	WFunc                 uint32
	PFrom                 uintptr
	PTo                   uintptr
	FFlags                uint16
	FAnyOperationsAborted int32
	HNameMappings         uintptr
	LpszProgressTitle     uintptr
}

// NewFileOperationsManager creates a new file operations manager instance
func NewFileOperationsManager(platform PlatformManagerInterface) *FileOperationsManager {
	return &FileOperationsManager{
		platform: platform,
	}
}

// CopyFiles copies files from source paths to destination directory using optimized methods with rollback
func (fo *FileOperationsManager) CopyFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Copying %d files to: %s", len(sourcePaths), destDir)

	// Input validation
	if len(sourcePaths) == 0 {
		log.Printf("Error: No source paths provided")
		return false
	}

	if destDir == "" {
		log.Printf("Error: Destination directory cannot be empty")
		return false
	}

	// Validate destination directory exists and is writable
	destInfo, err := os.Stat(destDir)
	if err != nil {
		log.Printf("Error: Cannot access destination directory: %v", err)
		return false
	}

	if !destInfo.IsDir() {
		log.Printf("Error: Destination is not a directory: %s", destDir)
		return false
	}

	// ROLLBACK MECHANISM: Track successfully copied files for cleanup on failure
	var copiedFiles []string
	defer func() {
		// Only clean up if there was an error and we have partial copies
		if len(copiedFiles) > 0 && len(copiedFiles) < len(sourcePaths) {
			log.Printf("Cleaning up %d partially copied files", len(copiedFiles))
			for _, copiedFile := range copiedFiles {
				if err := os.RemoveAll(copiedFile); err != nil {
					log.Printf("Warning: Failed to clean up copied file %s: %v", copiedFile, err)
				}
			}
		}
	}()

	// Pre-validate all source files before starting any operations
	for _, srcPath := range sourcePaths {
		if srcPath == "" {
			log.Printf("Error: Empty source path found")
			return false
		}

		if _, err := os.Stat(srcPath); err != nil {
			log.Printf("Error: Cannot access source file %s: %v", srcPath, err)
			return false
		}

		// Check for conflicts before starting
		destPath := filepath.Join(destDir, filepath.Base(srcPath))
		if _, err := os.Stat(destPath); err == nil {
			log.Printf("Error: Destination file already exists: %s", destPath)
			return false
		}
	}

	// Use native Windows API for better performance on Windows
	if runtime.GOOS == "windows" {
		return fo.copyFilesWindowsWithRollback(sourcePaths, destDir, &copiedFiles)
	}

	// Fallback to Go standard library for other platforms
	return fo.copyFilesStandardWithRollback(sourcePaths, destDir, &copiedFiles)
}

// copyFilesWindowsWithRollback uses Windows API for optimized file copying with rollback
func (fo *FileOperationsManager) copyFilesWindowsWithRollback(sourcePaths []string, destDir string, copiedFiles *[]string) bool {
	// For now, use the standard method but could be enhanced with SHFileOperationW
	// SHFileOperationW is complex for copy operations, so we'll keep the current optimized Go implementation
	return fo.copyFilesStandardWithRollback(sourcePaths, destDir, copiedFiles)
}

// copyFilesStandardWithRollback uses Go standard library for file copying with rollback support
func (fo *FileOperationsManager) copyFilesStandardWithRollback(sourcePaths []string, destDir string, copiedFiles *[]string) bool {
	for _, srcPath := range sourcePaths {
		srcInfo, err := os.Stat(srcPath)
		if err != nil {
			log.Printf("Error getting source file info: %v", err)
			return false
		}

		destPath := filepath.Join(destDir, filepath.Base(srcPath))

		var copyErr error
		if srcInfo.IsDir() {
			copyErr = fo.copyDir(srcPath, destPath)
		} else {
			copyErr = fo.copyFile(srcPath, destPath)
		}

		if copyErr != nil {
			log.Printf("Error copying %s: %v", srcPath, copyErr)
			return false
		}

		// Track successful copy for potential rollback
		*copiedFiles = append(*copiedFiles, destPath)

		// Verify the copy was successful
		if _, err := os.Stat(destPath); err != nil {
			log.Printf("Copy verification failed for %s: %v", destPath, err)
			return false
		}
	}

	log.Printf("Successfully copied %d files to %s", len(sourcePaths), destDir)
	// Clear copiedFiles slice to prevent cleanup in defer
	*copiedFiles = nil
	return true
}

// MoveFiles moves files from source paths to destination directory with rollback support
func (fo *FileOperationsManager) MoveFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Moving %d files to: %s", len(sourcePaths), destDir)

	// Input validation
	if len(sourcePaths) == 0 {
		log.Printf("Error: No source paths provided")
		return false
	}

	if destDir == "" {
		log.Printf("Error: Destination directory cannot be empty")
		return false
	}

	// Validate destination directory
	destInfo, err := os.Stat(destDir)
	if err != nil {
		log.Printf("Error: Cannot access destination directory: %v", err)
		return false
	}

	if !destInfo.IsDir() {
		log.Printf("Error: Destination is not a directory: %s", destDir)
		return false
	}

	// ROLLBACK MECHANISM: Track moves for potential rollback
	type moveRecord struct {
		srcPath  string
		destPath string
		wasCopy  bool // true if we had to copy+delete instead of rename
	}

	var moveRecords []moveRecord
	defer func() {
		// Rollback on failure
		if len(moveRecords) > 0 && len(moveRecords) < len(sourcePaths) {
			log.Printf("Rolling back %d moves due to failure", len(moveRecords))
			for i := len(moveRecords) - 1; i >= 0; i-- {
				record := moveRecords[i]
				if record.wasCopy {
					// Remove the copied file and restore doesn't apply (original was deleted)
					os.RemoveAll(record.destPath)
					log.Printf("Warning: Cannot fully restore %s (was copy+delete operation)", record.srcPath)
				} else {
					// Restore the move (rename back)
					if err := os.Rename(record.destPath, record.srcPath); err != nil {
						log.Printf("Warning: Failed to rollback move of %s: %v", record.srcPath, err)
					}
				}
			}
		}
	}()

	// Pre-validate all operations
	for _, srcPath := range sourcePaths {
		if srcPath == "" {
			log.Printf("Error: Empty source path found")
			return false
		}

		if _, err := os.Stat(srcPath); err != nil {
			log.Printf("Error: Cannot access source file %s: %v", srcPath, err)
			return false
		}

		destPath := filepath.Join(destDir, filepath.Base(srcPath))
		if _, err := os.Stat(destPath); err == nil {
			log.Printf("Error: Destination file already exists: %s", destPath)
			return false
		}
	}

	// Perform moves with rollback tracking
	for _, srcPath := range sourcePaths {
		destPath := filepath.Join(destDir, filepath.Base(srcPath))
		record := moveRecord{srcPath: srcPath, destPath: destPath, wasCopy: false}

		err := os.Rename(srcPath, destPath)
		if err != nil {
			// If rename fails, try copy + delete (for cross-drive moves)
			record.wasCopy = true
			if copyErr := fo.copyAndDelete(srcPath, destPath); copyErr != nil {
				log.Printf("Error moving %s: %v", srcPath, copyErr)
				return false
			}
		}

		moveRecords = append(moveRecords, record)

		// Verify the move was successful
		if _, err := os.Stat(destPath); err != nil {
			log.Printf("Move verification failed for %s: %v", destPath, err)
			return false
		}
	}

	log.Printf("Successfully moved %d files to %s", len(sourcePaths), destDir)
	// Clear moveRecords to prevent rollback in defer
	moveRecords = nil
	return true
}

// DeleteFiles permanently deletes the specified files and directories
func (fo *FileOperationsManager) DeleteFiles(filePaths []string) bool {
	log.Printf("Permanently deleting %d files", len(filePaths))

	for _, filePath := range filePaths {
		err := os.RemoveAll(filePath)
		if err != nil {
			log.Printf("Error permanently deleting %s: %v", filePath, err)
			return false
		}
	}

	return true
}

// MoveFilesToRecycleBin moves files to the system recycle bin/trash using native APIs
func (fo *FileOperationsManager) MoveFilesToRecycleBin(filePaths []string) bool {
	log.Printf("Moving %d files to recycle bin", len(filePaths))

	if runtime.GOOS == "windows" {
		return fo.moveToWindowsRecycleBinNative(filePaths)
	}

	// Fallback to individual file processing for other platforms
	for _, filePath := range filePaths {
		success := fo.moveToRecycleBin(filePath)
		if !success {
			log.Printf("Error moving %s to recycle bin", filePath)
			return false
		}
	}

	return true
}

// moveToWindowsRecycleBinNative uses SHFileOperationW for proper recycle bin operations
func (fo *FileOperationsManager) moveToWindowsRecycleBinNative(filePaths []string) bool {
	log.Printf("Moving files to Windows Recycle Bin using native API")

	// Convert each path to UTF16 and build the final buffer
	var pathsUTF16 []uint16

	for _, path := range filePaths {
		// Convert each path individually to UTF16
		pathUTF16, err := syscall.UTF16FromString(path)
		if err != nil {
			log.Printf("Failed to convert path to UTF16: %s, error: %v", path, err)
			return false
		}
		// Append the UTF16 path (excluding the automatic null terminator from UTF16FromString)
		pathsUTF16 = append(pathsUTF16, pathUTF16[:len(pathUTF16)-1]...)
		// Add single null terminator for this path
		pathsUTF16 = append(pathsUTF16, 0)
	}
	// Add final null terminator for the entire list
	pathsUTF16 = append(pathsUTF16, 0)

	// Set up SHFILEOPSTRUCT
	fileOp := SHFILEOPSTRUCT{
		Hwnd:   0, // No parent window
		WFunc:  FO_DELETE,
		PFrom:  uintptr(unsafe.Pointer(&pathsUTF16[0])),
		PTo:    0, // Not needed for delete
		FFlags: FOF_ALLOWUNDO | FOF_NOCONFIRMATION | FOF_SILENT,
	}

	// Call SHFileOperationW
	ret, _, err := shFileOperationW.Call(uintptr(unsafe.Pointer(&fileOp)))
	if ret != 0 {
		log.Printf("SHFileOperationW failed with code %d: %v", ret, err)
		// Fallback to manual recycle bin method
		return fo.moveToWindowsRecycleBinManual(filePaths)
	}

	log.Printf("Successfully moved %d files to recycle bin using native API", len(filePaths))
	return true
}

// moveToWindowsRecycleBinManual provides fallback manual recycle bin implementation
func (fo *FileOperationsManager) moveToWindowsRecycleBinManual(filePaths []string) bool {
	log.Printf("Using manual recycle bin method as fallback")

	for _, filePath := range filePaths {
		success := fo.moveToWindowsRecycleBin(filePath)
		if !success {
			log.Printf("Error moving %s to recycle bin", filePath)
			return false
		}
	}

	return true
}

// RenameFile renames a file or directory with comprehensive security validation
func (fo *FileOperationsManager) RenameFile(oldPath, newName string) bool {
	log.Printf("Renaming %s to %s", oldPath, newName)

	// Input validation
	if oldPath == "" {
		log.Printf("Error: Empty old path provided")
		return false
	}

	if newName == "" {
		log.Printf("Error: Empty new name provided")
		return false
	}

	// Clean the old path
	cleanOldPath := filepath.Clean(oldPath)
	if !filepath.IsAbs(cleanOldPath) {
		log.Printf("Error: Old path must be absolute: %s", oldPath)
		return false
	}

	// Sanitize and validate the new name using filesystem manager validation
	// Create a temporary filesystem manager instance to use the validation function
	tempFS := &FileSystemManager{}
	sanitizedNewName, err := tempFS.validateAndSanitizeFileName(newName)
	if err != nil {
		log.Printf("Error: Invalid new name: %v", err)
		return false
	}

	// Get the directory containing the file
	dir := filepath.Dir(cleanOldPath)
	newPath := filepath.Join(dir, sanitizedNewName)

	// Security check: Ensure the new path is within the same parent directory
	if !tempFS.isPathWithinParent(newPath, dir) {
		log.Printf("Error: Rename outside parent directory not allowed")
		return false
	}

	// Check if old path exists
	oldInfo, err := os.Stat(cleanOldPath)
	if os.IsNotExist(err) {
		log.Printf("Error: Source file does not exist: %s", cleanOldPath)
		return false
	}
	if err != nil {
		log.Printf("Error: Cannot access source file: %v", err)
		return false
	}

	// Check if new path already exists
	if _, err := os.Stat(newPath); err == nil {
		log.Printf("Error: Destination already exists: %s", newPath)
		return false
	}

	// Additional validation for directories to prevent system damage
	if oldInfo.IsDir() {
		// Prevent renaming critical system directories
		systemDirs := []string{"Windows", "System32", "Program Files", "Program Files (x86)"}
		oldBaseName := strings.ToLower(filepath.Base(cleanOldPath))
		for _, sysDir := range systemDirs {
			if strings.ToLower(sysDir) == oldBaseName {
				log.Printf("Error: Cannot rename system directory: %s", oldBaseName)
				return false
			}
		}
	}

	// Perform the rename with error handling
	err = os.Rename(cleanOldPath, newPath)
	if err != nil {
		log.Printf("Error renaming file: %v", err)
		return false
	}

	log.Printf("Successfully renamed %s to %s", cleanOldPath, newPath)
	return true
}

// HideFiles sets the hidden attribute on the specified files
func (fo *FileOperationsManager) HideFiles(filePaths []string) bool {
	log.Printf("Hiding %d files", len(filePaths))

	for _, filePath := range filePaths {
		success := fo.platform.HideFile(filePath)
		if !success {
			log.Printf("Error hiding file: %s", filePath)
			return false
		}
	}

	log.Printf("Successfully hid %d files", len(filePaths))
	return true
}

// OpenFile opens a file with its default application
func (fo *FileOperationsManager) OpenFile(filePath string) bool {
	return fo.platform.OpenFile(filePath)
}

// Helper copy/move implementations have been moved to fileops_copy.go to keep this file concise.
