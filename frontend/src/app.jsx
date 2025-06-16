import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import { Suspense } from "preact/compat";

// Import core utilities synchronously - needed for immediate file filtering and processing
import { filterFiles} from "./utils/fileUtils";
import { EventsOn } from "../wailsjs/runtime/runtime";

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
import { log } from "./utils/logger";

// Import our custom components
import {
    Breadcrumb,
    Sidebar,
    ContextMenu,
    EmptySpaceContextMenu,
    DriveContextMenu,
    RetroDialog,
    InspectMenu,
    HeaderBar,
    ExplorerToolbar,
    ExplorerStatusBar,
    StreamingVirtualizedFileList,
    SettingsModal
} from "./components";

// Import our custom hooks
import {
    useFileOperations,
    useSelection,
    useClipboard,
    useDialogs,
    useContextMenus,
    useDriveContextMenu,
    usePerformanceMonitoring,
    useKeyboardShortcuts,
    useDragAndDrop,
    useFolderCreation,
    useInspectMode,
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
    const [homeDirectory, setHomeDirectory] = useState('');
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    const [sortBy, setSortBy] = useState('name');
    const [sortOrder, setSortOrder] = useState('asc');
    
    // Startup state to control when heavy operations run
    const [isAppInitialized, setIsAppInitialized] = useState(false);
    const [isDriveDataLoaded, setIsDriveDataLoaded] = useState(false);

    // Settings state
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [appSettings, setAppSettings] = useState({
        backgroundStartup: true,
        theme: "system",
        showHiddenFiles: false
    });

    // Ref for the file list component to enable auto-scrolling
    const fileListRef = useRef();

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
        files,
        showLoadingIndicator,
        loading,
        navigateToPath,     
        handleNavigateUp,
        handleRefresh
    } = useStreamingNavigation(showErrorNotification, setNavigationStats);

    const { dialog, showDialog, closeDialog } = useDialogs();

    // Create scrollToItem callback that uses the file list ref
    const scrollToItem = useCallback((index) => {
        if (fileListRef.current && fileListRef.current.scrollToItem) {
            fileListRef.current.scrollToItem(index);
        }
    }, []);

    const {
        selectedFiles,
        handleFileSelect: originalHandleFileSelect,
        clearSelection,
        selectAll,
        handleArrowNavigation
    } = useSelection(scrollToItem);

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
        handleKeyDown,
        handleInputChange,
        handleInputBlur
    } = useFolderCreation(currentPath, handleRefresh, showErrorNotification);

    // This is the combined, filtered, and potentially sorted list of files.
    const allFiles = useMemo(() => {
        if (!files) return [];
        
        const filtered = filterFiles(files, showHiddenFiles);

        // THE FIX: Only sort when streaming is complete.
        if (loading) {
            return filtered; // Return unsorted (but filtered) list while streaming
        }
        
        return sortFiles(filtered, sortBy, sortOrder); // Return sorted list when complete
    }, [files, showHiddenFiles, sortBy, sortOrder, loading]);
    
    // Split into directories/files in a single pass to avoid two extra iterations on large lists
    const { filteredDirectories, filteredFiles } = useMemo(() => {
        const out = { filteredDirectories: [], filteredFiles: [] };
        for (const f of allFiles) {
            if (f.isDir) out.filteredDirectories.push(f);
            else out.filteredFiles.push(f);
        }
        return out;
    }, [allFiles]);

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
        handleMoveToTrash,
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

    // Callback when a drive has been ejected successfully
    const handleDriveEjected = useCallback((drive) => {
        // Remove the drive from the drives list
        setDrives(prev => prev.filter(d => d.path !== drive.path));

        // If current path is within the ejected drive, navigate back to home directory
        if (currentPath && currentPath.toLowerCase().startsWith(drive.path.toLowerCase())) {
            if (homeDirectory) {
                navigateToPath(homeDirectory, 'drive-ejected');
            } else {
                // Fall back to root home when home directory not available
                navigateToPath('', 'drive-ejected');
            }
        }
    }, [currentPath, homeDirectory, navigateToPath]);

    // Drive context menu hook
    const {
        driveContextMenu,
        handleDriveContextMenu,
        closeDriveContextMenu,
        handleDriveEject,
        handleDriveOpenInExplorer,
        handleDriveProperties
    } = useDriveContextMenu(showDialog, showErrorNotification, handleDriveEjected);

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

    // Modified file selection handler - click to select, click selected to open
    const handleFileSelect = useCallback((fileIndex, isShiftKey, isCtrlKey) => {
        // If the file is already selected and it's a simple click (no modifiers), open it
        if (selectedFiles.has(fileIndex) && !isShiftKey && !isCtrlKey && selectedFiles.size === 1) {
            const file = allFiles[fileIndex];
            if (file) {
                const result = fileOperations.handleFileOpen(file);
                if (result && result.type === 'navigate') {
                    // Use direct navigation for file opens (immediate response)
                    navigateToPath(result.path, 'file-open');
                }
            }
            return;
        }
        
        // Otherwise, use the original selection logic
        originalHandleFileSelect(fileIndex, isShiftKey, isCtrlKey);
    }, [selectedFiles, allFiles, fileOperations, navigateToPath, originalHandleFileSelect]);

    // File operation handlers
    const handleFileOpen = useCallback((file) => {
        const result = fileOperations.handleFileOpen(file);
        if (result && result.type === 'navigate') {
            // Use direct navigation for file opens (immediate response)
            navigateToPath(result.path, 'file-open');
        }
    }, [fileOperations, navigateToPath]);

    const handleOpenInExplorer = useCallback(async () => {
        if (!currentPath) return;
        // Dynamically import only when the user triggers this action
        const { OpenInSystemExplorer } = await import('../wailsjs/go/backend/App');
        OpenInSystemExplorer(currentPath);
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

    // Delete to trash handler for keyboard shortcut
    const handleDeleteToTrash = useCallback(() => {
        if (selectedFiles.size === 0) return;
        
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        showDialog(
            'confirm',
            'MOVE TO TRASH',
            `Move ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} to the trash?`,
            '',
            () => {
                fileOperations.handleRecycleBinDelete(filePaths);
            }
        );
    }, [selectedFiles, allFiles, showDialog, fileOperations]);

    // Permanent delete handler for keyboard shortcut
    const handlePermanentDeleteSelected = useCallback(() => {
        if (selectedFiles.size === 0) return;
        
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        showDialog(
            'delete',
            '⚠️ PERMANENT DELETE WARNING',
            `Permanently delete ${filePaths.length} item${filePaths.length === 1 ? '' : 's'}? This cannot be undone!`,
            '',
            () => {
                fileOperations.handlePermanentDelete(filePaths);
            }
        );
    }, [selectedFiles, allFiles, showDialog, fileOperations]);

    // Settings handlers
    const handleSettingsOpen = useCallback(() => {
        setIsSettingsOpen(true);
    }, []);

    const handleSettingsClose = useCallback(() => {
        setIsSettingsOpen(false);
    }, []);

    const handleSettingsSave = useCallback((newSettings) => {
        setAppSettings(newSettings);
        
        // Apply settings that affect the current UI state
        if (newSettings.showHiddenFiles !== showHiddenFiles) {
            setShowHiddenFiles(newSettings.showHiddenFiles);
        }
        
        // Show notification about background startup changes
        if (newSettings.backgroundStartup !== appSettings.backgroundStartup) {
            const message = newSettings.backgroundStartup 
                ? 'Background startup enabled. App will run in background when closed.'
                : 'Background startup disabled. App will quit when closed.';
            showErrorNotification(message, null, true);
        }
    }, [appSettings, showHiddenFiles, showErrorNotification]);

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
        handleRename: handleRenameSelected,
        handleDeleteToTrash,
        handlePermanentDelete: handlePermanentDeleteSelected,
        isDialogOpen: dialog.isOpen
    });

    // Initialize the application
    useEffect(() => {
        // —— kick off only the minimal UI load path —— 
        initializeApp();

        // Pre-load drives immediately so sidebar is populated even before expanding
        loadDrives();

        // Listen for drive hot-plug events from backend
        const off = EventsOn("driveListUpdated", (list) => {
            setDrives(list);
        });

        return () => {
            if (off) off();
        };
    }, []);

    // Load drives using regular API
    const loadDrives = useCallback(async () => {
        if (isDriveDataLoaded) return drives;

        try {
            // Dynamically import the backend API only when needed
            const { GetDriveInfo } = await import('../wailsjs/go/backend/App');
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

            // Dynamically import the backend API only when required during startup
            const { GetHomeDirectory } = await import('../wailsjs/go/backend/App');
            const homeDir = await GetHomeDirectory();

            if (homeDir) {
                await navigateToPath(homeDir, 'init');
                setIsAppInitialized(true);
                setHomeDirectory(homeDir);
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
            <HeaderBar
                isInspectMode={isInspectMode}
                currentPath={currentPath}
                filteredDirectoriesCount={filteredDirectories.length}
                filteredFilesCount={filteredFiles.length}
                showHiddenFiles={showHiddenFiles}
                selectedCount={selectedFiles.size}
                isAppInitialized={isAppInitialized}
                navigationStats={navigationStats}
                onSettingsClick={handleSettingsOpen}
            />
            
            {/* Modern Error Notification System */}
            {error && (
                <div className="error-notification">
                    <div className="error-notification-content">
                        <div className="error-notification-header">
                            <div className="error-notification-text">
                                <div className="error-notification-title">System Notification</div>
                                <div className="error-notification-message">{error}</div>
                            </div>
                            <button 
                                className="error-notification-dismiss" 
                                onClick={dismissErrorNotification}
                                aria-label="Dismiss notification"
                            >✕</button>
                        </div>
                        {errorDetails && (
                            <div className="error-notification-details">
                                <div className="error-notification-details-content">
                                    {typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails, null, 2)}
                                </div>
                            </div>
                        )}
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
                    onDriveContextMenu={handleDriveContextMenu}
                />
                
                <div className="content-area">
                    {/* Toolbar */}
                    <ExplorerToolbar
                        currentPath={currentPath}
                        handleNavigateUp={handleNavigateUp}
                        handleRefresh={handleRefresh}
                        handleOpenInExplorer={handleOpenInExplorer}
                        showHiddenFiles={showHiddenFiles}
                        toggleShowHiddenFiles={toggleShowHiddenFiles}
                        sortBy={sortBy}
                        sortOrder={sortOrder}
                        handleSortChange={handleSortChange}
                    />
                    
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
                        {/* Use streaming virtualized file list for optimal performance with white background */}
                        <Suspense fallback={null}>
                            <StreamingVirtualizedFileList
                                files={allFiles}
                                selectedFiles={selectedFiles}
                                onFileSelect={handleFileSelect}
                                onFileOpen={handleFileOpen}
                                onContextMenu={handleContextMenu}
                                loading={loading}
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
                                ref={fileListRef}
                            />
                        </Suspense>
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
                    onMoveToTrash={handleMoveToTrash}
                />
                
                <EmptySpaceContextMenu
                    visible={emptySpaceContextMenu.visible}
                    x={emptySpaceContextMenu.x}
                    y={emptySpaceContextMenu.y}
                    onClose={closeEmptySpaceContextMenu}
                    onOpenPowerShell={handleOpenPowerShell}
                    onCreateFolder={handleCreateFolder}
                />

                <DriveContextMenu
                    visible={driveContextMenu.visible}
                    x={driveContextMenu.x}
                    y={driveContextMenu.y}
                    drive={driveContextMenu.drive}
                    onClose={closeDriveContextMenu}
                    onEject={handleDriveEject}
                    onOpenInExplorer={handleDriveOpenInExplorer}
                    onProperties={handleDriveProperties}
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

                <InspectMenu
                    visible={inspectMenu.visible}
                    x={inspectMenu.x}
                    y={inspectMenu.y}
                    element={inspectMenu.element}
                    onClose={closeInspectMenu}
                />

                <SettingsModal
                    isOpen={isSettingsOpen}
                    onClose={handleSettingsClose}
                    onSave={handleSettingsSave}
                />
            </Suspense>
            
            {/* Status bar */}
            <ExplorerStatusBar
                currentPath={currentPath}
                selectedCount={selectedFiles.size}
                clipboardFiles={clipboardFiles}
                clipboardOperation={clipboardOperation}
                dragState={dragState}
            />
        </div>
    );
}