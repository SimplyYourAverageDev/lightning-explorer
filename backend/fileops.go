package backend

import (
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

// NewFileOperationsManager creates a new file operations manager instance
func NewFileOperationsManager(cache CacheManagerInterface, platform PlatformManagerInterface) *FileOperationsManager {
	return &FileOperationsManager{
		cache:    cache,
		platform: platform,
	}
}

// CopyFiles copies files from source paths to destination directory
func (fo *FileOperationsManager) CopyFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Copying %d files to: %s", len(sourcePaths), destDir)

	for _, srcPath := range sourcePaths {
		srcInfo, err := os.Stat(srcPath)
		if err != nil {
			log.Printf("Error getting source file info: %v", err)
			return false
		}

		destPath := filepath.Join(destDir, filepath.Base(srcPath))

		if srcInfo.IsDir() {
			err = fo.copyDir(srcPath, destPath)
		} else {
			err = fo.copyFile(srcPath, destPath)
		}

		if err != nil {
			log.Printf("Error copying %s: %v", srcPath, err)
			return false
		}

		// Verify the copy was successful
		if _, err := os.Stat(destPath); err != nil {
			log.Printf("Copy verification failed for %s: %v", destPath, err)
			return false
		}
	}

	log.Printf("Successfully copied %d files to %s", len(sourcePaths), destDir)
	fo.cache.Clear() // Clear cache to ensure fresh data
	return true
}

// MoveFiles moves files from source paths to destination directory
func (fo *FileOperationsManager) MoveFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Moving %d files to: %s", len(sourcePaths), destDir)

	for _, srcPath := range sourcePaths {
		destPath := filepath.Join(destDir, filepath.Base(srcPath))

		err := os.Rename(srcPath, destPath)
		if err != nil {
			// If rename fails, try copy + delete (for cross-drive moves)
			if err := fo.copyAndDelete(srcPath, destPath); err != nil {
				log.Printf("Error moving %s: %v", srcPath, err)
				return false
			}
		}

		// Verify the move was successful
		if _, err := os.Stat(destPath); err != nil {
			log.Printf("Move verification failed for %s: %v", destPath, err)
			return false
		}
	}

	log.Printf("Successfully moved %d files to %s", len(sourcePaths), destDir)
	fo.cache.Clear() // Clear cache to ensure fresh data
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

	fo.cache.Clear() // Clear cache to ensure fresh data
	return true
}

// MoveFilesToRecycleBin moves files to the system recycle bin/trash
func (fo *FileOperationsManager) MoveFilesToRecycleBin(filePaths []string) bool {
	log.Printf("Moving %d files to recycle bin", len(filePaths))

	for _, filePath := range filePaths {
		success := fo.moveToRecycleBin(filePath)
		if !success {
			log.Printf("Error moving %s to recycle bin", filePath)
			return false
		}
	}

	fo.cache.Clear() // Clear cache to ensure fresh data
	return true
}

// RenameFile renames a file or directory
func (fo *FileOperationsManager) RenameFile(oldPath, newName string) bool {
	log.Printf("Renaming %s to %s", oldPath, newName)

	// Validate inputs
	if oldPath == "" || newName == "" {
		log.Printf("Error: Empty path or new name provided")
		return false
	}

	// Get the directory containing the file
	dir := filepath.Dir(oldPath)
	newPath := filepath.Join(dir, newName)

	// Check if old path exists
	if _, err := os.Stat(oldPath); os.IsNotExist(err) {
		log.Printf("Error: Source file does not exist: %s", oldPath)
		return false
	}

	// Check if new path already exists
	if _, err := os.Stat(newPath); err == nil {
		log.Printf("Error: Destination already exists: %s", newPath)
		return false
	}

	// Perform the rename
	err := os.Rename(oldPath, newPath)
	if err != nil {
		log.Printf("Error renaming file: %v", err)
		return false
	}

	log.Printf("Successfully renamed %s to %s", oldPath, newPath)
	fo.cache.Clear() // Clear cache to ensure fresh data
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
	fo.cache.Clear() // Clear cache to ensure fresh data
	return true
}

// OpenFile opens a file with its default application
func (fo *FileOperationsManager) OpenFile(filePath string) bool {
	return fo.platform.OpenFile(filePath)
}

// Helper methods

// copyFile copies a single file with optimized buffer size for better performance
func (fo *FileOperationsManager) copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	// Use optimized buffer size for better performance (64KB)
	buffer := make([]byte, 64*1024)
	_, err = io.CopyBuffer(destFile, sourceFile, buffer)
	if err != nil {
		return err
	}

	// Copy file permissions and timestamps
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	os.Chmod(dst, srcInfo.Mode())
	os.Chtimes(dst, srcInfo.ModTime(), srcInfo.ModTime())

	return nil
}

// copyDir recursively copies a directory with progress tracking
func (fo *FileOperationsManager) copyDir(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	err = os.MkdirAll(dst, srcInfo.Mode())
	if err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	for _, entry := range entries {
		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			err = fo.copyDir(srcPath, dstPath)
		} else {
			err = fo.copyFile(srcPath, dstPath)
		}

		if err != nil {
			return err
		}
	}

	return nil
}

// copyAndDelete copies a file/directory then deletes the original (for cross-drive moves)
func (fo *FileOperationsManager) copyAndDelete(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcInfo.IsDir() {
		return fo.copyDirAndDelete(src, dst)
	}

	return fo.copyFileAndDelete(src, dst)
}

// copyFileAndDelete copies a file and then deletes the original
func (fo *FileOperationsManager) copyFileAndDelete(src, dst string) error {
	err := fo.copyFile(src, dst)
	if err != nil {
		return err
	}

	return os.Remove(src)
}

// copyDirAndDelete recursively copies a directory and then deletes the original
func (fo *FileOperationsManager) copyDirAndDelete(src, dst string) error {
	err := fo.copyDir(src, dst)
	if err != nil {
		return err
	}

	return os.RemoveAll(src)
}

// moveToRecycleBin moves a single file to the recycle bin using OS-specific methods
func (fo *FileOperationsManager) moveToRecycleBin(filePath string) bool {
	switch runtime.GOOS {
	case "windows":
		return fo.moveToWindowsRecycleBin(filePath)
	case "darwin":
		return fo.moveToMacTrash(filePath)
	case "linux":
		return fo.moveToLinuxTrash(filePath)
	default:
		log.Printf("Recycle bin not supported on %s, falling back to permanent delete", runtime.GOOS)
		return os.RemoveAll(filePath) == nil
	}
}

// moveToWindowsRecycleBin moves file to Windows Recycle Bin using optimized method
func (fo *FileOperationsManager) moveToWindowsRecycleBin(filePath string) bool {
	log.Printf("Moving to Windows Recycle Bin: %s", filePath)

	// Get current user SID efficiently
	userSID, err := fo.getCurrentUserSID()
	if err != nil {
		log.Printf("Failed to get user SID: %v", err)
		return false
	}

	// Get the drive letter from the file path
	if len(filePath) < 2 || filePath[1] != ':' {
		log.Printf("Invalid file path format: %s", filePath)
		return false
	}

	driveLetter := strings.ToUpper(string(filePath[0]))
	recycleBinPath := fmt.Sprintf("%s:\\$Recycle.Bin\\%s", driveLetter, userSID)

	// Create recycle bin directory if it doesn't exist
	err = os.MkdirAll(recycleBinPath, 0755)
	if err != nil {
		log.Printf("Failed to create recycle bin directory: %v", err)
		return false
	}

	// Generate unique filename in recycle bin
	originalName := filepath.Base(filePath)
	recycleBinFile := filepath.Join(recycleBinPath, originalName)

	// Handle filename conflicts
	if fo.fileExists(recycleBinFile) {
		recycleBinFile = fo.generateUniqueRecycleBinPath(recycleBinPath, originalName)
	}

	// Move file to recycle bin
	err = os.Rename(filePath, recycleBinFile)
	if err != nil {
		// If rename fails, try copy + delete (for cross-drive moves)
		err = fo.copyAndDelete(filePath, recycleBinFile)
		if err != nil {
			log.Printf("Failed to move file to recycle bin: %v", err)
			return false
		}
	}

	log.Printf("Successfully moved to recycle bin: %s -> %s", filePath, recycleBinFile)
	return true
}

// getCurrentUserSID gets the current user's SID using optimized method
func (fo *FileOperationsManager) getCurrentUserSID() (string, error) {
	cmd := exec.Command("whoami", "/user", "/fo", "csv", "/nh")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("whoami failed: %v", err)
	}

	// Parse CSV output: "DOMAIN\username","S-1-5-..."
	csvLine := strings.TrimSpace(string(output))
	if len(csvLine) < 10 {
		return "", fmt.Errorf("invalid whoami output: %s", csvLine)
	}

	// Extract SID from CSV (second column)
	parts := strings.Split(csvLine, ",")
	if len(parts) < 2 {
		return "", fmt.Errorf("could not parse SID from: %s", csvLine)
	}

	sid := strings.Trim(parts[1], `"`)
	if !strings.HasPrefix(sid, "S-1-5-") {
		return "", fmt.Errorf("invalid SID format: %s", sid)
	}

	return sid, nil
}

// fileExists checks if a file exists
func (fo *FileOperationsManager) fileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// generateUniqueRecycleBinPath creates a unique filename for the recycle bin
func (fo *FileOperationsManager) generateUniqueRecycleBinPath(recycleBinDir, originalName string) string {
	ext := filepath.Ext(originalName)
	nameWithoutExt := strings.TrimSuffix(originalName, ext)

	for counter := 1; counter < 1000; counter++ {
		newName := fmt.Sprintf("%s (%d)%s", nameWithoutExt, counter, ext)
		newPath := filepath.Join(recycleBinDir, newName)

		if !fo.fileExists(newPath) {
			return newPath
		}
	}

	// Fallback with timestamp if we hit 1000 conflicts
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	newName := fmt.Sprintf("%s_%s%s", nameWithoutExt, timestamp, ext)
	return filepath.Join(recycleBinDir, newName)
}

// moveToMacTrash moves file to macOS Trash
func (fo *FileOperationsManager) moveToMacTrash(filePath string) bool {
	cmd := exec.Command("osascript", "-e", fmt.Sprintf(`tell app "Finder" to delete POSIX file "%s"`, filePath))
	err := cmd.Run()
	return err == nil
}

// moveToLinuxTrash moves file to Linux trash (freedesktop.org standard)
func (fo *FileOperationsManager) moveToLinuxTrash(filePath string) bool {
	// Try using gio trash (modern method)
	cmd := exec.Command("gio", "trash", filePath)
	err := cmd.Run()

	if err != nil {
		// Fallback to gvfs-trash
		cmd = exec.Command("gvfs-trash", filePath)
		err = cmd.Run()

		if err != nil {
			// Final fallback: move to ~/.local/share/Trash
			homeDir, _ := os.UserHomeDir()
			trashDir := filepath.Join(homeDir, ".local", "share", "Trash", "files")

			// Create trash directory if it doesn't exist
			os.MkdirAll(trashDir, 0755)

			// Move file to trash
			fileName := filepath.Base(filePath)
			trashPath := filepath.Join(trashDir, fileName)

			return os.Rename(filePath, trashPath) == nil
		}
	}

	return true
}
