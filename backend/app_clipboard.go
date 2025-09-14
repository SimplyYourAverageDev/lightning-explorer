package backend

import (
    wruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

// CopyTextToClipboard copies plain text to the system clipboard.
// Returns true on success.
func (a *App) CopyTextToClipboard(text string) bool {
    if a == nil || a.ctx == nil {
        return false
    }
    wruntime.ClipboardSetText(a.ctx, text)
    return true
}

