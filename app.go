package main

import (
	"context"
	"fmt"
	"io/fs"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"syscall"
	"time"
)

// App struct
type App struct {
	ctx context.Context
}

// FileInfo represents file/directory information
type FileInfo struct {
	Name        string    `json:"name"`
	Path        string    `json:"path"`
	IsDir       bool      `json:"isDir"`
	Size        int64     `json:"size"`
	ModTime     time.Time `json:"modTime"`
	Permissions string    `json:"permissions"`
	Extension   string    `json:"extension"`
	IsHidden    bool      `json:"isHidden"`
}

// DirectoryContents represents the contents of a directory
type DirectoryContents struct {
	CurrentPath string     `json:"currentPath"`
	ParentPath  string     `json:"parentPath"`
	Files       []FileInfo `json:"files"`
	Directories []FileInfo `json:"directories"`
	TotalFiles  int        `json:"totalFiles"`
	TotalDirs   int        `json:"totalDirs"`
}

// NavigationResponse represents navigation result
type NavigationResponse struct {
	Success bool              `json:"success"`
	Message string            `json:"message"`
	Data    DirectoryContents `json:"data"`
}

// NewApp creates a new App application struct
func NewApp() *App {
	return &App{}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	log.Println("File Explorer app started")
}

// GetHomeDirectory returns the user's home directory
func (a *App) GetHomeDirectory() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		log.Printf("Error getting home directory: %v", err)
		return ""
	}
	return homeDir
}

// GetCurrentWorkingDirectory returns the current working directory
func (a *App) GetCurrentWorkingDirectory() string {
	cwd, err := os.Getwd()
	if err != nil {
		log.Printf("Error getting current working directory: %v", err)
		return ""
	}
	return cwd
}

// GetSystemRoots returns system root paths (drives on Windows, / on Unix)
func (a *App) GetSystemRoots() []string {
	var roots []string

	if runtime.GOOS == "windows" {
		// Get all drives on Windows
		for i := 'A'; i <= 'Z'; i++ {
			drive := fmt.Sprintf("%c:\\", i)
			if _, err := os.Stat(drive); err == nil {
				roots = append(roots, drive)
			}
		}
	} else {
		// Unix-like systems start from root
		roots = append(roots, "/")
	}

	return roots
}

// ListDirectory lists the contents of a directory
func (a *App) ListDirectory(path string) NavigationResponse {
	log.Printf("Listing directory: %s", path)

	if path == "" {
		path = a.GetHomeDirectory()
	}

	// Clean and validate path
	path = filepath.Clean(path)

	// Check if path exists and is accessible
	info, err := os.Stat(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Cannot access path: %v", err),
		}
	}

	if !info.IsDir() {
		return NavigationResponse{
			Success: false,
			Message: "Path is not a directory",
		}
	}

	entries, err := os.ReadDir(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Cannot read directory: %v", err),
		}
	}

	var files []FileInfo
	var directories []FileInfo

	for _, entry := range entries {
		fileInfo := a.createFileInfo(path, entry)

		if fileInfo.IsDir {
			directories = append(directories, fileInfo)
		} else {
			files = append(files, fileInfo)
		}
	}

	// Sort directories and files alphabetically
	sort.Slice(directories, func(i, j int) bool {
		return strings.ToLower(directories[i].Name) < strings.ToLower(directories[j].Name)
	})
	sort.Slice(files, func(i, j int) bool {
		return strings.ToLower(files[i].Name) < strings.ToLower(files[j].Name)
	})

	// Get parent path
	parentPath := filepath.Dir(path)
	if parentPath == path {
		parentPath = "" // At root
	}

	contents := DirectoryContents{
		CurrentPath: path,
		ParentPath:  parentPath,
		Files:       files,
		Directories: directories,
		TotalFiles:  len(files),
		TotalDirs:   len(directories),
	}

	return NavigationResponse{
		Success: true,
		Message: "Directory listed successfully",
		Data:    contents,
	}
}

// createFileInfo creates FileInfo from DirEntry
func (a *App) createFileInfo(basePath string, entry fs.DirEntry) FileInfo {
	fullPath := filepath.Join(basePath, entry.Name())

	info, err := entry.Info()
	if err != nil {
		log.Printf("Error getting file info for %s: %v", fullPath, err)
		return FileInfo{
			Name:     entry.Name(),
			Path:     fullPath,
			IsDir:    entry.IsDir(),
			IsHidden: a.isHidden(entry.Name()),
		}
	}

	return FileInfo{
		Name:        entry.Name(),
		Path:        fullPath,
		IsDir:       entry.IsDir(),
		Size:        info.Size(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().String(),
		Extension:   a.getExtension(entry.Name()),
		IsHidden:    a.isHidden(entry.Name()),
	}
}

// isHidden checks if a file/directory is hidden
func (a *App) isHidden(name string) bool {
	if strings.HasPrefix(name, ".") {
		return true
	}

	// Additional Windows hidden file check could be added here
	// using syscalls if needed

	return false
}

// getExtension returns the file extension
func (a *App) getExtension(name string) string {
	ext := filepath.Ext(name)
	if ext != "" {
		return strings.ToLower(ext[1:]) // Remove the dot and convert to lowercase
	}
	return ""
}

// NavigateToPath navigates to a specific path
func (a *App) NavigateToPath(path string) NavigationResponse {
	log.Printf("Navigating to path: %s", path)
	return a.ListDirectory(path)
}

// NavigateUp navigates to the parent directory
func (a *App) NavigateUp(currentPath string) NavigationResponse {
	if currentPath == "" {
		return NavigationResponse{
			Success: false,
			Message: "No current path provided",
		}
	}

	parentPath := filepath.Dir(currentPath)
	if parentPath == currentPath {
		// Already at root
		return NavigationResponse{
			Success: false,
			Message: "Already at root directory",
		}
	}

	return a.ListDirectory(parentPath)
}

// GetFileDetails returns detailed information about a file
func (a *App) GetFileDetails(filePath string) FileInfo {
	log.Printf("Getting file details for: %s", filePath)

	info, err := os.Stat(filePath)
	if err != nil {
		log.Printf("Error getting file details: %v", err)
		return FileInfo{}
	}

	return FileInfo{
		Name:        filepath.Base(filePath),
		Path:        filePath,
		IsDir:       info.IsDir(),
		Size:        info.Size(),
		ModTime:     info.ModTime(),
		Permissions: info.Mode().String(),
		Extension:   a.getExtension(filepath.Base(filePath)),
		IsHidden:    a.isHidden(filepath.Base(filePath)),
	}
}

// FormatFileSize formats file size in human readable format
func (a *App) FormatFileSize(size int64) string {
	const unit = 1024
	if size < unit {
		return fmt.Sprintf("%d B", size)
	}

	div, exp := int64(unit), 0
	for n := size / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}

	units := []string{"KB", "MB", "GB", "TB", "PB"}
	return fmt.Sprintf("%.1f %s", float64(size)/float64(div), units[exp])
}

// OpenInSystemExplorer opens the given path in the system's default file manager
func (a *App) OpenInSystemExplorer(path string) bool {
	var cmd string
	var args []string

	switch runtime.GOOS {
	case "windows":
		cmd = "explorer"
		args = []string{path}
	case "darwin":
		cmd = "open"
		args = []string{path}
	case "linux":
		cmd = "xdg-open"
		args = []string{path}
	default:
		return false
	}

	err := exec.Command(cmd, args...).Start()
	return err == nil
}

// OpenFile opens a file with its default application and brings it to foreground
func (a *App) OpenFile(filePath string) bool {
	log.Printf("Opening file with default application: %s", filePath)

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Use rundll32 with shell32.dll to open file without showing command prompt
		// This is equivalent to double-clicking the file in Windows Explorer
		cmd = exec.Command("rundll32.exe", "shell32.dll,ShellExec_RunDLL", filePath)
		// Hide the command window to prevent flash
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	case "darwin":
		// macOS open command brings app to foreground by default
		cmd = exec.Command("open", filePath)
	case "linux":
		// Use xdg-open for Linux
		cmd = exec.Command("xdg-open", filePath)
	default:
		log.Printf("Unsupported operating system: %s", runtime.GOOS)
		return false
	}

	err := cmd.Start()
	if err != nil {
		log.Printf("Error opening file: %v", err)
		return false
	}

	log.Printf("Successfully opened file: %s", filePath)
	return true
}

// CopyFiles copies files from source paths to destination directory
func (a *App) CopyFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Copying %d files to: %s", len(sourcePaths), destDir)

	for _, srcPath := range sourcePaths {
		srcInfo, err := os.Stat(srcPath)
		if err != nil {
			log.Printf("Error getting source file info: %v", err)
			return false
		}

		destPath := filepath.Join(destDir, filepath.Base(srcPath))

		if srcInfo.IsDir() {
			err = a.copyDir(srcPath, destPath)
		} else {
			err = a.copyFile(srcPath, destPath)
		}

		if err != nil {
			log.Printf("Error copying %s: %v", srcPath, err)
			return false
		}

		// Verify the copy was successful by checking if destination exists
		if _, err := os.Stat(destPath); err != nil {
			log.Printf("Copy verification failed for %s: %v", destPath, err)
			return false
		}
	}

	log.Printf("Successfully copied %d files to %s", len(sourcePaths), destDir)
	return true
}

// MoveFiles moves files from source paths to destination directory
func (a *App) MoveFiles(sourcePaths []string, destDir string) bool {
	log.Printf("Moving %d files to: %s", len(sourcePaths), destDir)

	for _, srcPath := range sourcePaths {
		destPath := filepath.Join(destDir, filepath.Base(srcPath))

		err := os.Rename(srcPath, destPath)
		if err != nil {
			log.Printf("Error moving %s: %v", srcPath, err)
			return false
		}

		// Verify the move was successful
		if _, err := os.Stat(destPath); err != nil {
			log.Printf("Move verification failed for %s: %v", destPath, err)
			return false
		}
	}

	log.Printf("Successfully moved %d files to %s", len(sourcePaths), destDir)
	return true
}

// DeleteFiles permanently deletes the specified files and directories
func (a *App) DeleteFiles(filePaths []string) bool {
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

// MoveFilesToRecycleBin moves files to the system recycle bin/trash
func (a *App) MoveFilesToRecycleBin(filePaths []string) bool {
	log.Printf("Moving %d files to recycle bin", len(filePaths))

	for _, filePath := range filePaths {
		success := a.moveToRecycleBin(filePath)
		if !success {
			log.Printf("Error moving %s to recycle bin", filePath)
			return false
		}
	}

	return true
}

// moveToRecycleBin moves a single file to the recycle bin using OS-specific methods
func (a *App) moveToRecycleBin(filePath string) bool {
	switch runtime.GOOS {
	case "windows":
		return a.moveToWindowsRecycleBin(filePath)
	case "darwin":
		return a.moveToMacTrash(filePath)
	case "linux":
		return a.moveToLinuxTrash(filePath)
	default:
		log.Printf("Recycle bin not supported on %s, falling back to permanent delete", runtime.GOOS)
		return os.RemoveAll(filePath) == nil
	}
}

// moveToWindowsRecycleBin moves file to Windows Recycle Bin using pure Go
func (a *App) moveToWindowsRecycleBin(filePath string) bool {
	log.Printf("Moving to Windows Recycle Bin: %s", filePath)

	// Get current user SID - lightweight method
	userSID, err := a.getCurrentUserSID()
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

	log.Printf("Recycle bin path: %s", recycleBinPath)

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
	if a.fileExists(recycleBinFile) {
		recycleBinFile = a.generateUniqueRecycleBinPath(recycleBinPath, originalName)
	}

	// Move file to recycle bin using pure Go
	err = os.Rename(filePath, recycleBinFile)
	if err != nil {
		// If rename fails, try copy + delete (for cross-drive moves)
		err = a.copyAndDelete(filePath, recycleBinFile)
		if err != nil {
			log.Printf("Failed to move file to recycle bin: %v", err)
			return false
		}
	}

	log.Printf("Successfully moved to recycle bin: %s -> %s", filePath, recycleBinFile)
	return true
}

// getCurrentUserSID gets the current user's SID using minimal system calls
func (a *App) getCurrentUserSID() (string, error) {
	// Use whoami which is lightweight and always available
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
func (a *App) fileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

// generateUniqueRecycleBinPath creates a unique filename for the recycle bin
func (a *App) generateUniqueRecycleBinPath(recycleBinDir, originalName string) string {
	ext := filepath.Ext(originalName)
	nameWithoutExt := strings.TrimSuffix(originalName, ext)

	for counter := 1; counter < 1000; counter++ {
		newName := fmt.Sprintf("%s (%d)%s", nameWithoutExt, counter, ext)
		newPath := filepath.Join(recycleBinDir, newName)

		if !a.fileExists(newPath) {
			return newPath
		}
	}

	// Fallback with timestamp if we somehow hit 1000 conflicts
	timestamp := fmt.Sprintf("%d", time.Now().Unix())
	newName := fmt.Sprintf("%s_%s%s", nameWithoutExt, timestamp, ext)
	return filepath.Join(recycleBinDir, newName)
}

// copyAndDelete copies a file then deletes the original (for cross-drive moves)
func (a *App) copyAndDelete(src, dst string) error {
	// Check if source is a directory
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcInfo.IsDir() {
		return a.copyDirAndDelete(src, dst)
	}

	return a.copyFileAndDelete(src, dst)
}

// copyFileAndDelete copies a file and then deletes the original
func (a *App) copyFileAndDelete(src, dst string) error {
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

	_, err = sourceFile.WriteTo(destFile)
	if err != nil {
		os.Remove(dst) // Clean up partial copy
		return err
	}

	// Copy file permissions
	srcInfo, err := os.Stat(src)
	if err == nil {
		os.Chmod(dst, srcInfo.Mode())
	}

	// Delete original
	return os.Remove(src)
}

// copyDirAndDelete recursively copies a directory and then deletes the original
func (a *App) copyDirAndDelete(src, dst string) error {
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
			err = a.copyDirAndDelete(srcPath, dstPath)
		} else {
			err = a.copyFileAndDelete(srcPath, dstPath)
		}

		if err != nil {
			return err
		}
	}

	// Delete the now-empty source directory
	return os.Remove(src)
}

// moveToMacTrash moves file to macOS Trash
func (a *App) moveToMacTrash(filePath string) bool {
	cmd := exec.Command("osascript", "-e", fmt.Sprintf(`tell app "Finder" to delete POSIX file "%s"`, filePath))
	err := cmd.Run()
	return err == nil
}

// moveToLinuxTrash moves file to Linux trash (freedesktop.org standard)
func (a *App) moveToLinuxTrash(filePath string) bool {
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

// copyFile copies a single file
func (a *App) copyFile(src, dst string) error {
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

	_, err = sourceFile.WriteTo(destFile)
	if err != nil {
		return err
	}

	// Copy file permissions
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	return os.Chmod(dst, srcInfo.Mode())
}

// copyDir recursively copies a directory
func (a *App) copyDir(src, dst string) error {
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
			err = a.copyDir(srcPath, dstPath)
		} else {
			err = a.copyFile(srcPath, dstPath)
		}

		if err != nil {
			return err
		}
	}

	return nil
}

// GetDriveInfo returns information about available drives (Windows specific)
func (a *App) GetDriveInfo() []map[string]interface{} {
	var drives []map[string]interface{}

	if runtime.GOOS != "windows" {
		return drives
	}

	for i := 'A'; i <= 'Z'; i++ {
		drive := fmt.Sprintf("%c:\\", i)
		if _, err := os.Stat(drive); err == nil {
			// Try to get more info about the drive
			drives = append(drives, map[string]interface{}{
				"path":   drive,
				"letter": string(i),
				"name":   fmt.Sprintf("Drive %c:", i),
			})
		}
	}

	return drives
}

// CreateDirectory creates a new directory
func (a *App) CreateDirectory(path, name string) NavigationResponse {
	fullPath := filepath.Join(path, name)

	err := os.MkdirAll(fullPath, 0755)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to create directory: %v", err),
		}
	}

	return NavigationResponse{
		Success: true,
		Message: "Directory created successfully",
	}
}

// DeletePath deletes a file or directory
func (a *App) DeletePath(path string) NavigationResponse {
	err := os.RemoveAll(path)
	if err != nil {
		return NavigationResponse{
			Success: false,
			Message: fmt.Sprintf("Failed to delete: %v", err),
		}
	}

	return NavigationResponse{
		Success: true,
		Message: "Item deleted successfully",
	}
}

// RenameFile renames a file or directory
func (a *App) RenameFile(oldPath, newName string) bool {
	log.Printf("Renaming %s to %s", oldPath, newName)

	// Validate inputs
	if oldPath == "" || newName == "" {
		log.Printf("Error: Empty path or new name provided")
		return false
	}

	// Get the directory containing the file
	dir := filepath.Dir(oldPath)

	// Construct new path
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
	return true
}

// OpenPowerShellHere opens PowerShell 7 in the specified directory
func (a *App) OpenPowerShellHere(directoryPath string) bool {
	log.Printf("Opening PowerShell 7 in directory: %s", directoryPath)

	// Validate the directory path
	if directoryPath == "" {
		log.Printf("Error: Empty directory path provided")
		return false
	}

	// Check if directory exists
	if _, err := os.Stat(directoryPath); os.IsNotExist(err) {
		log.Printf("Error: Directory does not exist: %s", directoryPath)
		return false
	}

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// PowerShell 7 executable path
		pwshPath := "C:\\Program Files\\PowerShell\\7\\pwsh.exe"

		// Check if PowerShell 7 exists, fallback to Windows PowerShell if not
		if _, err := os.Stat(pwshPath); os.IsNotExist(err) {
			log.Printf("PowerShell 7 not found, falling back to Windows PowerShell")
			pwshPath = "powershell.exe"
		}

		log.Printf("Using PowerShell executable: %s", pwshPath)

		// Use the most reliable method: -NoExit without -Command, just set working directory
		// This approach ensures PowerShell stays open and starts in the correct directory
		cmd = exec.Command(pwshPath, "-NoExit")

		// Set the working directory for the process - this is the key!
		cmd.Dir = directoryPath

		// Create new console window that stays open
		cmd.SysProcAttr = &syscall.SysProcAttr{
			HideWindow:    false,      // We want to show PowerShell window
			CreationFlags: 0x00000010, // CREATE_NEW_CONSOLE - create new console window
		}

		log.Printf("PowerShell command: %s %v in directory: %s", pwshPath, cmd.Args[1:], directoryPath)

	case "darwin":
		// macOS: Open Terminal with the specified directory
		cmd = exec.Command("osascript", "-e", fmt.Sprintf(`tell app "Terminal" to do script "cd '%s'"`, directoryPath))

	case "linux":
		// Linux: Try to open terminal in the directory
		// Try different terminal emulators in order of preference
		terminals := [][]string{
			{"gnome-terminal", "--working-directory", directoryPath},
			{"konsole", "--workdir", directoryPath},
			{"xfce4-terminal", "--working-directory", directoryPath},
			{"xterm", "-e", fmt.Sprintf("cd '%s' && bash", directoryPath)},
		}

		for _, terminalCmd := range terminals {
			if _, err := exec.LookPath(terminalCmd[0]); err == nil {
				cmd = exec.Command(terminalCmd[0], terminalCmd[1:]...)
				break
			}
		}

		if cmd == nil {
			log.Printf("No suitable terminal emulator found")
			return false
		}

	default:
		log.Printf("Unsupported operating system: %s", runtime.GOOS)
		return false
	}

	// Start the command
	err := cmd.Start()
	if err != nil {
		log.Printf("Error opening PowerShell/Terminal: %v", err)
		return false
	}

	log.Printf("Successfully opened PowerShell/Terminal in directory: %s", directoryPath)
	return true
}
