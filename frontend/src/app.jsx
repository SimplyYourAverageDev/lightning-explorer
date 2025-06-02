import './style.css';
import './components/FastNavigation.css';
import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import { 
    GetHomeDirectory, 
    GetDriveInfo,
    OpenInSystemExplorer
} from "../wailsjs/go/backend/App";

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

// Import our custom components
import {
    Breadcrumb,
    Sidebar,
    FileItem,
    ContextMenu,
    EmptySpaceContextMenu,
    RetroDialog,
    VirtualizedFileList,
    InlineFolderEditor
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
    useFolderCreation
} from "./hooks";

// Import our utilities
import { filterFiles } from "./utils/fileUtils";



// Main App component
export function App() {
    // Basic UI state
    const [error, setError] = useState('');
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);

    // Custom hooks
    const { navigationStats, setNavigationStats } = usePerformanceMonitoring();
    
    const {
        currentPath,
        directoryContents,
        showLoadingIndicator,
        navigateToPath,
        handleNavigateUp,
        handleRefresh,
        clearCache
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

    // Computed values
    const filteredDirectories = useMemo(() => 
        directoryContents ? filterFiles(directoryContents.directories, showHiddenFiles) : [], 
        [directoryContents, showHiddenFiles]
    );
    
    const filteredFiles = useMemo(() => 
        directoryContents ? filterFiles(directoryContents.files, showHiddenFiles) : [], 
        [directoryContents, showHiddenFiles]
    );
    
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
        startFolderCreation
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

    // Initialize app
    useEffect(() => {
        log('🚀 Blueprint File Explorer initializing...');
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            setError('');
            
            const homeDir = await GetHomeDirectory();
            if (homeDir) {
                await navigateToPath(homeDir, 'init');
            } else {
                setError('Unable to determine starting directory');
            }
        } catch (err) {
            error('❌ Error initializing app:', err);
            setError('Failed to initialize file explorer: ' + err.message);
        }
    };

    // Load drives
    useEffect(() => {
        GetDriveInfo().then(driveList => {
            setDrives(driveList);
        });
    }, []);

    // Clear selection when path changes
    useEffect(() => {
        clearSelection();
        closeContextMenu();
    }, [currentPath, clearSelection, closeContextMenu]);

    return (
        <div 
            className={`file-explorer blueprint-bg ${dragState.isDragging ? 'dragging-active' : ''}`}
            onSelectStart={(e) => e.preventDefault()}
            onDragEnd={handleDragEnd}
            onContextMenu={(e) => {
                // Global fallback to prevent browser context menu
                if (!e.target.closest('.file-item') && !e.target.closest('.context-menu')) {
                    e.preventDefault();
                }
            }}
        >
            {/* Header */}
            <header className="app-header">
                <div className="app-title">Files</div>
                <div style={HEADER_STATS_STYLE}>
                    {showLoadingIndicator && <div className="loading-spinner"></div>}
                    <span className="text-technical">
                        {directoryContents ? 
                            `${filteredDirectories.length} dirs • ${filteredFiles.length} files${!showHiddenFiles ? ' (hidden filtered)' : ''}${selectedFiles.size > 0 ? ` • ${selectedFiles.size} selected` : ''}` : 
                            'Ready'
                        }
                    </span>
                    {/* Performance indicator */}
                    {navigationStats.totalNavigations > 0 && (
                        <span className="text-technical" style={PERFORMANCE_INDICATOR_STYLE}>
                            {Math.round(navigationStats.lastNavigationTime)}ms last navigation
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
                    
                    {/* File list - Use virtual scrolling for better performance */}
                    <div 
                        className="file-list-container"
                        onClick={(e) => {
                            // Check if clicking on empty space (not on a file item)
                            if (e.target === e.currentTarget || e.target.classList.contains('file-list') || e.target.classList.contains('file-list-container')) {
                                clearSelection();
                                closeContextMenu();
                                closeEmptySpaceContextMenu();
                            }
                        }}
                        onContextMenu={(e) => {
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
                            allFiles.length > 20 ? (
                                // Use virtual scrolling for large directories
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
                                />
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
                                <div className="text-technical">Ready</div>
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
            
            {/* Status bar */}
            <div className="status-bar">
                <span>
                    Path: {currentPath || 'Not selected'} 
                    {selectedFiles.size > 0 && ` • ${selectedFiles.size} item${selectedFiles.size === 1 ? '' : 's'} selected`}
                    {clipboardFiles.length > 0 && ` • ${clipboardFiles.length} item${clipboardFiles.length === 1 ? '' : 's'} ${clipboardOperation === 'cut' ? 'cut' : 'copied'}`}
                    {dragState.isDragging && ` • Dragging ${dragState.draggedFiles.length} item${dragState.draggedFiles.length === 1 ? '' : 's'} (${dragState.dragOperation === 'copy' ? 'Hold Ctrl to copy' : 'Release Ctrl to move'})`}
                </span>
                <span style={STATUS_BAR_RIGHT_STYLE}>
                    File Explorer • Drag to folders to move/copy
                </span>
            </div>
        </div>
    );
} 