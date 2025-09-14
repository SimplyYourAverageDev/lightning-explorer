package backend

import (
	"context"

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
		// High-frequency event — omit per-file logs to keep console clean
	}
}

// EmitDirectoryStart signals the start of directory streaming
func (e *EventEmitter) EmitDirectoryStart(path string) {
	if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "DirectoryStart", path)
		logPrintf("📡 Emitted directory start for: %s", path)
	}
}

// EmitDirectoryEntry emits a single directory entry during streaming
func (e *EventEmitter) EmitDirectoryEntry(fileInfo FileInfo) {
	if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "DirectoryEntry", fileInfo)
	}
}

// EmitDirectoryError emits an error during directory operations
func (e *EventEmitter) EmitDirectoryError(message string) {
	if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "DirectoryError", message)
		logPrintf("📡 Emitted directory error: %s", message)
	}
}

// EmitDirectoryBatch emits a batch of directory entries to the frontend
func (e *EventEmitter) EmitDirectoryBatch(entries []FileInfo) {
	if e.ctx != nil {
		runtime.EventsEmit(e.ctx, "DirectoryBatch", entries)
		logPrintf("📡 Emitted batch of %d entries", len(entries))
	}
}

// EmitDirectoryBatchMP emits a msgpack-encoded batch of compact entries
func (e *EventEmitter) EmitDirectoryBatchMP(mp []byte, count int) {
	if e.ctx != nil {
		// Wails will transmit []byte to frontend (arrives as base64 string in v2)
		runtime.EventsEmit(e.ctx, "DirectoryBatchMP", mp)
		logPrintf("📡 Emitted MP batch of %d entries (%d bytes)", count, len(mp))
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
		logPrintf("📡 Emitted directory complete for: %s (%d files, %d dirs)", path, totalFiles, totalDirs)
	}
}
