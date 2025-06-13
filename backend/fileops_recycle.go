package backend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
	"unicode/utf16"
)

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

// moveToWindowsRecycleBin moves file to Windows Recycle Bin with proper validation and metadata
func (fo *FileOperationsManager) moveToWindowsRecycleBin(filePath string) bool {
	log.Printf("Moving to Windows Recycle Bin: %s", filePath)

	if filePath == "" {
		log.Printf("Error: Empty file path provided")
		return false
	}

	// Clean and validate the file path
	cleanPath := filepath.Clean(filePath)
	if !filepath.IsAbs(cleanPath) {
		log.Printf("Error: File path must be absolute: %s", filePath)
		return false
	}

	if len(cleanPath) < 3 {
		log.Printf("Error: Invalid file path format (too short): %s", cleanPath)
		return false
	}

	if cleanPath[1] != ':' || cleanPath[2] != '\\' {
		log.Printf("Error: Invalid Windows path format: %s", cleanPath)
		return false
	}

	fileInfo, err := os.Stat(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			log.Printf("Error: File does not exist: %s", cleanPath)
		} else {
			log.Printf("Error: Cannot access file: %v", err)
		}
		return false
	}

	userSID, err := fo.getCurrentUserSIDNative()
	if err != nil {
		log.Printf("Failed to get user SID using native API: %v", err)
		return false
	}

	driveLetter := strings.ToUpper(string(cleanPath[0]))
	driveRoot := driveLetter + ":\\"
	if _, err := os.Stat(driveRoot); err != nil {
		log.Printf("Error: Drive not accessible: %s", driveRoot)
		return false
	}

	recycleBinPath := fmt.Sprintf("%s:\\$Recycle.Bin\\%s", driveLetter, userSID)
	if err := os.MkdirAll(recycleBinPath, 0755); err != nil {
		log.Printf("Failed to create recycle bin directory: %v", err)
		return false
	}

	originalName := filepath.Base(cleanPath)
	timestamp := time.Now().Unix()
	recycleID := fmt.Sprintf("$R%d", timestamp)
	metadataID := fmt.Sprintf("$I%d", timestamp)

	ext := filepath.Ext(originalName)
	if ext != "" {
		recycleID += ext
		metadataID += ext
	}

	recycleBinFile := filepath.Join(recycleBinPath, recycleID)
	metadataFile := filepath.Join(recycleBinPath, metadataID)

	counter := 0
	for fo.fileExists(recycleBinFile) || fo.fileExists(metadataFile) {
		counter++
		if counter > 1000 {
			log.Printf("Error: Too many filename conflicts in recycle bin")
			return false
		}
		recycleID = fmt.Sprintf("$R%d_%d", timestamp, counter)
		metadataID = fmt.Sprintf("$I%d_%d", timestamp, counter)
		if ext != "" {
			recycleID += ext
			metadataID += ext
		}
		recycleBinFile = filepath.Join(recycleBinPath, recycleID)
		metadataFile = filepath.Join(recycleBinPath, metadataID)
	}

	if err := fo.createRecycleBinMetadata(metadataFile, cleanPath, fileInfo); err != nil {
		log.Printf("Failed to create recycle bin metadata: %v", err)
		return false
	}

	if err := os.Rename(cleanPath, recycleBinFile); err != nil {
		if err := fo.copyAndDelete(cleanPath, recycleBinFile); err != nil {
			log.Printf("Failed to move file to recycle bin: %v", err)
			os.Remove(metadataFile)
			return false
		}
	}

	log.Printf("Successfully moved to recycle bin: %s -> %s (metadata: %s)", cleanPath, recycleBinFile, metadataFile)
	return true
}

// createRecycleBinMetadata creates proper Windows recycle bin metadata file ($I file)
func (fo *FileOperationsManager) createRecycleBinMetadata(metadataPath, originalPath string, fileInfo os.FileInfo) error {
	file, err := os.Create(metadataPath)
	if err != nil {
		return err
	}
	defer file.Close()

	size := fileInfo.Size()
	sizeBytes := make([]byte, 8)
	for i := 0; i < 8; i++ {
		sizeBytes[i] = byte(size >> (i * 8))
	}
	file.Write(sizeBytes)

	deleteTime := time.Now().Unix()
	timeBytes := make([]byte, 8)
	for i := 0; i < 8; i++ {
		timeBytes[i] = byte(deleteTime >> (i * 8))
	}
	file.Write(timeBytes)

	pathUTF16 := utf16.Encode([]rune(originalPath))
	pathLen := len(pathUTF16)
	lenBytes := make([]byte, 4)
	for i := 0; i < 4; i++ {
		lenBytes[i] = byte(pathLen >> (i * 8))
	}
	file.Write(lenBytes)

	for _, r := range pathUTF16 {
		pathBytes := make([]byte, 2)
		pathBytes[0] = byte(r)
		pathBytes[1] = byte(r >> 8)
		file.Write(pathBytes)
	}
	return nil
}

// getCurrentUserSIDNative retrieves the current user's SID using native Windows APIs
func (fo *FileOperationsManager) getCurrentUserSIDNative() (string, error) {
	if runtime.GOOS != "windows" {
		return "", fmt.Errorf("native SID retrieval only available on Windows")
	}
	if platformManager, ok := fo.platform.(*PlatformManager); ok {
		return platformManager.GetCurrentUserSIDNative()
	}
	return "", fmt.Errorf("platform manager does not support native SID retrieval")
}

func (fo *FileOperationsManager) fileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// moveToMacTrash moves file to macOS Trash using AppleScript
func (fo *FileOperationsManager) moveToMacTrash(filePath string) bool {
	cmd := exec.Command("osascript", "-e", fmt.Sprintf(`tell app \"Finder\" to delete POSIX file \"%s\"`, filePath))
	return cmd.Run() == nil
}

// moveToLinuxTrash moves file to Linux trash (freedesktop.org standard)
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
