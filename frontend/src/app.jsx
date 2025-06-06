import './components/FastNavigation.css';
import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import { Suspense } from "preact/compat";

// Import core Wails API
import { 
    OpenInSystemExplorer,
    GetHomeDirectory,
    NavigateToPath,
    ListDirectory,
    GetDriveInfo
} from "../wailsjs/go/backend/App";

// Import core utilities synchronously - needed for immediate file filtering and processing
import { filterFiles, getFileType, getFileIcon } from "./utils/fileUtils";

// Sorting utility function - inline for immediate availability
const sortFiles = (files, sortBy, sortOrder) => {
    if (!files || files.length === 0) return files;
    
    const sorted = [...files].sort((a, b) => {
        let aValue, bValue;
        
        switch (sortBy) {
            case 'name':
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
                break;
            case 'size':
                // Directories get size 0 for sorting
                aValue = a.isDir ? 0 : (a.size || 0);
                bValue = b.isDir ? 0 : (b.size || 0);
                break;
            case 'type':
                // Sort by file extension, directories first
                if (a.isDir && !b.isDir) return -1;
                if (!a.isDir && b.isDir) return 1;
                aValue = a.isDir ? 'folder' : (a.name.split('.').pop() || '').toLowerCase();
                bValue = b.isDir ? 'folder' : (b.name.split('.').pop() || '').toLowerCase();
                break;
            case 'modified':
                aValue = new Date(a.modTime || 0);
                bValue = new Date(b.modTime || 0);
                break;
            default:
                aValue = a.name.toLowerCase();
                bValue = b.name.toLowerCase();
        }
        
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    
    return sorted;
};

// Import utilities
import { log, error } from "./utils/logger";
import { 
    HEADER_STATS_STYLE,
    PERFORMANCE_INDICATOR_STYLE,
    CURRENT_PATH_INDICATOR_STYLE,
    ERROR_DISMISS_BUTTON_STYLE,
    STATUS_BAR_RIGHT_STYLE,
    LOADING_OVERLAY_STYLE,
    LARGE_ICON_STYLE,
    LOADING_SPINNER_LARGE_STYLE,
    EMPTY_DIRECTORY_STYLE
} from "./utils/styleConstants";

// Import our custom components - lazy loaded heavy components
import {
    Breadcrumb,
    Sidebar,
    FileItem,
    ContextMenu,
    EmptySpaceContextMenu,
    RetroDialog,
    VirtualizedFileList, // Now lazy-loaded
    InlineFolderEditor,
    InspectMenu,
    PerformanceDashboard
} from "./components";

// Import our custom hooks
import {
    useFileOperations,
    useSelection,
    useClipboard,
    useNavigation,
    useDialogs,
    useContextMenus,
    usePerformanceMonitoring,
    useKeyboardShortcuts,
    useDragAndDrop,
    useFolderCreation,
    useInspectMode,
    useFPSTracker
} from "./hooks";

// File utilities are now imported synchronously at the top for immediate availability

// Main App component
export function App() {
    // Basic UI state
    const [error, setError] = useState('');
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    const [sortBy, setSortBy] = useState('name'); // name, size, type, modified
    const [sortOrder, setSortOrder] = useState('asc'); // asc, desc
    
    // Startup state to control when heavy operations run
    const [isAppInitialized, setIsAppInitialized] = useState(false);
    const [isDriveDataLoaded, setIsDriveDataLoaded] = useState(false);

    // Custom hooks
    const { navigationStats, setNavigationStats } = usePerformanceMonitoring();
    
    // Inspect mode hook
    const {
        isInspectMode,
        inspectMenu,
        handleInspectClick,
        handleInspectContextMenu,
        closeInspectMenu
    } = useInspectMode();
    

    
    const {
        currentPath,
        directoryContents,
        showLoadingIndicator,
        navigateToPath,
        handleNavigateUp,
        handleRefresh
    } = useNavigation(setError, setNavigationStats);

    const { dialog, showDialog, closeDialog } = useDialogs();

    const {
        selectedFiles,
        handleFileSelect,
        clearSelection,
        selectAll,
        handleArrowNavigation
    } = useSelection();

    const {
        clipboardFiles,
        clipboardOperation,
        handleCopy,
        handleCut,
        clearClipboard,
        isPasteAvailable
    } = useClipboard();

    // Initialize file operations hook
    const fileOperations = useFileOperations(
        currentPath, 
        setError, 
        clearSelection, 
        () => navigateToPath(currentPath), 
        showDialog
    );

    // Folder creation hook
    const {
        creatingFolder,
        tempFolderName,
        editInputRef,
        startFolderCreation,
        cancelFolderCreation,
        confirmFolderCreation,
        handleKeyDown,
        handleInputChange,
        handleInputBlur
    } = useFolderCreation(currentPath, handleRefresh, setError);

    // Computed values - use synchronously imported file utils for immediate availability
    const filteredDirectories = useMemo(() => {
        if (!directoryContents) return [];
        const filtered = filterFiles(directoryContents.directories, showHiddenFiles);
        return sortFiles(filtered, sortBy, sortOrder);
    }, [directoryContents, showHiddenFiles, sortBy, sortOrder]);
    
    const filteredFiles = useMemo(() => {
        if (!directoryContents) return [];
        const filtered = filterFiles(directoryContents.files, showHiddenFiles);
        return sortFiles(filtered, sortBy, sortOrder);
    }, [directoryContents, showHiddenFiles, sortBy, sortOrder]);
    
    const allFiles = useMemo(() => 
        [...filteredDirectories, ...filteredFiles], 
        [filteredDirectories, filteredFiles]
    );

    // Context menus hook
    const {
        contextMenu,
        emptySpaceContextMenu,
        handleContextMenu,
        closeContextMenu,
        handleEmptySpaceContextMenu,
        closeEmptySpaceContextMenu,
        handleContextCopy,
        handleContextCut,
        handleContextRename,
        handleContextHide,
        handlePermanentDelete,
        handleOpenPowerShell,
        handleCreateFolder
    } = useContextMenus(
        selectedFiles, 
        allFiles, 
        handleCopy, 
        handleCut, 
        showDialog, 
        fileOperations, 
        currentPath, 
        startFolderCreation,
        isInspectMode
    );

    // Drag and drop hook
    const {
        dragState,
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop,
        handleDragEnd
    } = useDragAndDrop(
        currentPath,
        selectedFiles,
        allFiles,
        setError,
        clearSelection,
        handleRefresh
    );

    // File operation handlers
    const handleFileOpen = useCallback((file) => {
        const result = fileOperations.handleFileOpen(file);
        if (result && result.type === 'navigate') {
            // Use direct navigation for file opens (immediate response)
            navigateToPath(result.path, 'file-open');
        }
    }, [fileOperations, navigateToPath]);

    const handleOpenInExplorer = useCallback(() => {
        if (currentPath) {
            OpenInSystemExplorer(currentPath);
        }
    }, [currentPath]);

    // Sort handlers
    const handleSortChange = useCallback((newSortBy) => {
        if (sortBy === newSortBy) {
            // Toggle sort order if same sort type
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            // New sort type, default to ascending
            setSortBy(newSortBy);
            setSortOrder('asc');
        }
    }, [sortBy, sortOrder]);

    // Clipboard operations
    const handleCopySelected = useCallback(() => {
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        handleCopy(filePaths);
    }, [selectedFiles, allFiles, handleCopy]);

    const handleCutSelected = useCallback(() => {
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        handleCut(filePaths);
    }, [selectedFiles, allFiles, handleCut]);

    const handlePaste = useCallback(async () => {
        if (!isPasteAvailable() || !currentPath) return;
        
        try {
            log(`📥 Pasting ${clipboardFiles.length} items to:`, currentPath);
            
            let success = false;
            if (clipboardOperation === 'copy') {
                success = await fileOperations.handleCopyFiles(clipboardFiles);
            } else if (clipboardOperation === 'cut') {
                success = await fileOperations.handleMoveFiles(clipboardFiles);
                if (success) {
                    clearClipboard();
                }
            }
            
            if (!success) {
                setError('Paste operation failed');
            } else {
                // Refresh the directory to show the pasted files immediately
                handleRefresh();
            }
        } catch (err) {
            error('❌ Error during paste operation:', err);
            setError('Failed to paste files: ' + err.message);
        }
    }, [isPasteAvailable, currentPath, clipboardFiles, clipboardOperation, fileOperations, clearClipboard]);

    // Keyboard shortcuts
    useKeyboardShortcuts({
        handleRefresh,
        handleNavigateUp,
        selectedFiles,
        allFiles,
        handleFileOpen,
        selectAll,
        handleCopySelected,
        handleCutSelected,
        handlePaste,
        isPasteAvailable,
        handleArrowNavigation,
        clearSelection,
        closeContextMenu,
        closeEmptySpaceContextMenu
    });

    // Initialize the application
    useEffect(() => {
        log('🚀 Lightning Explorer mounting');
        
        // Initialize app
        initializeApp();
        
        // Parallelize non-dependent async work using requestIdleCallback
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
                // Preload rarely used components during idle time
                import('./components/InspectMenu');
                import('./components/PerformanceDashboard');
            });
        }
    }, []);

    // Load drives using regular API
    const loadDrives = useCallback(async () => {
        if (isDriveDataLoaded) return drives;
        
        try {
            const driveList = await GetDriveInfo();
            setDrives(driveList);
            setIsDriveDataLoaded(true);
            return driveList;
        } catch (err) {
            error('❌ Failed to load drive information:', err);
            return [];
        }
    }, [isDriveDataLoaded, drives]);

    const initializeApp = async () => {
        try {
            setError('');
            
            const homeDir = await GetHomeDirectory();
            
            if (homeDir) {
                await navigateToPath(homeDir, 'init');
                setIsAppInitialized(true);
            } else {
                setError('Unable to determine starting directory');
            }
        } catch (err) {
            error('❌ Error initializing app:', err);
            setError('Failed to initialize file explorer: ' + err.message);
        }
    };



    // Clear selection when path changes
    useEffect(() => {
        clearSelection();
        closeContextMenu();
    }, [currentPath, clearSelection, closeContextMenu]);

    return (
        <div 
            className={`file-explorer ${dragState.isDragging ? 'dragging-active' : ''} ${isInspectMode ? 'inspect-mode' : ''}`}
            onSelectStart={(e) => e.preventDefault()}
            onDragEnd={handleDragEnd}
            onClick={(e) => {
                // Handle inspect mode clicks
                if (handleInspectClick(e)) {
                    return; // Prevent normal click handling
                }
            }}
            onContextMenu={(e) => {
                // Handle inspect mode context menus
                if (isInspectMode) {
                    if (!handleInspectContextMenu(e)) {
                        // Allow native context menu in inspect mode
                        return;
                    }
                }
                
                // Global fallback to prevent browser context menu in normal mode
                if (!e.target.closest('.file-item') && !e.target.closest('.context-menu') && !e.target.closest('.inspect-menu')) {
                    e.preventDefault();
                }
            }}
        >
            {/* Header */}
            <header className="app-header">
                <div className="app-title">
                    Files
                    {isInspectMode && (
                        <span className="inspect-mode-indicator" style={{
                            marginLeft: '1rem',
                            padding: '0.25rem 0.5rem',
                            background: '#ff6b35',
                            color: 'white',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                        }}>
                            🔍 INSPECT MODE (F7)
                        </span>
                    )}
                </div>
                <div style={HEADER_STATS_STYLE}>
                    {showLoadingIndicator && <div className="loading-spinner"></div>}
                    <span className="text-technical">
                        {directoryContents ? 
                            `${filteredDirectories.length} dirs • ${filteredFiles.length} files${!showHiddenFiles ? ' (hidden filtered)' : ''}${selectedFiles.size > 0 ? ` • ${selectedFiles.size} selected` : ''}` : 
                            (isAppInitialized ? 'Loading...' : 'Ready')
                        }
                    </span>
                    {/* Performance indicator - Complete UI render timing */}
                    {navigationStats.totalNavigations > 0 && (
                        <span className="text-technical" style={PERFORMANCE_INDICATOR_STYLE}>
                            {navigationStats.lastNavigationTime === 0 ? 
                                'Measuring...' : 
                                `${Math.round(navigationStats.lastNavigationTime)}ms fresh data`
                            }
                            {` (${navigationStats.totalNavigations} real-time loads)`}
                        </span>
                    )}
                </div>
            </header>
            
            {/* Error display */}
            {error && (
                <div className="error-message">
                    <strong>⚠️ Error:</strong> {error}
                    <button onClick={() => setError('')} style={ERROR_DISMISS_BUTTON_STYLE}>
                        Dismiss
                    </button>
                </div>
            )}
            
            {/* Main content */}
            <div className="main-content">
                <Sidebar 
                    currentPath={currentPath}
                    onNavigate={(path) => navigateToPath(path, 'sidebar')}
                    drives={drives}
                    onDriveExpand={loadDrives} // Load drives only when user expands drive section
                />
                
                <div className="content-area">
                    {/* Toolbar */}
                    <div className="toolbar">
                        <button className="toolbar-btn" onClick={handleNavigateUp} disabled={!currentPath}>
                            ⬆️ Up
                        </button>
                        <button className="toolbar-btn" onClick={handleRefresh} disabled={!currentPath}>
                            🔄 Refresh
                        </button>
                        <button className="toolbar-btn" onClick={handleOpenInExplorer} disabled={!currentPath}>
                            🖥️ Open in Explorer
                        </button>
                        <button 
                            className={`toolbar-btn ${showHiddenFiles ? 'active' : ''}`}
                            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                        >
                            {showHiddenFiles ? '👁️' : '🙈'} Hidden
                        </button>
                        
                        {/* Sort dropdown */}
                        <div className="sort-dropdown">
                            <button className="toolbar-btn sort-btn" disabled={!currentPath}>
                                📊 Sort: {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                                {sortOrder === 'desc' ? ' ↓' : ' ↑'}
                            </button>
                            <div className="sort-dropdown-content">
                                <button 
                                    className={`sort-option ${sortBy === 'name' ? 'active' : ''}`}
                                    onClick={() => handleSortChange('name')}
                                >
                                    📝 Name {sortBy === 'name' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </button>
                                <button 
                                    className={`sort-option ${sortBy === 'size' ? 'active' : ''}`}
                                    onClick={() => handleSortChange('size')}
                                >
                                    📏 Size {sortBy === 'size' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </button>
                                <button 
                                    className={`sort-option ${sortBy === 'type' ? 'active' : ''}`}
                                    onClick={() => handleSortChange('type')}
                                >
                                    🏷️ Type {sortBy === 'type' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </button>
                                <button 
                                    className={`sort-option ${sortBy === 'modified' ? 'active' : ''}`}
                                    onClick={() => handleSortChange('modified')}
                                >
                                    🕒 Modified {sortBy === 'modified' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
                                </button>
                            </div>
                        </div>

                    </div>
                    
                    {/* Breadcrumb navigation */}
                    {currentPath && (
                        <Breadcrumb 
                            currentPath={currentPath}
                            onNavigate={(path) => navigateToPath(path, 'breadcrumb')}
                        />
                    )}
                    
                    {/* File list - Use virtual scrolling for better performance with Suspense for lazy loading */}
                    <div 
                        className="file-list-container"
                        onClick={(e) => {
                            // Handle inspect mode clicks first
                            if (isInspectMode) {
                                return; // Let the parent handle inspect clicks
                            }
                            
                            // Check if clicking on empty space (not on a file item)
                            if (e.target === e.currentTarget || e.target.classList.contains('file-list') || e.target.classList.contains('file-list-container')) {
                                clearSelection();
                                closeContextMenu();
                                closeEmptySpaceContextMenu();
                            }
                        }}
                        onContextMenu={(e) => {
                            // In inspect mode, allow native context menu
                            if (isInspectMode) {
                                return; // Don't prevent default
                            }
                            
                            // Prevent default browser context menu and show our custom one
                            e.preventDefault();
                            
                            // Check if right-clicking on empty space (not on a file item)
                            const isEmptySpace = e.target === e.currentTarget || 
                                                e.target.classList.contains('file-list') || 
                                                e.target.classList.contains('file-list-container') ||
                                                e.target.classList.contains('virtualized-file-list') ||
                                                (!e.target.closest('.file-item'));
                            
                            if (isEmptySpace) {
                                closeContextMenu();
                                closeEmptySpaceContextMenu();
                                handleEmptySpaceContextMenu(e);
                            }
                        }}
                    >
                        {showLoadingIndicator ? (
                            <div className="loading-overlay">
                                <div style={LOADING_OVERLAY_STYLE}>
                                    <div className="loading-spinner" style={LOADING_SPINNER_LARGE_STYLE}></div>
                                    <div className="text-technical">Loading directory...</div>
                                </div>
                            </div>
                        ) : directoryContents ? (
                            allFiles.length > 0 ? (
                                // Always use virtual scrolling for better performance - now bundled synchronously
                                <VirtualizedFileList
                                    files={allFiles}
                                    selectedFiles={selectedFiles}
                                    onFileSelect={handleFileSelect}
                                    onFileOpen={handleFileOpen}
                                    onContextMenu={handleContextMenu}
                                    isLoading={false} // Never show loading in file items
                                    clipboardFiles={clipboardFiles}
                                    clipboardOperation={clipboardOperation}
                                    dragState={dragState}
                                    onDragStart={handleDragStart}
                                    onDragOver={handleDragOver}
                                    onDragEnter={handleDragEnter}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    creatingFolder={creatingFolder}
                                    tempFolderName={tempFolderName}
                                    editInputRef={editInputRef}
                                    onFolderKeyDown={handleKeyDown}
                                    onFolderInputChange={handleInputChange}
                                    onFolderInputBlur={handleInputBlur}
                                    onEmptySpaceContextMenu={handleEmptySpaceContextMenu}
                                    isInspectMode={isInspectMode}
                                />
                            ) : (
                                // Fallback for when there are no files or folders
                                <div 
                                    className="file-list custom-scrollbar"
                                    onContextMenu={(e) => {
                                        // Check if right-clicking on the file list itself (empty space)
                                        if (e.target === e.currentTarget || !e.target.closest('.file-item')) {
                                            e.preventDefault();
                                            closeContextMenu();
                                            closeEmptySpaceContextMenu();
                                            handleEmptySpaceContextMenu(e);
                                        }
                                    }}
                                >
                                    {/* Show inline folder editor if creating folder */}
                                    {creatingFolder && (
                                        <InlineFolderEditor
                                            tempFolderName={tempFolderName}
                                            editInputRef={editInputRef}
                                            onKeyDown={handleKeyDown}
                                            onChange={handleInputChange}
                                            onBlur={handleInputBlur}
                                        />
                                    )}
                                    
                                    {!creatingFolder && (
                                        <div style={EMPTY_DIRECTORY_STYLE}>
                                            <div style={LARGE_ICON_STYLE}>📁</div>
                                            <div className="text-technical">Directory is empty</div>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <div style={EMPTY_DIRECTORY_STYLE}>
                                <div style={LARGE_ICON_STYLE}>📁</div>
                                <div className="text-technical">
                                    {isAppInitialized ? 'Loading...' : 'Ready'}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Context Menus and Dialog */}
            <ContextMenu
                visible={contextMenu.visible}
                x={contextMenu.x}
                y={contextMenu.y}
                files={contextMenu.files}
                onClose={closeContextMenu}
                onCopy={handleContextCopy}
                onCut={handleContextCut}
                onRename={handleContextRename}
                onHide={handleContextHide}
                onPermanentDelete={handlePermanentDelete}
            />
            
            <EmptySpaceContextMenu
                visible={emptySpaceContextMenu.visible}
                x={emptySpaceContextMenu.x}
                y={emptySpaceContextMenu.y}
                onClose={closeEmptySpaceContextMenu}
                onOpenPowerShell={handleOpenPowerShell}
                onCreateFolder={handleCreateFolder}
            />
            
            <RetroDialog
                isOpen={dialog.isOpen}
                type={dialog.type}
                title={dialog.title}
                message={dialog.message}
                defaultValue={dialog.defaultValue}
                onConfirm={dialog.onConfirm}
                onCancel={dialog.onCancel}
                onClose={closeDialog}
            />
            
            <Suspense fallback={null}>
                <InspectMenu
                    visible={inspectMenu.visible}
                    x={inspectMenu.x}
                    y={inspectMenu.y}
                    element={inspectMenu.element}
                    onClose={closeInspectMenu}
                />
            </Suspense>
            

            
            {/* Status bar */}
            <div className="status-bar">
                <span>
                    Path: {currentPath || 'Not selected'} 
                    {selectedFiles.size > 0 && ` • ${selectedFiles.size} item${selectedFiles.size === 1 ? '' : 's'} selected`}
                    {clipboardFiles.length > 0 && ` • ${clipboardFiles.length} item${clipboardFiles.length === 1 ? '' : 's'} ${clipboardOperation === 'cut' ? 'cut' : 'copied'}`}
                    {dragState.isDragging && ` • Dragging ${dragState.draggedFiles.length} item${dragState.draggedFiles.length === 1 ? '' : 's'} (${dragState.dragOperation === 'copy' ? 'Hold Ctrl to copy' : 'Release Ctrl to move'})`}
                </span>
                <span style={STATUS_BAR_RIGHT_STYLE}>
                    Lightning Explorer • Real-time updates • Internal drag & drop • Drag to folders to move/copy
                </span>
            </div>
        </div>
    );
} 