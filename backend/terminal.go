package backend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"syscall"
)

// NewTerminalManager creates a new terminal manager instance
func NewTerminalManager() *TerminalManager {
	return &TerminalManager{}
}

// OpenPowerShellHere opens PowerShell 7 in the specified directory
func (t *TerminalManager) OpenPowerShellHere(directoryPath string) bool {
	log.Printf("Opening PowerShell 7 in directory: %s", directoryPath)

	// Validate the directory path
	if directoryPath == "" {
		log.Printf("Error: Empty directory path provided")
		return false
	}

	// Check if directory exists
	if _, err := os.Stat(directoryPath); os.IsNotExist(err) {
		log.Printf("Error: Directory does not exist: %s", directoryPath)
		return false
	}

	return t.openWindowsTerminal(directoryPath)
}

// OpenTerminalHere opens the system's default terminal in the specified directory
func (t *TerminalManager) OpenTerminalHere(directoryPath string) bool {
	log.Printf("Opening terminal in directory: %s", directoryPath)

	// Validate the directory path
	if directoryPath == "" {
		log.Printf("Error: Empty directory path provided")
		return false
	}

	// Check if directory exists
	if _, err := os.Stat(directoryPath); os.IsNotExist(err) {
		log.Printf("Error: Directory does not exist: %s", directoryPath)
		return false
	}

	switch runtime.GOOS {
	case "windows":
		return t.openWindowsTerminal(directoryPath)
	case "darwin":
		return t.openMacTerminal(directoryPath)
	case "linux":
		return t.openLinuxTerminal(directoryPath)
	default:
		log.Printf("Unsupported operating system: %s", runtime.GOOS)
		return false
	}
}

// openWindowsTerminal opens PowerShell in Windows
func (t *TerminalManager) openWindowsTerminal(directoryPath string) bool {
	// PowerShell 7 executable path
	pwshPath := "C:\\Program Files\\PowerShell\\7\\pwsh.exe"

	// Check if PowerShell 7 exists, fallback to Windows PowerShell if not
	if _, err := os.Stat(pwshPath); os.IsNotExist(err) {
		log.Printf("PowerShell 7 not found, falling back to Windows PowerShell")
		pwshPath = "powershell.exe"
	}

	log.Printf("Using PowerShell executable: %s", pwshPath)

	// Use the most reliable method: -NoExit without -Command, just set working directory
	cmd := exec.Command(pwshPath, "-NoExit")

	// Set the working directory for the process - this is the key!
	cmd.Dir = directoryPath

	// Create new console window that stays open
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    false,      // We want to show PowerShell window
		CreationFlags: 0x00000010, // CREATE_NEW_CONSOLE - create new console window
	}

	log.Printf("PowerShell command: %s %v in directory: %s", pwshPath, cmd.Args[1:], directoryPath)

	// Start the command
	err := cmd.Start()
	if err != nil {
		log.Printf("Error opening PowerShell: %v", err)
		return false
	}

	log.Printf("Successfully opened PowerShell in directory: %s", directoryPath)
	return true
}

// openMacTerminal opens Terminal in macOS
func (t *TerminalManager) openMacTerminal(directoryPath string) bool {
	// macOS: Open Terminal with the specified directory
	cmd := exec.Command("osascript", "-e", fmt.Sprintf(`tell app "Terminal" to do script "cd '%s'"`, directoryPath))

	err := cmd.Start()
	if err != nil {
		log.Printf("Error opening macOS Terminal: %v", err)
		return false
	}

	log.Printf("Successfully opened Terminal in directory: %s", directoryPath)
	return true
}

// openLinuxTerminal opens terminal in Linux
func (t *TerminalManager) openLinuxTerminal(directoryPath string) bool {
	// Linux: Try to open terminal in the directory
	// Try different terminal emulators in order of preference
	terminals := [][]string{
		{"gnome-terminal", "--working-directory", directoryPath},
		{"konsole", "--workdir", directoryPath},
		{"xfce4-terminal", "--working-directory", directoryPath},
		{"xterm", "-e", fmt.Sprintf("cd '%s' && bash", directoryPath)},
		{"urxvt", "-e", fmt.Sprintf("bash -c 'cd \"%s\" && bash'", directoryPath)},
		{"terminator", "--working-directory", directoryPath},
	}

	for _, terminalCmd := range terminals {
		if _, err := exec.LookPath(terminalCmd[0]); err == nil {
			cmd := exec.Command(terminalCmd[0], terminalCmd[1:]...)
			err := cmd.Start()
			if err == nil {
				log.Printf("Successfully opened %s in directory: %s", terminalCmd[0], directoryPath)
				return true
			}
			log.Printf("Failed to open %s: %v", terminalCmd[0], err)
		}
	}

	log.Printf("No suitable terminal emulator found")
	return false
}

// OpenCommandPromptHere opens Command Prompt in Windows (alternative to PowerShell)
func (t *TerminalManager) OpenCommandPromptHere(directoryPath string) bool {
	if runtime.GOOS != "windows" {
		log.Printf("Command Prompt is only available on Windows")
		return false
	}

	log.Printf("Opening Command Prompt in directory: %s", directoryPath)

	// Validate the directory path
	if directoryPath == "" {
		log.Printf("Error: Empty directory path provided")
		return false
	}

	// Check if directory exists
	if _, err := os.Stat(directoryPath); os.IsNotExist(err) {
		log.Printf("Error: Directory does not exist: %s", directoryPath)
		return false
	}

	// Open Command Prompt with specific directory
	cmd := exec.Command("cmd.exe", "/K", fmt.Sprintf("cd /d \"%s\"", directoryPath))

	// Create new console window
	cmd.SysProcAttr = &syscall.SysProcAttr{
		HideWindow:    false,
		CreationFlags: 0x00000010, // CREATE_NEW_CONSOLE
	}

	err := cmd.Start()
	if err != nil {
		log.Printf("Error opening Command Prompt: %v", err)
		return false
	}

	log.Printf("Successfully opened Command Prompt in directory: %s", directoryPath)
	return true
}

// OpenWindowsTerminalApp opens Windows Terminal app (if available)
func (t *TerminalManager) OpenWindowsTerminalApp(directoryPath string) bool {
	if runtime.GOOS != "windows" {
		log.Printf("Windows Terminal is only available on Windows")
		return false
	}

	log.Printf("Opening Windows Terminal app in directory: %s", directoryPath)

	// Check if Windows Terminal is available
	cmd := exec.Command("wt.exe", "-d", directoryPath)

	err := cmd.Start()
	if err != nil {
		log.Printf("Windows Terminal not available, error: %v", err)
		// Fallback to PowerShell
		return t.openWindowsTerminal(directoryPath)
	}

	log.Printf("Successfully opened Windows Terminal app in directory: %s", directoryPath)
	return true
}

// GetAvailableTerminals returns a list of available terminal applications
func (t *TerminalManager) GetAvailableTerminals() []string {
	var terminals []string

	switch runtime.GOOS {
	case "windows":
		// Check for Windows terminals
		windowsTerminals := []struct {
			path string
			name string
		}{
			{"C:\\Program Files\\PowerShell\\7\\pwsh.exe", "PowerShell 7"},
			{"powershell.exe", "Windows PowerShell"},
			{"cmd.exe", "Command Prompt"},
			{"wt.exe", "Windows Terminal"},
		}

		for _, term := range windowsTerminals {
			if term.name == "Windows Terminal" {
				// Special check for Windows Terminal using wt.exe
				if _, err := exec.LookPath("wt.exe"); err == nil {
					terminals = append(terminals, term.name)
				}
			} else if _, err := os.Stat(term.path); err == nil || term.name == "Windows PowerShell" || term.name == "Command Prompt" {
				terminals = append(terminals, term.name)
			}
		}

	case "darwin":
		// macOS terminals
		terminals = append(terminals, "Terminal")

		// Check for additional terminals
		macTerminals := []string{"iTerm", "Hyper", "Alacritty"}
		for _, term := range macTerminals {
			if _, err := exec.LookPath(strings.ToLower(term)); err == nil {
				terminals = append(terminals, term)
			}
		}

	case "linux":
		// Linux terminals
		linuxTerminals := []string{
			"gnome-terminal", "konsole", "xfce4-terminal", "xterm",
			"urxvt", "terminator", "alacritty", "kitty", "tilix",
		}

		for _, term := range linuxTerminals {
			if _, err := exec.LookPath(term); err == nil {
				terminals = append(terminals, term)
			}
		}
	}

	return terminals
}

// ExecuteCommand executes a command in the background (useful for scripts)
func (t *TerminalManager) ExecuteCommand(command string, workingDir string) error {
	log.Printf("Executing command: %s in directory: %s", command, workingDir)

	var cmd *exec.Cmd

	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/C", command)
	default:
		cmd = exec.Command("sh", "-c", command)
	}

	if workingDir != "" {
		cmd.Dir = workingDir
	}

	// Run the command and capture output
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Command execution failed: %v, output: %s", err, string(output))
		return err
	}

	log.Printf("Command executed successfully, output: %s", string(output))
	return nil
}
