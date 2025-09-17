package backend

// helper accessors to reduce Once.Do boilerplate across app_* files

func (a *App) driveMgr() DriveManagerInterface {
	a.drivesOnce.Do(func() { a.drives = NewDriveManager(a.platform) })
	return a.drives
}

func (a *App) terminalMgr() TerminalManagerInterface {
	a.terminalOnce.Do(func() { a.terminal = NewTerminalManager() })
	return a.terminal
}
