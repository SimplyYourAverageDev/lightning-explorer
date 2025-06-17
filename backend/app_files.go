package backend

// GetFileDetails gets detailed information about a file
func (a *App) GetFileDetails(filePath string) FileInfo {
	fileInfo, err := a.filesystem.GetFileInfo(filePath)
	if err != nil {
		logPrintf("Error getting file details: %v", err)
		return FileInfo{}
	}
	return fileInfo
}

// OpenFile opens a file with its default application
func (a *App) OpenFile(filePath string) bool {
	return a.fileOps.OpenFile(filePath)
}

// OpenInSystemExplorer opens the path in system file manager
func (a *App) OpenInSystemExplorer(path string) bool {
	return a.platform.OpenInSystemExplorer(path)
}

// CopyFiles copies files to destination directory
func (a *App) CopyFiles(sourcePaths []string, destDir string) bool {
	return a.fileOps.CopyFiles(sourcePaths, destDir)
}

// MoveFiles moves files to destination directory
func (a *App) MoveFiles(sourcePaths []string, destDir string) bool {
	return a.fileOps.MoveFiles(sourcePaths, destDir)
}

// DeleteFiles permanently deletes files
func (a *App) DeleteFiles(filePaths []string) bool {
	return a.fileOps.DeleteFiles(filePaths)
}

// MoveFilesToRecycleBin moves files to the system recycle bin/trash
func (a *App) MoveFilesToRecycleBin(filePaths []string) bool {
	return a.fileOps.MoveFilesToRecycleBin(filePaths)
}

// RenameFile renames a file or directory
func (a *App) RenameFile(oldPath, newName string) bool {
	return a.fileOps.RenameFile(oldPath, newName)
}

// HideFiles sets the hidden attribute on the specified files
func (a *App) HideFiles(filePaths []string) bool {
	return a.fileOps.HideFiles(filePaths)
}

// DeletePath deletes a file or directory (alias for compatibility)
func (a *App) DeletePath(path string) NavigationResponse {
	success := a.fileOps.DeleteFiles([]string{path})
	if success {
		return NavigationResponse{
			Success: true,
			Message: "Item deleted successfully",
		}
	}
	return NavigationResponse{
		Success: false,
		Message: "Failed to delete item",
	}
}

// IsHidden checks if a file or directory is hidden
func (a *App) IsHidden(path string) bool {
	return a.platform.IsHidden(path)
}

// FormatFileSize formats file size in human readable format
func (a *App) FormatFileSize(size int64) string {
	return a.platform.FormatFileSize(size)
}

// CopyFilePathsToClipboard places the given absolute file paths on the OS clipboard
func (a *App) CopyFilePathsToClipboard(paths []string) bool {
	return a.platform.SetClipboardFilePaths(paths)
}
