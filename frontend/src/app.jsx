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
import { filterFiles, getFileType, getFileIcon, splitFilename } from "./utils/fileUtils";

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

// Import our custom components
import {
    Breadcrumb,
    Sidebar,
    ContextMenu,
    EmptySpaceContextMenu,
    RetroDialog,
    InlineFolderEditor,
    InspectMenu,
    PerformanceDashboard
} from "./components";

import { StreamingVirtualizedFileList } from "./components/StreamingVirtualizedFileList";

// Import our custom hooks
import {
    useFileOperations,
    useSelection,
    useClipboard,
    useDialogs,
    useContextMenus,
    usePerformanceMonitoring,
    useKeyboardShortcuts,
    useDragAndDrop,
    useFolderCreation,
    useInspectMode,
    useFPSTracker
} from "./hooks";

import { useStreamingNavigation } from "./hooks/useStreamingNavigation";

// File utilities are now imported synchronously at the top for immediate availability

// Main App component
export function App() {
    // Basic UI state
    const [error, setError] = useState('');
    const [errorDetails, setErrorDetails] = useState(null);
    const [errorDismissTimer, setErrorDismissTimer] = useState(null);
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    
    // Startup state to control when heavy operations run
    const [isAppInitialized, setIsAppInitialized] = useState(false);
    const [isDriveDataLoaded, setIsDriveDataLoaded] = useState(false);

    // Toggle hidden files visibility (memoized)
    const toggleShowHiddenFiles = useCallback(() => setShowHiddenFiles(prev => !prev), []);

    // Enhanced error handling functions
    const showErrorNotification = useCallback((message, details = null, autoDismiss = true) => {
        setError(message);
        setErrorDetails(details);
        
        // Clear any existing timer
        if (errorDismissTimer) {
            clearTimeout(errorDismissTimer);
        }
        
        // Auto-dismiss after 8 seconds for non-critical errors
        if (autoDismiss && !details) {
            const timer = setTimeout(() => {
                setError('');
                setErrorDetails(null);
            }, 8000);
            setErrorDismissTimer(timer);
        }
    }, [errorDismissTimer]);

    const dismissErrorNotification = useCallback(() => {
        if (errorDismissTimer) {
            clearTimeout(errorDismissTimer);
            setErrorDismissTimer(null);
        }
        setError('');
        setErrorDetails(null);
    }, [errorDismissTimer]);

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
    } = useStreamingNavigation(showErrorNotification, setNavigationStats);

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
        showErrorNotification, 
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
    } = useFolderCreation(currentPath, handleRefresh, showErrorNotification);

    // Computed values for streaming mode - work with the flattened files array
    const allFiles = useMemo(() => {
        if (!directoryContents) return [];
        
        // Combine directories and files from directoryContents
        const allItems = [...directoryContents.directories, ...directoryContents.files];
        
        // Filter and sort the combined list
        const filtered = filterFiles(allItems, showHiddenFiles);
        return sortFiles(filtered, sortBy, sortOrder);
    }, [directoryContents, showHiddenFiles, sortBy, sortOrder]);
    
    // For backward compatibility, split allFiles back into directories and files
    const filteredDirectories = useMemo(() => 
        allFiles.filter(file => file.isDir), 
        [allFiles]
    );
    
    const filteredFiles = useMemo(() => 
        allFiles.filter(file => !file.isDir), 
        [allFiles]
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
        showErrorNotification,
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
                showErrorNotification('Paste operation failed');
            } else {
                // Refresh the directory to show the pasted files immediately
                handleRefresh();
            }
        } catch (err) {
            error('❌ Error during paste operation:', err);
            showErrorNotification('Failed to paste files', err.message);
        }
    }, [isPasteAvailable, currentPath, clipboardFiles, clipboardOperation, fileOperations, clearClipboard]);

    // Rename handler for keyboard shortcut
    const handleRenameSelected = useCallback(() => {
        if (selectedFiles.size !== 1) return;
        
        const selectedIndex = Array.from(selectedFiles)[0];
        const file = allFiles[selectedIndex];
        
        if (!file) return;
        
        showDialog(
            'prompt',
            'RENAME FILE',
            `RENAME "${file.name}" TO:`,
            file.name,
            (newName) => {
                if (newName && newName !== file.name && newName.trim() !== '') {
                    fileOperations.handleRename(file.path, newName.trim());
                }
            },
            null, // onCancel
            { isFile: !file.isDir, originalName: file.name } // Extra data for selective text selection
        );
    }, [selectedFiles, allFiles, showDialog, fileOperations]);

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
        closeEmptySpaceContextMenu,
        handleRename: handleRenameSelected
    });

    // Initialize the application
    useEffect(() => {
        // —— kick off only the minimal UI load path —— 
        initializeApp();
        
        // defer rarely‐used modules to idle
        const defer = window.requestIdleCallback || (fn => setTimeout(fn,200));
        defer(() => {
            import('./components/InspectMenu');
            import('./components/PerformanceDashboard');
        });
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
            showErrorNotification('Failed to load drive information', err.message);
            return [];
        }
    }, [isDriveDataLoaded, drives]);

    const initializeApp = async () => {
        try {
            dismissErrorNotification();
            
            const homeDir = await GetHomeDirectory();
            
            if (homeDir) {
                await navigateToPath(homeDir, 'init');
                setIsAppInitialized(true);
            } else {
                showErrorNotification('Unable to determine starting directory', null, false);
            }
        } catch (err) {
            error('❌ Error initializing app:', err);
            showErrorNotification('Failed to initialize file explorer', err.message, false);
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
                                `${Math.round(navigationStats.lastNavigationTime)}ms load time`
                            }
                        </span>
                    )}
                </div>
            </header>
            
            {/* Modern Error Notification System */}
            {error && (
                <div className={`error-notification ${errorDetails ? 'has-details' : ''}`}>
                    <div className="error-notification-content">
                        <div className="error-notification-header">
                            <div className="error-notification-icon">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path d="M10 2L18 17H2L10 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                                    <path d="M10 7V11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    <circle cx="10" cy="14" r="1" fill="currentColor"/>
                                </svg>
                            </div>
                            <div className="error-notification-text">
                                <div className="error-notification-title">System Notification</div>
                                <div className="error-notification-message">{error}</div>
                            </div>
                            <button 
                                className="error-notification-dismiss" 
                                onClick={dismissErrorNotification}
                                aria-label="Dismiss notification"
                            >
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                </svg>
                            </button>
                        </div>
                        {errorDetails && (
                            <div className="error-notification-details">
                                <div className="error-notification-details-content">
                                    {typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}
                                </div>
                            </div>
                        )}
                        <div className="error-notification-progress"></div>
                    </div>
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
                            onClick={toggleShowHiddenFiles}
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
                            dragState={dragState}
                            onDragOver={handleDragOver}
                            onDragEnter={handleDragEnter}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
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
                        ) : (
                            // Use streaming virtualized file list for optimal performance
                            <StreamingVirtualizedFileList
                                files={allFiles}
                                selectedFiles={selectedFiles}
                                onFileSelect={handleFileSelect}
                                onFileOpen={handleFileOpen}
                                onContextMenu={handleContextMenu}
                                loading={showLoadingIndicator}
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
                        )}
                    </div>
                </div>
            </div>
            
            {/* Context Menus and Dialog */}
            <Suspense fallback={null}>
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
                    metadata={dialog.metadata}
                />
            </Suspense>
            
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