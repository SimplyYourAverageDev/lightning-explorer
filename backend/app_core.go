package backend

import (
	"context"
	"encoding/json"
	"time"

	wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// Drive hot-plug is user-visible but not latency-critical – poll every 3 s to cut idle CPU
const pollInterval = 3 * time.Second

// NewApp creates a new App application struct - simplified
func NewApp() *App {
	return &App{
		filesystem: NewFileSystemManager(NewPlatformManager()),
		fileOps:    NewFileOperationsManager(NewPlatformManager()),
		platform:   NewPlatformManager(),
		// drives & terminal are expensive; initialize on first use
	}
}

// Startup is called when the app starts
func (a *App) Startup(ctx context.Context) {
	a.ctx = ctx

	// Set context on filesystem manager for event emission
	if fsManager, ok := a.filesystem.(*FileSystemManager); ok {
		fsManager.SetContext(ctx)
	}

	// Start background drive monitoring
	go a.monitorDrives()

	// Begin warm preloading in background
	go a.warmPreload()

	// TODO: Add system tray (Windows 11) in future version when Wails v3 stable.

	logPrintln("🚀 Lightning Explorer backend started")
}

// monitorDrives watches for drive additions/removals and emits events to the frontend
func (a *App) monitorDrives() {
	if a.ctx == nil {
		return
	}

	ticker := time.NewTicker(pollInterval)
	defer ticker.Stop()

	var prevJSON string
	for {
		select {
		case <-a.ctx.Done():
			return
		case <-ticker.C:
			drives := a.GetDriveInfo()
			data, err := json.Marshal(drives)
			if err != nil {
				continue
			}

			current := string(data)
			if current != prevJSON {
				prevJSON = current
				wruntime.EventsEmit(a.ctx, "driveListUpdated", drives)
			}
		}
	}
}

// warmPreload loads heavyweight data (home directory and drive list) once and caches it.
func (a *App) warmPreload() {
	a.warmOnce.Do(func() {
		// Preload home directory
		a.homeDirCache = a.platform.GetHomeDirectory()

		// Preload drives
		a.drivesCache = a.GetDriveInfo()

		a.warmReady = true

		// Notify frontend that warmup is done
		if a.ctx != nil {
			wruntime.EventsEmit(a.ctx, "warmupDone", true)
		}
	})
}
