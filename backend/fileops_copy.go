package backend

import (
	"io"
	"os"
	"path/filepath"
)

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
	if _, err = io.CopyBuffer(destFile, sourceFile, buffer); err != nil {
		return err
	}

	// Copy file permissions and timestamps
	if srcInfo, err := os.Stat(src); err == nil {
		os.Chmod(dst, srcInfo.Mode())
		os.Chtimes(dst, srcInfo.ModTime(), srcInfo.ModTime())
	}

	return nil
}

// copyDir recursively copies a directory with progress tracking
func (fo *FileOperationsManager) copyDir(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
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
	if err := fo.copyFile(src, dst); err != nil {
		return err
	}

	return os.Remove(src)
}

// copyDirAndDelete recursively copies a directory and then deletes the original
func (fo *FileOperationsManager) copyDirAndDelete(src, dst string) error {
	if err := fo.copyDir(src, dst); err != nil {
		return err
	}

	return os.RemoveAll(src)
}
