//go:build !windows

package backend

import (
	"log"
	"os"
	"path/filepath"
)

// NewFileOperationsManager creates a new file operations manager instance
func NewFileOperationsManager(platform PlatformManagerInterface) *FileOperationsManager {
	return &FileOperationsManager{platform: platform}
}

// CopyFiles copies files from source paths to destination directory with rollback support
func (fo *FileOperationsManager) CopyFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Copying %d files to: %s", len(sourcePaths), destDir)

	if len(sourcePaths) == 0 {
		log.Printf("Error: No source paths provided")
		return false
	}
	if destDir == "" {
		log.Printf("Error: Destination directory cannot be empty")
		return false
	}

	destInfo, err := os.Stat(destDir)
	if err != nil {
		log.Printf("Error: Cannot access destination directory: %v", err)
		return false
	}
	if !destInfo.IsDir() {
		log.Printf("Error: Destination is not a directory: %s", destDir)
		return false
	}

	var copiedFiles []string
	defer func() {
		if len(copiedFiles) > 0 && len(copiedFiles) < len(sourcePaths) {
			log.Printf("Cleaning up %d partially copied files", len(copiedFiles))
			for _, f := range copiedFiles {
				os.RemoveAll(f)
			}
		}
	}()

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

	return fo.copyFilesStandardWithRollback(sourcePaths, destDir, &copiedFiles)
}

// MoveFiles moves files from source paths to destination directory with rollback
func (fo *FileOperationsManager) MoveFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Moving %d files to: %s", len(sourcePaths), destDir)

	if len(sourcePaths) == 0 {
		log.Printf("Error: No source paths provided")
		return false
	}
	if destDir == "" {
		log.Printf("Error: Destination directory cannot be empty")
		return false
	}

	destInfo, err := os.Stat(destDir)
	if err != nil {
		log.Printf("Error: Cannot access destination directory: %v", err)
		return false
	}
	if !destInfo.IsDir() {
		log.Printf("Error: Destination is not a directory: %s", destDir)
		return false
	}

	type moveRecord struct {
		srcPath string
		dstPath string
		wasCopy bool // true if fallback copy+delete was used instead of rename
	}
	var moves []moveRecord
	rollback := func() {
		for i := len(moves) - 1; i >= 0; i-- {
			m := moves[i]
			if m.wasCopy {
				// We cannot restore the original after copy+delete; remove the copied item
				os.RemoveAll(m.dstPath)
				log.Printf("Warning: Cannot fully restore %s (move was copy+delete)", m.srcPath)
				continue
			}
			os.Rename(m.dstPath, m.srcPath)
		}
	}

	for _, srcPath := range sourcePaths {
		destPath := filepath.Join(destDir, filepath.Base(srcPath))
		wasCopy := false
		if err := os.Rename(srcPath, destPath); err != nil {
			if err := fo.copyDirOrFile(srcPath, destPath); err != nil {
				log.Printf("Error moving %s: %v", srcPath, err)
				rollback()
				return false
			}
			if err := os.RemoveAll(srcPath); err != nil {
				log.Printf("Error removing original %s: %v", srcPath, err)
				rollback()
				return false
			}
			wasCopy = true
		}
		moves = append(moves, moveRecord{srcPath: srcPath, dstPath: destPath, wasCopy: wasCopy})
	}

	return true
}

// helper to copy file or directory
func (fo *FileOperationsManager) copyDirOrFile(src, dst string) error {
	info, err := os.Stat(src)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fo.copyDir(src, dst)
	}
	return fo.copyFile(src, dst)
}

// DeleteFiles permanently deletes the specified files and directories
func (fo *FileOperationsManager) DeleteFiles(filePaths []string) bool {
	log.Printf("Permanently deleting %d files", len(filePaths))
	for _, filePath := range filePaths {
		if err := os.RemoveAll(filePath); err != nil {
			log.Printf("Error permanently deleting %s: %v", filePath, err)
			return false
		}
	}
	return true
}

// MoveFilesToRecycleBin moves files to the system recycle bin/trash using platform tools
func (fo *FileOperationsManager) MoveFilesToRecycleBin(filePaths []string) bool {
	log.Printf("Moving %d files to recycle bin", len(filePaths))
	for _, filePath := range filePaths {
		if !fo.moveToRecycleBin(filePath) {
			log.Printf("Error moving %s to recycle bin", filePath)
			return false
		}
	}
	return true
}

// RenameFile renames a file or directory with validation
func (fo *FileOperationsManager) RenameFile(oldPath, newName string) bool {
	log.Printf("Renaming %s to %s", oldPath, newName)

	if oldPath == "" || newName == "" {
		log.Printf("Error: paths cannot be empty")
		return false
	}

	cleanOldPath := filepath.Clean(oldPath)
	if !filepath.IsAbs(cleanOldPath) {
		log.Printf("Error: Old path must be absolute: %s", oldPath)
		return false
	}

	tempFS := &FileSystemManager{}
	sanitizedNewName, err := tempFS.validateAndSanitizeFileName(newName)
	if err != nil {
		log.Printf("Error: Invalid new name: %v", err)
		return false
	}

	dir := filepath.Dir(cleanOldPath)
	newPath := filepath.Join(dir, sanitizedNewName)

	if _, err := os.Stat(cleanOldPath); os.IsNotExist(err) {
		log.Printf("Error: Source file does not exist: %s", cleanOldPath)
		return false
	}
	if _, err := os.Stat(newPath); err == nil {
		log.Printf("Error: Destination already exists: %s", newPath)
		return false
	}

	if err := os.Rename(cleanOldPath, newPath); err != nil {
		log.Printf("Error renaming file: %v", err)
		return false
	}
	return true
}

// HideFiles sets the hidden attribute on the specified files
func (fo *FileOperationsManager) HideFiles(filePaths []string) bool {
	log.Printf("Hiding %d files", len(filePaths))
	for _, filePath := range filePaths {
		if !fo.platform.HideFile(filePath) {
			log.Printf("Error hiding file: %s", filePath)
			return false
		}
	}
	return true
}

// OpenFile opens a file with its default application
func (fo *FileOperationsManager) OpenFile(filePath string) bool {
	return fo.platform.OpenFile(filePath)
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
		*copiedFiles = append(*copiedFiles, destPath)
		if _, err := os.Stat(destPath); err != nil {
			log.Printf("Copy verification failed for %s: %v", destPath, err)
			return false
		}
	}

	*copiedFiles = nil
	return true
}
