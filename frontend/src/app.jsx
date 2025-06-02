import './style.css';
import './components/FastNavigation.css';
import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import { 
    GetHomeDirectory, 
    GetDriveInfo,
    OpenInSystemExplorer
} from "../wailsjs/go/backend/App";

// Import our custom components
import {
    Breadcrumb,
    Sidebar,
    FileItem,
    ContextMenu,
    EmptySpaceContextMenu,
    RetroDialog,
    VirtualizedFileList
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
    useKeyboardShortcuts
} from "./hooks";

// Import our utilities
import { filterFiles } from "./utils/fileUtils";

// Import navigation service
import { navCache } from "./services/NavigationService";

// Main App component
export function App() {
    // Basic UI state
    const [error, setError] = useState('');
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    const [dragOverFolder, setDragOverFolder] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

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
        handleOpenPowerShell
    } = useContextMenus(
        selectedFiles, 
        allFiles, 
        handleCopy, 
        handleCut, 
        showDialog, 
        fileOperations, 
        currentPath, 
        navCache
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
            console.log(`📥 Pasting ${clipboardFiles.length} items to:`, currentPath);
            
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
                // Clear cache for current directory to show changes
                navCache.cache.delete(currentPath);
                // Refresh the directory to show the pasted files immediately
                handleRefresh();
            }
        } catch (err) {
            console.error('❌ Error during paste operation:', err);
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
        closeEmptySpaceContextMenu,
        clearCache
    });

    // Initialize app
    useEffect(() => {
        console.log('🚀 Blueprint File Explorer initializing...');
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
            console.error('❌ Error initializing app:', err);
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
        <div className="file-explorer blueprint-bg">
            {/* Header */}
            <header className="app-header">
                <div className="app-title">Files</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {showLoadingIndicator && <div className="loading-spinner"></div>}
                    <span className="text-technical">
                        {directoryContents ? 
                            `${filteredDirectories.length} dirs • ${filteredFiles.length} files${!showHiddenFiles ? ' (hidden filtered)' : ''}${selectedFiles.size > 0 ? ` • ${selectedFiles.size} selected` : ''}` : 
                            'Ready'
                        }
                    </span>
                    {/* Performance indicator */}
                    {navigationStats.totalNavigations > 0 && (
                        <span className="text-technical" style={{ fontSize: '10px', opacity: 0.6 }}>
                            Cache: {Math.round(navigationStats.cacheHits / navigationStats.totalNavigations * 100)}% • {Math.round(navigationStats.averageTime)}ms avg
                        </span>
                    )}
                    {/* Show current path for instant feedback */}
                    {currentPath && (
                        <span className="text-technical" style={{ fontSize: '11px', opacity: 0.7, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {currentPath}
                        </span>
                    )}
                </div>
            </header>
            
            {/* Error display */}
            {error && (
                <div className="error-message">
                    <strong>⚠️ Error:</strong> {error}
                    <button onClick={() => setError('')} style={{ marginLeft: '12px', background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}>
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
                            if (e.target === e.currentTarget) {
                                clearSelection();
                                closeContextMenu();
                                closeEmptySpaceContextMenu();
                            }
                        }}
                        onContextMenu={(e) => {
                            if (e.target === e.currentTarget) {
                                e.preventDefault();
                                closeContextMenu();
                                closeEmptySpaceContextMenu();
                                handleEmptySpaceContextMenu(e);
                            }
                        }}
                    >
                        {showLoadingIndicator ? (
                            <div className="loading-overlay">
                                <div style={{ textAlign: 'center' }}>
                                    <div className="loading-spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }}></div>
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
                                />
                            ) : (
                                // Use normal rendering for small directories
                                <div className="file-list custom-scrollbar">
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
                                            isDragOver={dragOverFolder === file.path}
                                        />
                                    ))}
                                    
                                    {allFiles.length === 0 && (
                                        <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--blueprint-text-muted)' }}>
                                            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                                            <div className="text-technical">Directory is empty</div>
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <div style={{ textAlign: 'center', padding: '64px 32px', color: 'var(--blueprint-text-muted)' }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
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
                    {selectedFiles.sizwaie > 0 && ` • ${selectedFiles.size} item${selectedFiles.size === 1 ? '' : 's'} selected`}
                    {clipboardFiles.length > 0 && ` • ${clipboardFiles.length} item${clipboardFiles.length === 1 ? '' : 's'} ${clipboardOperation === 'cut' ? 'cut' : 'copied'}`}
                    {isDragging && ' • Dragging files (Hold Ctrl to copy)'}
                </span>
                <span style={{ marginLeft: 'auto' }}>
                    File Explorer • Ctrl+Shift+C: Clear Cache
                </span>
            </div>
        </div>
    );
} 