import './components/FastNavigation.css';
import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import { Suspense } from "preact/compat";
import { 
    OpenInSystemExplorer
} from "../wailsjs/go/backend/App";

// Import MessagePack utilities - dynamically loaded for better startup
import { EnhancedAPI, SerializationMode, serializationUtils } from "./utils/serialization";

// Import optimized utilities
import { log, warn, error } from "./utils/logger";
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
    useInspectMode
} from "./hooks";

// Lazy load heavy utilities for better startup performance
let fileUtilsPromise = null;
const getFileUtils = () => {
    if (!fileUtilsPromise) {
        fileUtilsPromise = import("./utils/fileUtils");
    }
    return fileUtilsPromise;
};

// Main App component
export function App() {
    // Basic UI state
    const [error, setError] = useState('');
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    
    // Startup state to control when heavy operations run
    const [isAppInitialized, setIsAppInitialized] = useState(false);
    const [isDriveDataLoaded, setIsDriveDataLoaded] = useState(false);
    
    // MessagePack integration state - FORCE MessagePack Base64 mode
    const [serializationMode, setSerializationModeState] = useState(SerializationMode.MSGPACK_BASE64);
    const [enhancedAPI, setEnhancedAPI] = useState(null);
    const [benchmarkResults, setBenchmarkResults] = useState(null);

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

    // Computed values - use lazy loaded file utils
    const [fileUtilsModule, setFileUtilsModule] = useState(null);
    
    const filteredDirectories = useMemo(() => {
        if (!directoryContents || !fileUtilsModule) return [];
        return fileUtilsModule.filterFiles(directoryContents.directories, showHiddenFiles);
    }, [directoryContents, showHiddenFiles, fileUtilsModule]);
    
    const filteredFiles = useMemo(() => {
        if (!directoryContents || !fileUtilsModule) return [];
        return fileUtilsModule.filterFiles(directoryContents.files, showHiddenFiles);
    }, [directoryContents, showHiddenFiles, fileUtilsModule]);
    
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

    // OPTIMIZATION 1: Defer heavy work until after first paint
    useEffect(() => {
        log('🚀 Lightning Explorer mounting - UI First!');
        
        // Allow UI to render first with setTimeout(0)
        setTimeout(() => {
            initializeApp();
        }, 0);
        
        // Off-peak initialization for enhanced API - use requestIdleCallback if available
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
                initializeEnhancedAPI();
            });
        } else {
            setTimeout(initializeEnhancedAPI, 200);
        }
        
        // Load file utils asynchronously 
        if (typeof requestIdleCallback !== 'undefined') {
            requestIdleCallback(() => {
                getFileUtils().then(module => {
                    setFileUtilsModule(module);
                });
            });
        } else {
            setTimeout(() => {
                getFileUtils().then(module => {
                    setFileUtilsModule(module);
                });
            }, 100);
        }
    }, []);

    // Load drives using MessagePack optimized API only
    const loadDrives = useCallback(async () => {
        if (isDriveDataLoaded) return drives;
        
        try {
            // Always use MessagePack optimized API - no fallback
            if (!enhancedAPI) {
                warn('⚠️ Enhanced API not initialized, cannot load drives');
                return [];
            }
            
            const driveList = await enhancedAPI.getDriveInfo();
            setDrives(driveList);
            setIsDriveDataLoaded(true);
            return driveList;
        } catch (err) {
            error('❌ Failed to load drive information with MessagePack API:', err);
            return [];
        }
    }, [isDriveDataLoaded, drives, enhancedAPI]);

    const initializeApp = async () => {
        try {
            setError('');
            
            // Use MessagePack optimized API for home directory
            if (enhancedAPI) {
                const homeDirResponse = await enhancedAPI.getHomeDirectory();
                if (homeDirResponse && homeDirResponse.success && homeDirResponse.home_directory) {
                    await navigateToPath(homeDirResponse.home_directory, 'init');
                    setIsAppInitialized(true);
                } else {
                    setError('Unable to determine starting directory');
                }
            } else {
                // Fallback to regular API if enhanced API not available
                const { GetHomeDirectory } = await import("../wailsjs/go/backend/App");
                const homeDir = await GetHomeDirectory();
                if (homeDir) {
                    await navigateToPath(homeDir, 'init');
                    setIsAppInitialized(true);
                } else {
                    setError('Unable to determine starting directory');
                }
            }
        } catch (err) {
            error('❌ Error initializing app:', err);
            setError('Failed to initialize file explorer: ' + err.message);
        }
    };

    // Serialization mode handlers - MessagePack forced, no user switching
    const initializeEnhancedAPI = async () => {
        try {
            // Import the Wails API
            const wailsAPI = await import("../wailsjs/go/backend/App");
            
            // Create enhanced API instance
            const enhancedAPIInstance = new EnhancedAPI(wailsAPI, serializationUtils);
            setEnhancedAPI(enhancedAPIInstance);
            
            // Force MessagePack Base64 mode on backend
            await enhancedAPIInstance.setSerializationMode(SerializationMode.MSGPACK_BASE64);
            serializationUtils.setMode(SerializationMode.MSGPACK_BASE64);
            
            log(`🔧 Enhanced API initialized with MessagePack Base64 mode (forced)`);
        } catch (err) {
            warn('⚠️ Enhanced API initialization failed, falling back to standard API:', err);
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
                        {directoryContents && fileUtilsModule ? 
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
                        ) : directoryContents && fileUtilsModule ? (
                            allFiles.length > 20 ? (
                                // Use virtual scrolling for large directories with Suspense wrapper
                                <Suspense fallback={
                                    <div className="loading-overlay">
                                        <div style={LOADING_OVERLAY_STYLE}>
                                            <div className="loading-spinner" style={LOADING_SPINNER_LARGE_STYLE}></div>
                                            <div className="text-technical">Loading file list...</div>
                                        </div>
                                    </div>
                                }>
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
                                </Suspense>
                            ) : (
                                // Use normal rendering for small directories
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
                                    
                                    {allFiles.map((file, index) => (
                                        <FileItem
                                            key={file.path}
                                            file={file}
                                            fileIndex={index}
                                            onSelect={handleFileSelect}
                                            onOpen={handleFileOpen}
                                            onContextMenu={handleContextMenu}
                                            isLoading={false} // Never show loading in file items
                                            isSelected={selectedFiles.has(index)}
                                            isCut={clipboardOperation === 'cut' && clipboardFiles.includes(file.path)}
                                            isDragOver={dragState.dragOverFolder === file.path}
                                            onDragStart={handleDragStart}
                                            onDragOver={handleDragOver}
                                            onDragEnter={handleDragEnter}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            isInspectMode={isInspectMode}
                                        />
                                    ))}
                                    
                                    {allFiles.length === 0 && !creatingFolder && (
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
            
            <InspectMenu
                visible={inspectMenu.visible}
                x={inspectMenu.x}
                y={inspectMenu.y}
                element={inspectMenu.element}
                onClose={closeInspectMenu}
            />
            
            {/* Performance Dashboard */}
            <Suspense fallback={null}>
                <PerformanceDashboard
                    benchmarkResults={benchmarkResults}
                    navigationStats={navigationStats}
                    serializationMode={serializationMode}
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