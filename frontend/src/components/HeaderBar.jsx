import { SettingsIcon } from './SettingsIcon';

export function HeaderBar({
    currentPath,
    isInspectMode,
    filteredDirectoriesCount,
    filteredFilesCount,
    showHiddenFiles,
    selectedCount,
    isAppInitialized,
    navigationStats,
    onSettingsClick
}) {
    return (
        <header className="app-header">
            <div className="app-title">
                Files
                {isInspectMode && <span className="inspect-mode-indicator">INSPECT (F7)</span>}
            </div>
            <div className="header-stats">
                <span className="text-technical">
                    {currentPath
                        ? `${filteredDirectoriesCount} dirs • ${filteredFilesCount} files${!showHiddenFiles ? " (hidden filtered)" : ""}${selectedCount > 0 ? ` • ${selectedCount} selected` : ""}`
                        : isAppInitialized
                        ? "Loading..."
                        : "Ready"}
                </span>
                {navigationStats.totalNavigations > 0 && (
                    <span className="performance-indicator">
                        {navigationStats.lastNavigationTime === 0
                            ? "Measuring..."
                            : `${Math.round(
                                  navigationStats.lastNavigationTime
                              )}ms load time`}
                    </span>
                )}
            </div>
            <div className="header-actions">
                <SettingsIcon onClick={onSettingsClick} />
            </div>
        </header>
    );
}