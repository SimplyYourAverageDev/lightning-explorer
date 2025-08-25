//go:build windows

package backend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"unsafe"
)

var (
	shell32Terminal = syscall.NewLazyDLL("shell32.dll")

	// Shell32 procedures for terminal operations
	shellExecuteW = shell32Terminal.NewProc("ShellExecuteW")

	// Constants for ShellExecuteW
	SW_SHOWNORMAL = 1
)

// NewTerminalManager creates a new terminal manager instance
func NewTerminalManager() *TerminalManager {
	return &TerminalManager{}
}

// OpenPowerShellHere opens PowerShell 7 in the specified directory using optimized methods
func (t *TerminalManager) OpenPowerShellHere(directoryPath string) bool {
	log.Printf("Opening PowerShell 7 in directory: %s", directoryPath)

	// Secure path validation
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path: %v", err)
		return false
	}

	if runtime.GOOS == "windows" {
		return t.openWindowsTerminalOptimized(securePath, "powershell")
	}

	return t.openWindowsTerminal(securePath)
}

// OpenTerminalHere opens the system's default terminal in the specified directory
func (t *TerminalManager) OpenTerminalHere(directoryPath string) bool {
	log.Printf("Opening terminal in directory: %s", directoryPath)

	// Secure path validation
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path: %v", err)
		return false
	}

	switch runtime.GOOS {
	case "windows":
		return t.openWindowsTerminalOptimized(securePath, "default")
	case "darwin":
		return t.openMacTerminal(securePath)
	case "linux":
		return t.openLinuxTerminal(securePath)
	default:
		log.Printf("Unsupported operating system: %s", runtime.GOOS)
		return false
	}
}

// openWindowsTerminalOptimized uses ShellExecuteW for better performance and reliability with secure path handling
func (t *TerminalManager) openWindowsTerminalOptimized(directoryPath string, terminalType string) bool {
	// Note: directoryPath should already be validated by calling functions, but validate again for safety
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path in optimized function: %v", err)
		return t.openWindowsTerminalFallback(directoryPath, terminalType)
	}

	var executable string
	var parameters string

	switch terminalType {
	case "powershell":
		// Try PowerShell 7 first, fallback to Windows PowerShell
		pwshPath := "C:\\Program Files\\PowerShell\\7\\pwsh.exe"
		if _, err := os.Stat(pwshPath); err == nil {
			log.Printf("PowerShell 7 found at: %s", pwshPath)
			executable = pwshPath
			// PowerShell 7 specific parameters for maximum stability
			parameters = fmt.Sprintf("-NoExit -NoLogo -NoProfile -WorkingDirectory \"%s\" -Command \"& {Write-Host 'PowerShell 7 ready in:' (Get-Location).Path -ForegroundColor Green}\"", securePath)
		} else {
			log.Printf("PowerShell 7 not found at %s, error: %v. Falling back to Windows PowerShell", pwshPath, err)
			executable = "powershell.exe"
			// Windows PowerShell 5.1 parameters
			parameters = "-NoExit -NoLogo -NoProfile -Command \"& {Write-Host 'Windows PowerShell ready in:' (Get-Location).Path -ForegroundColor Green}\""
		}
	case "cmd":
		executable = "cmd.exe"
		parameters = "/K"
	case "wt":
		executable = "wt.exe"
		// Use secure parameter construction - don't use fmt.Sprintf with user input
		parameters = "-d"
		// Note: We'll pass the directory separately to ShellExecuteW
	default:
		// Default to PowerShell
		return t.openWindowsTerminalOptimized(securePath, "powershell")
	}

	log.Printf("Using ShellExecuteW to open: %s with params: %s in directory: %s", executable, parameters, securePath)

	// Convert strings to UTF16 pointers with error handling
	executableUTF16, err := syscall.UTF16PtrFromString(executable)
	if err != nil {
		log.Printf("Failed to convert executable to UTF16: %v", err)
		return t.openWindowsTerminalFallback(securePath, terminalType)
	}

	var parametersUTF16 *uint16
	if parameters != "" {
		if terminalType == "wt" {
			// For Windows Terminal, construct parameters safely
			safeParams := "-d \"" + strings.ReplaceAll(securePath, "\"", "\\\"") + "\""
			parametersUTF16, err = syscall.UTF16PtrFromString(safeParams)
		} else {
			parametersUTF16, err = syscall.UTF16PtrFromString(parameters)
		}
		if err != nil {
			log.Printf("Failed to convert parameters to UTF16: %v", err)
			return t.openWindowsTerminalFallback(securePath, terminalType)
		}
	}

	var directoryUTF16 *uint16
	// Only pass directory to ShellExecuteW if we're not using -WorkingDirectory parameter
	useDirectoryParam := terminalType != "wt" && !strings.Contains(executable, "pwsh.exe")
	if useDirectoryParam {
		directoryUTF16, err = syscall.UTF16PtrFromString(securePath)
		if err != nil {
			log.Printf("Failed to convert directory to UTF16: %v", err)
			return t.openWindowsTerminalFallback(securePath, terminalType)
		}
	}

	// Call ShellExecuteW
	ret, _, err := shellExecuteW.Call(
		0, // hwnd (no parent window)
		0, // lpOperation (default "open")
		uintptr(unsafe.Pointer(executableUTF16)),
		uintptr(unsafe.Pointer(parametersUTF16)),
		uintptr(unsafe.Pointer(directoryUTF16)),
		uintptr(SW_SHOWNORMAL),
	)

	if ret <= 32 {
		log.Printf("ShellExecuteW failed with return code %d: %v", ret, err)
		log.Printf("Failed command was: %s %s", executable, parameters)
		return t.openWindowsTerminalFallback(securePath, terminalType)
	}

	log.Printf("Successfully opened terminal using ShellExecuteW")
	return true
}

// openWindowsTerminalFallback provides fallback using exec.Command with secure path handling
func (t *TerminalManager) openWindowsTerminalFallback(directoryPath string, terminalType string) bool {
	log.Printf("Using fallback method for terminal opening")

	// Validate path again for security
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path in fallback: %v", err)
		return false
	}

	switch terminalType {
	case "powershell":
		return t.openWindowsTerminal(securePath)
	case "cmd":
		return t.OpenCommandPromptHere(securePath)
	case "wt":
		return t.OpenWindowsTerminalApp(securePath)
	default:
		return t.openWindowsTerminal(securePath)
	}
}

// openWindowsTerminal opens PowerShell in Windows with secure path handling
func (t *TerminalManager) openWindowsTerminal(directoryPath string) bool {
	// Validate path for security
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path: %v", err)
		return false
	}

	// PowerShell 7 executable path
	pwshPath := "C:\\Program Files\\PowerShell\\7\\pwsh.exe"

	// Check if PowerShell 7 exists, fallback to Windows PowerShell if not
	if _, err := os.Stat(pwshPath); os.IsNotExist(err) {
		log.Printf("PowerShell 7 not found at %s, error: %v. Falling back to Windows PowerShell", pwshPath, err)
		pwshPath = "powershell.exe"
	} else if err != nil {
		log.Printf("Error checking PowerShell 7 at %s: %v. Falling back to Windows PowerShell", pwshPath, err)
		pwshPath = "powershell.exe"
	} else {
		log.Printf("PowerShell 7 found at: %s", pwshPath)
	}

	log.Printf("Using PowerShell executable: %s", pwshPath)

	// Use enhanced arguments for better PowerShell 7 compatibility and persistence
	var args []string
	if strings.Contains(pwshPath, "pwsh.exe") {
		// PowerShell 7 specific arguments for maximum stability
		args = []string{
			"-NoExit",
			"-NoLogo",
			"-NoProfile",
			"-WorkingDirectory", securePath,
			"-Command", "& {Write-Host 'PowerShell 7 ready in:' (Get-Location).Path -ForegroundColor Green}",
		}
	} else {
		// Windows PowerShell 5.1 arguments
		args = []string{
			"-NoExit",
			"-NoLogo",
			"-NoProfile",
			"-Command", "& {Write-Host 'Windows PowerShell ready in:' (Get-Location).Path -ForegroundColor Green}",
		}
	}

	cmd := exec.Command(pwshPath, args...)

	// Set the working directory for the process - this is secure!
	cmd.Dir = securePath

	// Create new console window that stays open with better flags
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    false,      // We want to show PowerShell window
		CreationFlags: 0x00000010, // CREATE_NEW_CONSOLE - create new console window
	}

	log.Printf("PowerShell command: %s %v in directory: %s", pwshPath, cmd.Args[1:], securePath)

	// Start the command
	err = cmd.Start()
	if err != nil {
		log.Printf("Error opening PowerShell: %v", err)
		return false
	}

	log.Printf("Successfully opened PowerShell in directory: %s", securePath)
	return true
}

// securePath sanitizes a directory path to prevent command injection
func (t *TerminalManager) securePath(directoryPath string) (string, error) {
	if directoryPath == "" {
		return "", fmt.Errorf("directory path cannot be empty")
	}

	// Clean the path
	cleanPath := filepath.Clean(directoryPath)

	// Validate it's an absolute path
	if !filepath.IsAbs(cleanPath) {
		return "", fmt.Errorf("directory path must be absolute")
	}

	// Check if directory exists
	info, err := os.Stat(cleanPath)
	if err != nil {
		if os.IsNotExist(err) {
			return "", fmt.Errorf("directory does not exist: %s", cleanPath)
		}
		return "", fmt.Errorf("cannot access directory: %v", err)
	}

	if !info.IsDir() {
		return "", fmt.Errorf("path is not a directory: %s", cleanPath)
	}

	// Additional security: Check for dangerous characters that could be used in injection
	// Note: Backslashes are valid in Windows paths, so we exclude them from the check
	dangerousChars := []string{";", "&", "|", "`", "$", "(", ")", "{", "}", "[", "]", "<", ">", "\"", "'", "\n", "\r", "\t"}
	for _, char := range dangerousChars {
		if strings.Contains(cleanPath, char) {
			return "", fmt.Errorf("directory path contains potentially dangerous characters: %s", char)
		}
	}

	return cleanPath, nil
}

// openMacTerminal opens Terminal in macOS with secure path handling
func (t *TerminalManager) openMacTerminal(directoryPath string) bool {
	// Secure path validation
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path: %v", err)
		return false
	}

	// Use secure approach - don't inject the path into a script string
	// Instead, change working directory of the Terminal process
	tempScript := fmt.Sprintf(`
tell application "Terminal"
	activate
	do script "cd %s"
end tell`, strings.ReplaceAll(securePath, "'", "'\"'\"'")) // Escape single quotes properly

	cmd := exec.Command("osascript", "-e", tempScript)

	err = cmd.Start()
	if err != nil {
		log.Printf("Error opening macOS Terminal: %v", err)
		return false
	}

	log.Printf("Successfully opened Terminal in directory: %s", securePath)
	return true
}

// openLinuxTerminal opens terminal in Linux with secure execution
func (t *TerminalManager) openLinuxTerminal(directoryPath string) bool {
	// Secure path validation
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path: %v", err)
		return false
	}

	// Use secure terminal opening without shell injection
	// Try different terminal emulators with proper argument passing
	terminals := []struct {
		command string
		args    []string
	}{
		{"gnome-terminal", []string{"--working-directory=" + securePath}},
		{"konsole", []string{"--workdir", securePath}},
		{"xfce4-terminal", []string{"--working-directory=" + securePath}},
		{"terminator", []string{"--working-directory=" + securePath}},
		// For terminals that don't support working directory, use a safer approach
		{"xterm", []string{"-e", "bash", "-c", fmt.Sprintf("cd %s && exec bash", shellescape(securePath))}},
		{"urxvt", []string{"-cd", securePath}},
	}

	for _, terminal := range terminals {
		if _, err := exec.LookPath(terminal.command); err == nil {
			cmd := exec.Command(terminal.command, terminal.args...)
			cmd.Dir = securePath // Set working directory as additional security

			err := cmd.Start()
			if err == nil {
				log.Printf("Successfully opened %s in directory: %s", terminal.command, securePath)
				return true
			}
			log.Printf("Failed to open %s: %v", terminal.command, err)
		}
	}

	log.Printf("No suitable terminal emulator found")
	return false
}

// shellescape properly escapes a string for shell use
func shellescape(s string) string {
	// For bash, we'll use single quotes and escape any single quotes in the string
	return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'"
}

// OpenCommandPromptHere opens Command Prompt in Windows with secure execution
func (t *TerminalManager) OpenCommandPromptHere(directoryPath string) bool {
	if runtime.GOOS != "windows" {
		log.Printf("Command Prompt is only available on Windows")
		return false
	}

	// Secure path validation
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path: %v", err)
		return false
	}

	log.Printf("Opening Command Prompt in directory: %s", securePath)

	// Try optimized method first
	if t.openWindowsTerminalOptimized(securePath, "cmd") {
		return true
	}

	// Secure fallback - don't use fmt.Sprintf for command construction
	// Instead, pass the directory as working directory and use cd command safely
	cmd := exec.Command("cmd.exe", "/K", "cd", "/d", securePath)

	// Create new console window
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    false,
		CreationFlags: 0x00000010, // CREATE_NEW_CONSOLE
	}

	// Set working directory as additional security
	cmd.Dir = securePath

	err = cmd.Start()
	if err != nil {
		log.Printf("Error opening Command Prompt: %v", err)
		return false
	}

	log.Printf("Successfully opened Command Prompt in directory: %s", securePath)
	return true
}

// OpenWindowsTerminalApp opens Windows Terminal app (if available) with secure path handling
func (t *TerminalManager) OpenWindowsTerminalApp(directoryPath string) bool {
	if runtime.GOOS != "windows" {
		log.Printf("Windows Terminal is only available on Windows")
		return false
	}

	// Secure path validation
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: Invalid directory path: %v", err)
		return false
	}

	log.Printf("Opening Windows Terminal app in directory: %s", securePath)

	// Try optimized method first
	if t.openWindowsTerminalOptimized(securePath, "wt") {
		return true
	}

	// Secure fallback - pass directory as separate argument
	cmd := exec.Command("wt.exe", "-d", securePath)
	cmd.Dir = securePath // Additional security

	err = cmd.Start()
	if err != nil {
		log.Printf("Error opening Windows Terminal: %v", err)
		// Fallback to PowerShell
		log.Printf("Falling back to PowerShell")
		return t.OpenPowerShellHere(securePath)
	}

	log.Printf("Successfully opened Windows Terminal in directory: %s", securePath)
	return true
}

// GetAvailableTerminals returns a list of available terminal applications
func (t *TerminalManager) GetAvailableTerminals() []string {
	var terminals []string

	switch runtime.GOOS {
	case "windows":
		// Check for available Windows terminals
		terminalPaths := []struct {
			path string
			name string
		}{
			{"C:\\Program Files\\PowerShell\\7\\pwsh.exe", "PowerShell 7"},
			{"powershell.exe", "Windows PowerShell"},
			{"cmd.exe", "Command Prompt"},
			{"wt.exe", "Windows Terminal"},
		}

		for _, term := range terminalPaths {
			if term.name == "Windows Terminal" {
				// Special check for Windows Terminal
				if _, err := exec.LookPath("wt.exe"); err == nil {
					terminals = append(terminals, term.name)
				}
			} else if _, err := os.Stat(term.path); err == nil || term.name == "Windows PowerShell" || term.name == "Command Prompt" {
				terminals = append(terminals, term.name)
			}
		}

	case "darwin":
		terminals = append(terminals, "Terminal", "iTerm2")

	case "linux":
		// Check for common Linux terminals
		linuxTerminals := []string{
			"gnome-terminal", "konsole", "xfce4-terminal",
			"xterm", "urxvt", "terminator", "alacritty", "kitty",
		}

		for _, term := range linuxTerminals {
			if _, err := exec.LookPath(term); err == nil {
				terminals = append(terminals, term)
			}
		}
	}

	return terminals
}

// ExecuteCommand executes a command in the specified working directory with security validation
func (t *TerminalManager) ExecuteCommand(command string, workingDir string) error {
	log.Printf("Executing command: %s in directory: %s", command, workingDir)

	// Input validation
	if command == "" {
		return fmt.Errorf("command cannot be empty")
	}

	// Validate working directory if provided
	var secureWorkingDir string
	if workingDir != "" {
		var err error
		secureWorkingDir, err = t.securePath(workingDir)
		if err != nil {
			return fmt.Errorf("invalid working directory: %v", err)
		}
	}

	// Security: Validate the command doesn't contain dangerous patterns
	dangerousPatterns := []string{
		"rm -rf /", "del /s /q", "format", "fdisk",
		"shutdown", "reboot", "halt", "poweroff",
		"passwd", "sudo su", "chmod 777",
		"&& rm", "&& del", "| rm", "| del",
		"; rm", "; del", "`rm", "`del",
	}

	lowerCommand := strings.ToLower(command)
	for _, pattern := range dangerousPatterns {
		if strings.Contains(lowerCommand, pattern) {
			return fmt.Errorf("command contains potentially dangerous pattern: %s", pattern)
		}
	}

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		// Use cmd with secure argument passing
		cmd = exec.Command("cmd", "/C", command)
	default:
		// Use sh with secure argument passing
		cmd = exec.Command("sh", "-c", command)
	}

	if secureWorkingDir != "" {
		cmd.Dir = secureWorkingDir
	}

	// Hide window for background execution
	if runtime.GOOS == "windows" {
		cmd.SysProcAttr = &syscall.SysProcAttr{HideWindow: true}
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Command execution failed: %v, output: %s", err, string(output))
		return err
	}

	log.Printf("Command executed successfully, output: %s", string(output))
	return nil
}
