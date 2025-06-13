import { HEADER_STATS_STYLE, PERFORMANCE_INDICATOR_STYLE } from "../utils/styleConstants";

export function HeaderBar({
    isInspectMode,
    directoryContents,
    filteredDirectoriesCount,
    filteredFilesCount,
    showHiddenFiles,
    selectedCount,
    isAppInitialized,
    navigationStats
}) {
    return (
        <header className="app-header">
            <div className="app-title">
                Files
                {isInspectMode && (
                    <span
                        className="inspect-mode-indicator"
                        style={{
                            marginLeft: "1rem",
                            padding: "0.25rem 0.5rem",
                            background: "#ff6b35",
                            color: "white",
                            borderRadius: "4px",
                            fontSize: "0.75rem",
                            fontWeight: "bold",
                        }}
                    >
                        🔍 INSPECT MODE (F7)
                    </span>
                )}
            </div>
            <div style={HEADER_STATS_STYLE}>
                <span className="text-technical">
                    {directoryContents
                        ? `${filteredDirectoriesCount} dirs • ${filteredFilesCount} files${!showHiddenFiles ? " (hidden filtered)" : ""}${selectedCount > 0 ? ` • ${selectedCount} selected` : ""}`
                        : isAppInitialized
                        ? "Loading..."
                        : "Ready"}
                </span>
                {navigationStats.totalNavigations > 0 && (
                    <span
                        className="text-technical"
                        style={PERFORMANCE_INDICATOR_STYLE}
                    >
                        {navigationStats.lastNavigationTime === 0
                            ? "Measuring..."
                            : `${Math.round(
                                  navigationStats.lastNavigationTime
                              )}ms load time`}
                    </span>
                )}
            </div>
        </header>
    );
} 