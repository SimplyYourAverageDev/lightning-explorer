package backend

import (
	"context"
	"log"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// EventEmitter handles Wails runtime events
type EventEmitter struct {
	ctx context.Context
}

// NewEventEmitter creates a new event emitter
func NewEventEmitter(ctx context.Context) *EventEmitter {
	return &EventEmitter{ctx: ctx}
}

// EmitDirectoryHydrate emits a directory hydration event to the frontend
func (e *EventEmitter) EmitDirectoryHydrate(fileInfo FileInfo) {
	if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "DirectoryHydrate", fileInfo)
		log.Printf("📡 Emitted hydration event for: %s", fileInfo.Name)
	}
}

// EmitDirectoryBatch emits a batch of directory entries to the frontend
func (e *EventEmitter) EmitDirectoryBatch(entries []FileInfo) {
	if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "DirectoryBatch", entries)
		log.Printf("📡 Emitted batch of %d entries", len(entries))
	}
}

// EmitDirectoryComplete signals that directory loading is complete
func (e *EventEmitter) EmitDirectoryComplete(path string, totalFiles, totalDirs int) {
	if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "DirectoryComplete", map[string]interface{}{
			"path":       path,
			"totalFiles": totalFiles,
			"totalDirs":  totalDirs,
		})
		log.Printf("📡 Emitted directory complete for: %s (%d files, %d dirs)", path, totalFiles, totalDirs)
	}
}
