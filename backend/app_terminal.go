package backend

// OpenPowerShellHere opens PowerShell in the specified directory
func (a *App) OpenPowerShellHere(directoryPath string) bool {
	return a.terminalMgr().OpenPowerShellHere(directoryPath)
}

// OpenTerminalHere opens the system's default terminal in the specified directory
func (a *App) OpenTerminalHere(directoryPath string) bool {
	return a.terminalMgr().OpenTerminalHere(directoryPath)
}

// GetAvailableTerminals returns a list of available terminal applications
func (a *App) GetAvailableTerminals() []string {
	return a.terminalMgr().GetAvailableTerminals()
}

// ExecuteCommand executes a command in the specified working directory
func (a *App) ExecuteCommand(command string, workingDir string) bool {
	err := a.terminalMgr().ExecuteCommand(command, workingDir)
	return err == nil
}
