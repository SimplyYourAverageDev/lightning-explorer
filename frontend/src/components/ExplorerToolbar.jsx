import { 
    ArrowUpIcon, 
    ArrowClockwiseIcon, 
    FolderOpenIcon, 
    EyeIcon, 
    EyeSlashIcon,
    SortAscendingIcon,
    SortDescendingIcon,
    CaretDownIcon
} from '@phosphor-icons/react';

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
                title="Navigate up one level"
            >
                <ArrowUpIcon size={16} weight="bold" />
                Up
            </button>
            <button
                className="toolbar-btn"
                onClick={handleRefresh}
                disabled={!currentPath}
                title="Refresh current directory"
            >
                <ArrowClockwiseIcon size={16} weight="bold" />
                Refresh
            </button>
            <button
                className="toolbar-btn"
                onClick={handleOpenInExplorer}
                disabled={!currentPath}
                title="Open in system file explorer"
            >
                <FolderOpenIcon size={16} weight="bold" />
                Open
            </button>
            <button
                className={`toolbar-btn ${showHiddenFiles ? "active" : ""}`}
                onClick={toggleShowHiddenFiles}
                title={showHiddenFiles ? "Hide hidden files" : "Show hidden files"}
            >
                {showHiddenFiles ? <EyeIcon size={16} weight="bold" /> : <EyeSlashIcon size={16} weight="bold" />}
                Hidden
            </button>
            
            {/* Sort Controls */}
            <div className="sort-dropdown">
                <button 
                    className="toolbar-btn"
                    title={`Sort by ${sortBy} (${sortOrder})`}
                >
                    {sortOrder === 'asc' ? 
                        <SortAscendingIcon size={16} weight="bold" /> : 
                        <SortDescendingIcon size={16} weight="bold" />
                    }
                    Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                    <CaretDownIcon size={12} weight="bold" />
                </button>
                <div className="sort-dropdown-content">
                    <div onClick={() => handleSortChange('name')}>Name</div>
                    <div onClick={() => handleSortChange('size')}>Size</div>
                    <div onClick={() => handleSortChange('type')}>Type</div>
                    <div onClick={() => handleSortChange('modified')}>Date Modified</div>
                </div>
            </div>
        </div>
    );
} 