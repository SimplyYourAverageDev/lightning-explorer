package backend

// GetWarmState returns cached warm-start information to the frontend.
func (a *App) GetWarmState() WarmState {
	// Ensure warm preload has started
	go a.warmPreload()

	return WarmState{
		HomeDir: a.homeDirCache,
		Drives:  a.drivesCache,
		Ready:   a.warmReady,
	}
}

// GetHomeDirectory returns the user's home directory
func (a *App) GetHomeDirectory() string {
	return a.platform.GetHomeDirectory()
}

// GetCurrentWorkingDirectory returns the current working directory
func (a *App) GetCurrentWorkingDirectory() string {
	return a.platform.GetCurrentWorkingDirectory()
}

// GetSystemRoots returns system root paths (drives on Windows, / on Unix)
func (a *App) GetSystemRoots() []string {
	return a.platform.GetSystemRoots()
}

// NavigateToPath navigates to a specified path
func (a *App) NavigateToPath(path string) NavigationResponse {
	return a.filesystem.NavigateToPath(path)
}

// ListDirectory lists contents of a directory
func (a *App) ListDirectory(path string) NavigationResponse {
	return a.filesystem.ListDirectory(path)
}

// ValidatePath validates if a path exists and is accessible
func (a *App) ValidatePath(path string) bool {
	err := a.filesystem.ValidatePath(path)
	return err == nil
}

// FileExists checks if a file exists
func (a *App) FileExists(path string) bool {
	return a.filesystem.FileExists(path)
}

// StreamDirectory begins directory enumeration in a separate goroutine
func (a *App) StreamDirectory(dir string) {
	if fsManager, ok := a.filesystem.(*FileSystemManager); ok {
		// Launch the potentially-expensive enumeration in its own goroutine
		go fsManager.StreamDirectory(dir)
	}
}

// CreateDirectory creates a new directory
func (a *App) CreateDirectory(path, name string) NavigationResponse {
	return a.filesystem.CreateDirectory(path, name)
}
