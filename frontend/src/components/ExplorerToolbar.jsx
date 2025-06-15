export function ExplorerToolbar({
    currentPath,
    handleNavigateUp,
    handleRefresh,
    handleOpenInExplorer,
    showHiddenFiles,
    toggleShowHiddenFiles,
    sortBy,
    sortOrder,
    handleSortChange,
}) {
    return (
        <div className="toolbar">
            <button
                className="toolbar-btn"
                onClick={handleNavigateUp}
                disabled={!currentPath}
            >
                Up
            </button>
            <button
                className="toolbar-btn"
                onClick={handleRefresh}
                disabled={!currentPath}
            >
                Refresh
            </button>
            <button
                className="toolbar-btn"
                onClick={handleOpenInExplorer}
                disabled={!currentPath}
            >
                Open
            </button>
            <button
                className={`toolbar-btn ${showHiddenFiles ? "active" : ""}`}
                onClick={toggleShowHiddenFiles}
            >
                Hidden
            </button>

            {/* Sort dropdown */}
            <div className="sort-dropdown">
                <button className="toolbar-btn sort-btn" disabled={!currentPath}>
                    Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                    {sortOrder === "desc" ? " ↓" : " ↑"}
                </button>
                <div className="sort-dropdown-content">
                    {[
                        { key: "name", label: "Name" },
                        { key: "size", label: "Size" },
                        { key: "type", label: "Type" },
                        { key: "modified", label: "Modified" },
                    ].map(({ key, label }) => (
                        <button
                            key={key}
                            className={`sort-option ${sortBy === key ? "active" : ""}`}
                            onClick={() => handleSortChange(key)}
                        >
                            {label} {sortBy === key ? (sortOrder === "desc" ? "↓" : "↑") : ""}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
} 