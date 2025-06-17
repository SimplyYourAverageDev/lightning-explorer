package backend

// OpenPowerShellHere opens PowerShell in the specified directory
func (a *App) OpenPowerShellHere(directoryPath string) bool {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	return a.terminal.OpenPowerShellHere(directoryPath)
}

// OpenTerminalHere opens the system's default terminal in the specified directory
func (a *App) OpenTerminalHere(directoryPath string) bool {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	return a.terminal.OpenTerminalHere(directoryPath)
}

// GetAvailableTerminals returns a list of available terminal applications
func (a *App) GetAvailableTerminals() []string {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	return a.terminal.GetAvailableTerminals()
}

// ExecuteCommand executes a command in the specified working directory
func (a *App) ExecuteCommand(command string, workingDir string) bool {
	a.terminalOnce.Do(func() {
		a.terminal = NewTerminalManager()
	})
	err := a.terminal.ExecuteCommand(command, workingDir)
	return err == nil
}
