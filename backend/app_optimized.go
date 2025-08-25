package backend

// Optimized Wails bindings that return MessagePack-encoded bytes
// to match frontend EnhancedAPI expectations.

// helper to safely unwrap (interface{}, error) into []byte
func packOrNil(v interface{}, err error) []byte {
	if err != nil {
		logPrintf("serialization error: %v", err)
		return nil
	}
	if b, ok := v.([]byte); ok {
		return b
	}
	return nil
}

// NavigateToPathOptimized returns MessagePack-encoded NavigationResponse
func (a *App) NavigateToPathOptimized(path string) []byte {
	resp := a.NavigateToPath(path)
	return packOrNil(GetSerializationUtils().SerializeNavigationResponse(resp))
}

// ListDirectoryOptimized returns MessagePack-encoded NavigationResponse
func (a *App) ListDirectoryOptimized(path string) []byte {
	resp := a.ListDirectory(path)
	return packOrNil(GetSerializationUtils().SerializeNavigationResponse(resp))
}

// GetFileDetailsOptimized returns MessagePack-encoded FileInfo
func (a *App) GetFileDetailsOptimized(filePath string) []byte {
	fi := a.GetFileDetails(filePath)
	return packOrNil(GetSerializationUtils().SerializeFileInfo(fi))
}

// GetDriveInfoOptimized returns MessagePack-encoded []DriveInfo
func (a *App) GetDriveInfoOptimized() []byte {
	drives := a.GetDriveInfo()
	return packOrNil(GetSerializationUtils().SerializeDriveInfoSlice(drives))
}

// GetHomeDirectoryOptimized returns MessagePack-encoded string of home directory
func (a *App) GetHomeDirectoryOptimized() []byte {
	home := a.GetHomeDirectory()
	return packOrNil(GetSerializationUtils().SerializeGeneric(home))
}

// CreateDirectoryOptimized returns MessagePack-encoded NavigationResponse
func (a *App) CreateDirectoryOptimized(path, name string) []byte {
	resp := a.CreateDirectory(path, name)
	return packOrNil(GetSerializationUtils().SerializeNavigationResponse(resp))
}

// DeletePathOptimized returns MessagePack-encoded NavigationResponse
func (a *App) DeletePathOptimized(path string) []byte {
	resp := a.DeletePath(path)
	return packOrNil(GetSerializationUtils().SerializeNavigationResponse(resp))
}

// GetQuickAccessPathsOptimized returns MessagePack-encoded []DriveInfo
func (a *App) GetQuickAccessPathsOptimized() []byte {
	paths := a.GetQuickAccessPaths()
	return packOrNil(GetSerializationUtils().SerializeDriveInfoSlice(paths))
}

// GetSystemRootsOptimized returns MessagePack-encoded []string
func (a *App) GetSystemRootsOptimized() []byte {
	roots := a.GetSystemRoots()
	return packOrNil(GetSerializationUtils().SerializeGeneric(roots))
}
