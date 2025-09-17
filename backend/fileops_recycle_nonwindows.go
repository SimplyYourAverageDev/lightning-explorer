//go:build !windows

package backend

func (fo *FileOperationsManager) moveToWindowsRecycleBinNative(filePaths []string) bool {
	return false
}
