package backend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
)

func (fo *FileOperationsManager) moveToRecycleBin(filePath string) bool {
	switch runtime.GOOS {
	case "windows":
		return fo.moveToWindowsRecycleBinNative([]string{filepath.Clean(filePath)})
	case "darwin":
		return fo.moveToMacTrash(filePath)
	case "linux":
		return fo.moveToLinuxTrash(filePath)
	default:
		log.Printf("Recycle bin not supported on %s, falling back to permanent delete", runtime.GOOS)
		return os.RemoveAll(filePath) == nil
	}
}

func (fo *FileOperationsManager) moveToMacTrash(filePath string) bool {
	cmd := exec.Command("osascript", "-e", fmt.Sprintf(`tell app \"Finder\" to delete POSIX file \"%s\"`, filePath))
	return cmd.Run() == nil
}

func (fo *FileOperationsManager) moveToLinuxTrash(filePath string) bool {
	cmd := exec.Command("gio", "trash", filePath)
	if err := cmd.Run(); err != nil {
		cmd = exec.Command("gvfs-trash", filePath)
		if err := cmd.Run(); err != nil {
			homeDir, _ := os.UserHomeDir()
			trashDir := filepath.Join(homeDir, ".local", "share", "Trash", "files")
			os.MkdirAll(trashDir, 0755)
			trashPath := filepath.Join(trashDir, filepath.Base(filePath))
			return os.Rename(filePath, trashPath) == nil
		}
	}
	return true
}
