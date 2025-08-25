//go:build !windows

package backend

import (
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// NewTerminalManager creates a new terminal manager instance
func NewTerminalManager() *TerminalManager {
	return &TerminalManager{}
}

// OpenPowerShellHere attempts to open PowerShell if available, otherwise falls back to default terminal
func (t *TerminalManager) OpenPowerShellHere(directoryPath string) bool {
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: %v", err)
		return false
	}

	if _, err := exec.LookPath("pwsh"); err == nil {
		cmd := exec.Command("pwsh", "-NoExit", "-c", "cd "+shellescape(securePath))
		cmd.Dir = securePath
		if err := cmd.Start(); err == nil {
			return true
		}
	}

	return t.OpenTerminalHere(securePath)
}

// OpenTerminalHere opens the system's default terminal in the specified directory
func (t *TerminalManager) OpenTerminalHere(directoryPath string) bool {
	securePath, err := t.securePath(directoryPath)
	if err != nil {
		log.Printf("Error: %v", err)
		return false
	}

	switch runtime.GOOS {
	case "darwin":
		return t.openMacTerminal(securePath)
	case "linux":
		return t.openLinuxTerminal(securePath)
	default:
		log.Printf("Unsupported operating system: %s", runtime.GOOS)
		return false
	}
}

// GetAvailableTerminals returns a list of available terminal applications
func (t *TerminalManager) GetAvailableTerminals() []string {
	var terminals []string
	switch runtime.GOOS {
	case "darwin":
		terminals = append(terminals, "Terminal", "iTerm2")
	case "linux":
		candidates := []string{
			"gnome-terminal", "konsole", "xfce4-terminal", "xterm", "urxvt", "terminator", "alacritty", "kitty",
		}
		for _, c := range candidates {
			if _, err := exec.LookPath(c); err == nil {
				terminals = append(terminals, c)
			}
		}
	}
	return terminals
}

// ExecuteCommand executes a command in the specified working directory
func (t *TerminalManager) ExecuteCommand(command string, workingDir string) error {
	log.Printf("Executing command: %s in directory: %s", command, workingDir)
	if command == "" {
		return fmt.Errorf("command cannot be empty")
	}

	var secureWorkingDir string
	if workingDir != "" {
		var err error
		secureWorkingDir, err = t.securePath(workingDir)
		if err != nil {
			return fmt.Errorf("invalid working directory: %v", err)
		}
	}

	dangerousPatterns := []string{
		"rm -rf /", "shutdown", "reboot", "poweroff", "&& rm", "| rm", "; rm",
	}
	lower := strings.ToLower(command)
	for _, p := range dangerousPatterns {
		if strings.Contains(lower, p) {
			return fmt.Errorf("command contains potentially dangerous pattern: %s", p)
		}
	}

	cmd := exec.Command("sh", "-c", command)
	if secureWorkingDir != "" {
		cmd.Dir = secureWorkingDir
	}

	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Printf("Command execution failed: %v, output: %s", err, string(output))
		return err
	}
	log.Printf("Command executed successfully, output: %s", string(output))
	return nil
}

// securePath sanitizes a directory path to prevent command injection
func (t *TerminalManager) securePath(directoryPath string) (string, error) {
	if directoryPath == "" {
		return "", fmt.Errorf("directory path cannot be empty")
	}
	cleanPath := filepath.Clean(directoryPath)
	if !filepath.IsAbs(cleanPath) {
		return "", fmt.Errorf("directory path must be absolute")
	}
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

	dangerousChars := []string{";", "&", "|", "`", "$", "(", ")", "{", "}", "[", "]", "<", ">", "\"", "'", "\n", "\r", "\t"}
	for _, ch := range dangerousChars {
		if strings.Contains(cleanPath, ch) {
			return "", fmt.Errorf("directory path contains potentially dangerous characters: %s", ch)
		}
	}
	return cleanPath, nil
}

// openMacTerminal opens Terminal in macOS with secure path handling
func (t *TerminalManager) openMacTerminal(directoryPath string) bool {
	tempScript := fmt.Sprintf(`tell application "Terminal" to do script "cd %s"`, strings.ReplaceAll(directoryPath, "'", "'\"'\"'"))
	cmd := exec.Command("osascript", "-e", tempScript)
	if err := cmd.Start(); err != nil {
		log.Printf("Error opening macOS Terminal: %v", err)
		return false
	}
	return true
}

// openLinuxTerminal opens terminal in Linux with secure execution
func (t *TerminalManager) openLinuxTerminal(directoryPath string) bool {
	terminals := []struct {
		command string
		args    []string
	}{
		{"gnome-terminal", []string{"--working-directory=" + directoryPath}},
		{"konsole", []string{"--workdir", directoryPath}},
		{"xfce4-terminal", []string{"--working-directory=" + directoryPath}},
		{"terminator", []string{"--working-directory=" + directoryPath}},
		{"xterm", []string{"-e", "bash", "-c", fmt.Sprintf("cd %s && exec bash", shellescape(directoryPath))}},
		{"urxvt", []string{"-cd", directoryPath}},
	}
	for _, term := range terminals {
		if _, err := exec.LookPath(term.command); err == nil {
			cmd := exec.Command(term.command, term.args...)
			cmd.Dir = directoryPath
			if err := cmd.Start(); err == nil {
				log.Printf("Successfully opened %s in directory: %s", term.command, directoryPath)
				return true
			}
		}
	}
	log.Printf("No terminal emulator found")
	return false
}

// shellescape properly escapes a string for shell use
func shellescape(s string) string {
	return "'" + strings.ReplaceAll(s, "'", "'\"'\"'") + "'"
}
