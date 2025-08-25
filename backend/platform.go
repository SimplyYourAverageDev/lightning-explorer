//go:build windows

package backend

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"time"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	procSetForegroundWindow      = windows.NewLazySystemDLL("user32.dll").NewProc("SetForegroundWindow")
	procGetForegroundWindow      = windows.NewLazySystemDLL("user32.dll").NewProc("GetForegroundWindow")
	procAllowSetForegroundWindow = windows.NewLazySystemDLL("user32.dll").NewProc("AllowSetForegroundWindow")
	procAttachThreadInput        = windows.NewLazySystemDLL("user32.dll").NewProc("AttachThreadInput")
	procGetWindowThreadProcessId = windows.NewLazySystemDLL("user32.dll").NewProc("GetWindowThreadProcessId")
	procGetCurrentThreadId       = windows.NewLazySystemDLL("kernel32.dll").NewProc("GetCurrentThreadId")
	procEnumWindows              = windows.NewLazySystemDLL("user32.dll").NewProc("EnumWindows")
	procGetWindowTextW           = windows.NewLazySystemDLL("user32.dll").NewProc("GetWindowTextW")
	procIsWindowVisible          = windows.NewLazySystemDLL("user32.dll").NewProc("IsWindowVisible")
	procShowWindow               = windows.NewLazySystemDLL("user32.dll").NewProc("ShowWindow")
	procBringWindowToTop         = windows.NewLazySystemDLL("user32.dll").NewProc("BringWindowToTop")
)

// NewPlatformManager creates a new platform manager instance
func NewPlatformManager() *PlatformManager {
	return &PlatformManager{}
}

// GetHomeDirectory returns the user's home directory
func (p *PlatformManager) GetHomeDirectory() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		logPrintf("Error getting home directory: %v", err)
		return ""
	}
	return homeDir
}

// GetCurrentWorkingDirectory returns the current working directory
func (p *PlatformManager) GetCurrentWorkingDirectory() string {
	cwd, err := os.Getwd()
	if err != nil {
		logPrintf("Error getting current working directory: %v", err)
		return ""
	}
	return cwd
}

// GetSystemRoots returns Windows system root paths (drives)
func (p *PlatformManager) GetSystemRoots() []string {
	// Use the optimized Windows-specific method
	return p.GetSystemRootsWindows()
}

// OpenInSystemExplorer opens the given path in Windows Explorer
func (p *PlatformManager) OpenInSystemExplorer(path string) bool {
	cmd := "explorer"
	args := []string{path}

	err := exec.Command(cmd, args...).Start()
	if err != nil {
		logPrintf("Error opening in Windows Explorer: %v", err)
		return false
	}
	return true
}

// OpenFile opens a file with its default Windows application and focuses the opened window
func (p *PlatformManager) OpenFile(filePath string) bool {
	logPrintf("Opening file with default Windows application: %s", filePath)

	go func() {
		err := p.shellExecute(filePath)
		if err != nil {
			logPrintf("Error opening file with ShellExecute: %v", err)
			// Fallback to original method if ShellExecute fails
			currentWindow := p.getForegroundWindow()
			cmd := exec.Command("rundll32.exe", "shell32.dll,ShellExec_RunDLL", filePath)
			cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
			if err := cmd.Start(); err != nil {
				logPrintf("Fallback OpenFile method also failed: %v", err)
			} else {
				// Also attempt to focus for fallback method
				go func() {
					time.Sleep(500 * time.Millisecond)
					p.focusLatestWindow(currentWindow)
				}()
			}
		}
	}()

	logPrintf("Successfully opened file with Windows default application: %s", filePath)
	return true
}

// IsHiddenWindows checks if a file has the Windows hidden attribute
func (p *PlatformManager) IsHiddenWindows(filePath string) bool {
	// Use native Windows API instead of attrib command
	return p.IsHiddenWindowsNative(filePath)
}

// IsHidden checks if a file/directory is hidden using Windows methods
func (p *PlatformManager) IsHidden(filePath string) bool {
	// Check for dot prefix (common convention, but not typical on Windows)
	fileName := filepath.Base(filePath)
	if strings.HasPrefix(fileName, ".") {
		return true
	}

	// Check Windows-specific hidden attributes
	return p.IsHiddenWindows(filePath)
}

// HideFileWindows sets the hidden attribute on Windows using native API
func (p *PlatformManager) HideFileWindows(filePath string) bool {
	// Use native Windows API instead of attrib command
	return p.HideFileWindowsNative(filePath)
}

// HideFile sets the hidden attribute on a file using Windows methods
func (p *PlatformManager) HideFile(filePath string) bool {
	return p.HideFileWindows(filePath)
}

// GetExtension returns the file extension in lowercase
func (p *PlatformManager) GetExtension(name string) string {
	ext := filepath.Ext(name)
	if ext != "" {
		return strings.ToLower(ext[1:]) // Remove the dot and convert to lowercase
	}
	return ""
}

// FormatFileSize formats file size in human readable format
func (p *PlatformManager) FormatFileSize(size int64) string {
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

// shellExecute uses the Windows ShellExecute function to open a file or URL.
// This is more direct and performant than using rundll32.
// It also attempts to focus the opened application window.
func (p *PlatformManager) shellExecute(filePath string) error {
	verb := "open"
	pathPtr, err := windows.UTF16PtrFromString(filePath)
	if err != nil {
		return err
	}
	verbPtr, err := windows.UTF16PtrFromString(verb)
	if err != nil {
		return err
	}

	// Get current foreground window before opening
	currentWindow := p.getForegroundWindow()

	// Open the file
	err = windows.ShellExecute(0, verbPtr, pathPtr, nil, nil, windows.SW_SHOWNORMAL)
	if err != nil {
		return err
	}

	// Wait a short time for the application to launch and then focus it
	go func() {
		time.Sleep(500 * time.Millisecond) // Wait for app to launch
		p.focusLatestWindow(currentWindow)
	}()

	return nil
}

// getForegroundWindow gets the current foreground window handle
func (p *PlatformManager) getForegroundWindow() windows.Handle {
	ret, _, _ := procGetForegroundWindow.Call()
	return windows.Handle(ret)
}

// focusLatestWindow attempts to focus the most recently opened window
func (p *PlatformManager) focusLatestWindow(previousWindow windows.Handle) {
	// Try multiple times with increasing delays as some apps take time to create their main window
	for i := 0; i < 3; i++ {
		if i > 0 {
			time.Sleep(time.Duration(i*300) * time.Millisecond)
		}

		currentWindow := p.getForegroundWindow()
		if currentWindow != previousWindow && currentWindow != 0 {
			// A new window has become foreground, just ensure it stays focused
			procSetForegroundWindow.Call(uintptr(currentWindow))
			return
		}

		// Try to find and focus any new visible window
		if p.findAndFocusNewWindow(previousWindow) {
			return
		}
	}
}

// enhanceFocus uses simple Windows API calls to ensure the window gets focus
func (p *PlatformManager) enhanceFocus(hwnd windows.Handle) {
	// Simply set the window as foreground - this should be enough for most cases
	procSetForegroundWindow.Call(uintptr(hwnd))
	procBringWindowToTop.Call(uintptr(hwnd))
}

// WindowInfo holds information about a window
type WindowInfo struct {
	Handle windows.Handle
	Title  string
}

// findAndFocusNewWindow finds newly created visible windows and focuses them
func (p *PlatformManager) findAndFocusNewWindow(previousWindow windows.Handle) bool {
	var foundWindow windows.Handle

	// Enumerate all top-level windows
	enumCallback := syscall.NewCallback(func(hwnd, lparam uintptr) uintptr {
		windowHandle := windows.Handle(hwnd)

		// Skip if this is the previous window
		if windowHandle == previousWindow || windowHandle == 0 {
			return 1 // Continue enumeration
		}

		// Check if window is visible
		ret, _, _ := procIsWindowVisible.Call(hwnd)
		if ret == 0 {
			return 1 // Continue if not visible
		}

		// Get window title - if it has a title, it's likely a main application window
		title := p.getWindowTitle(windowHandle)
		if title != "" && len(title) > 0 {
			// Check if this window became foreground recently
			currentForeground := p.getForegroundWindow()
			if currentForeground == windowHandle {
				foundWindow = windowHandle
				return 0 // Stop enumeration - found the active window
			}
		}

		return 1 // Continue enumeration
	})

	procEnumWindows.Call(enumCallback, 0)

	if foundWindow != 0 {
		p.enhanceFocus(foundWindow)
		return true
	}

	return false
}

// getWindowTitle gets the title of a window
func (p *PlatformManager) getWindowTitle(hwnd windows.Handle) string {
	titleBuffer := make([]uint16, 256)
	ret, _, _ := procGetWindowTextW.Call(uintptr(hwnd), uintptr(unsafe.Pointer(&titleBuffer[0])), uintptr(len(titleBuffer)))
	if ret > 0 {
		return windows.UTF16ToString(titleBuffer[:ret])
	}
	return ""
}
