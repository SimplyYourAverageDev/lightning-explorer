export function ExplorerStatusBar({
    currentPath,
    selectedCount,
    clipboardFiles,
    clipboardOperation,
    dragState,
}) {
    return (
        <div className="status-bar">
            <span>
                Path: {currentPath || "Not selected"}
                {selectedCount > 0 &&
                    ` • ${selectedCount} item${selectedCount === 1 ? "" : "s"} selected`}
                {clipboardFiles.length > 0 &&
                    ` • ${clipboardFiles.length} item${
                        clipboardFiles.length === 1 ? "" : "s"
                    } ${clipboardOperation === "cut" ? "cut" : "copied"}`}
                {dragState.isDragging &&
                    ` • Dragging ${dragState.draggedFiles.length} item${
                        dragState.draggedFiles.length === 1 ? "" : "s"
                    } (${dragState.dragOperation === "copy" ? "Hold Ctrl to copy" : "Release Ctrl to move"})`}
            </span>
            <span className="status-bar-right">
                Lightning Explorer • Real-time updates • Internal drag & drop • Drag to folders to move/copy
            </span>
        </div>
    );
} 