import './style.css';
import { useState, useEffect, useCallback, useMemo } from "preact/hooks";
import { 
    GetHomeDirectory, 
    NavigateToPath, 
    NavigateUp, 
    GetDriveInfo,
    OpenInSystemExplorer
} from "../wailsjs/go/main/App";

// Import our custom components
import {
    Breadcrumb,
    Sidebar,
    FileItem,
    ContextMenu,
    EmptySpaceContextMenu,
    RetroDialog
} from "./components";

// Import our custom hooks
import { useFileOperations } from "./hooks/useFileOperations";
import { useSelection } from "./hooks/useSelection";
import { useClipboard } from "./hooks/useClipboard";

// Import our utilities
import { filterFiles } from "./utils/fileUtils";

// Main App component
export function App() {
    // Basic state
    const [currentPath, setCurrentPath] = useState('');
    const [directoryContents, setDirectoryContents] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    
    // Context menu states
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, files: [] });
    const [emptySpaceContextMenu, setEmptySpaceContextMenu] = useState({ visible: false, x: 0, y: 0 });
    
    // Drag and drop states
    const [dragOverFolder, setDragOverFolder] = useState(null);
    const [isDragging, setIsDragging] = useState(false);
    
    // Dialog state
    const [dialog, setDialog] = useState({
        isOpen: false,
        type: 'alert',
        title: '',
        message: '',
        defaultValue: '',
        onConfirm: () => {},
        onCancel: () => {}
    });

    // Custom hooks
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

    // Dialog helper functions
    const showDialog = useCallback((type, title, message, defaultValue = '', onConfirm = () => {}, onCancel = () => {}) => {
        setDialog({
            isOpen: true,
            type,
            title,
            message,
            defaultValue,
            onConfirm: (value) => {
                setDialog(prev => ({ ...prev, isOpen: false }));
                onConfirm(value);
            },
            onCancel: () => {
                setDialog(prev => ({ ...prev, isOpen: false }));
                onCancel();
            }
        });
    }, []);

    const closeDialog = useCallback(() => {
        setDialog(prev => ({ ...prev, isOpen: false }));
    }, []);

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

    // Navigation functions
    const navigateToPath = useCallback(async (path) => {
        try {
            setError('');
            console.log('🧭 Navigating to:', path);
            
            const loadingTimeout = setTimeout(() => {
                setIsLoading(true);
            }, 150);
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigation timeout')), 10000);
            });
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            clearTimeout(loadingTimeout);
            
            if (response && response.success) {
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                console.log('✅ Successfully navigated to:', response.data.currentPath);
            } else {
                const errorMsg = response?.message || 'Unknown navigation error';
                setError(errorMsg);
            }
        } catch (err) {
            console.error('❌ Navigation error:', err);
            setError('Failed to navigate: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    const handleNavigateUp = useCallback(async () => {
        if (!currentPath) return;
        
        try {
            setError('');
            console.log('⬆️ Navigating up from:', currentPath);
            
            const loadingTimeout = setTimeout(() => {
                setIsLoading(true);
            }, 150);
            
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigate up timeout')), 10000);
            });
            
            const navigationPromise = NavigateUp(currentPath);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            clearTimeout(loadingTimeout);
            
            if (response && response.success) {
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                console.log('✅ Successfully navigated up to:', response.data.currentPath);
            } else {
                const errorMsg = response?.message || 'Unknown navigate up error';
                setError(errorMsg);
            }
        } catch (err) {
            console.error('❌ Navigate up error:', err);
            setError('Failed to navigate up: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, [currentPath]);

    // File operation handlers
    const handleFileOpen = useCallback((file) => {
        const result = fileOperations.handleFileOpen(file);
        if (result && result.type === 'navigate') {
            navigateToPath(result.path);
        }
    }, [fileOperations, navigateToPath]);

    const handleRefresh = useCallback(() => {
        if (currentPath) {
            navigateToPath(currentPath);
        }
    }, [currentPath, navigateToPath]);

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
            }
        } catch (err) {
            console.error('❌ Error during paste operation:', err);
            setError('Failed to paste files: ' + err.message);
        }
    }, [isPasteAvailable, currentPath, clipboardFiles, clipboardOperation, fileOperations, clearClipboard]);

    // Context menu handlers
    const handleContextMenu = useCallback((event, file) => {
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        
        const contextFiles = selectedFiles.size > 0 && selectedFileObjects.some(f => f.path === file.path) 
            ? selectedFileObjects 
            : [file];
        
        setContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            files: contextFiles
        });
    }, [selectedFiles, allFiles]);

    const closeContextMenu = useCallback(() => {
        setContextMenu({ visible: false, x: 0, y: 0, files: [] });
    }, []);

    const handleEmptySpaceContextMenu = useCallback((event) => {
        event.preventDefault();
        setEmptySpaceContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY
        });
    }, []);

    const closeEmptySpaceContextMenu = useCallback(() => {
        setEmptySpaceContextMenu({ visible: false, x: 0, y: 0 });
    }, []);

    // Context menu actions
    const handleContextCopy = useCallback(() => {
        const filePaths = contextMenu.files.map(file => file.path);
        handleCopy(filePaths);
        closeContextMenu();
    }, [contextMenu.files, handleCopy, closeContextMenu]);

    const handleContextCut = useCallback(() => {
        const filePaths = contextMenu.files.map(file => file.path);
        handleCut(filePaths);
        closeContextMenu();
    }, [contextMenu.files, handleCut, closeContextMenu]);

    const handleContextRename = useCallback(() => {
        if (contextMenu.files.length !== 1) {
            closeContextMenu();
            return;
        }
        
        const file = contextMenu.files[0];
        closeContextMenu();
        
        showDialog(
            'prompt',
            'RENAME FILE',
            `RENAME "${file.name}" TO:`,
            file.name,
            (newName) => {
                if (newName && newName !== file.name && newName.trim() !== '') {
                    fileOperations.handleRename(file.path, newName.trim());
                }
            }
        );
    }, [contextMenu.files, closeContextMenu, showDialog, fileOperations]);

    // Initialize app
    useEffect(() => {
        console.log('🚀 Blueprint File Explorer initializing...');
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            setIsLoading(true);
            setError('');
            
            const homeDir = await GetHomeDirectory();
            if (homeDir) {
                await navigateToPath(homeDir);
            } else {
                setError('Unable to determine starting directory');
            }
        } catch (err) {
            console.error('❌ Error initializing app:', err);
            setError('Failed to initialize file explorer: ' + err.message);
        } finally {
            setIsLoading(false);
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
        setContextMenu({ visible: false, x: 0, y: 0, files: [] });
    }, [currentPath, clearSelection]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'F5') {
                event.preventDefault();
                handleRefresh();
            } else if ((event.key === 'Backspace' && !event.target.matches('input, textarea')) || 
                     (event.altKey && event.key === 'ArrowLeft')) {
                event.preventDefault();
                handleNavigateUp();
            } else if (event.key === 'Enter' && selectedFiles.size > 0) {
                event.preventDefault();
                const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
                selectedFileObjects.forEach(file => handleFileOpen(file));
            } else if (event.ctrlKey && event.key === 'a' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                selectAll(allFiles.length);
            } else if (event.ctrlKey && event.key === 'c' && selectedFiles.size > 0) {
                event.preventDefault();
                handleCopySelected();
            } else if (event.ctrlKey && event.key === 'x' && selectedFiles.size > 0) {
                event.preventDefault();
                handleCutSelected();
            } else if (event.ctrlKey && event.key === 'v' && isPasteAvailable()) {
                event.preventDefault();
                handlePaste();
            } else if (event.key === 'ArrowUp' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                handleArrowNavigation('up', allFiles);
            } else if (event.key === 'ArrowDown' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                handleArrowNavigation('down', allFiles);
            } else if (event.key === 'Escape') {
                clearSelection();
                closeContextMenu();
                closeEmptySpaceContextMenu();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPath, selectedFiles, allFiles, handleRefresh, handleNavigateUp, handleFileOpen, selectAll, handleCopySelected, handleCutSelected, handlePaste, isPasteAvailable, handleArrowNavigation, clearSelection, closeContextMenu, closeEmptySpaceContextMenu]);

    return (
        <div className="file-explorer blueprint-bg">
            {/* Header */}
            <header className="app-header">
                <div className="app-title">Files</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isLoading && <div className="loading-spinner"></div>}
                    <span className="text-technical">
                        {directoryContents ? 
                            `${filteredDirectories.length} dirs • ${filteredFiles.length} files${!showHiddenFiles ? ' (hidden filtered)' : ''}${selectedFiles.size > 0 ? ` • ${selectedFiles.size} selected` : ''}` : 
                            'Ready'
                        }
                    </span>
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
                    onNavigate={navigateToPath}
                    drives={drives}
                />
                
                <div className="content-area">
                    {/* Toolbar */}
                    <div className="toolbar">
                        <button className="toolbar-btn" onClick={handleNavigateUp} disabled={!currentPath || isLoading}>
                            ⬆️ Up
                        </button>
                        <button className="toolbar-btn" onClick={handleRefresh} disabled={!currentPath || isLoading}>
                            🔄 Refresh
                        </button>
                        <button className="toolbar-btn" onClick={handleOpenInExplorer} disabled={!currentPath || isLoading}>
                            🖥️ Open in Explorer
                        </button>
                        <button 
                            className={`toolbar-btn ${showHiddenFiles ? 'active' : ''}`}
                            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
                            disabled={isLoading}
                        >
                            {showHiddenFiles ? '👁️' : '🙈'} Hidden
                        </button>
                    </div>
                    
                    {/* Breadcrumb navigation */}
                    {currentPath && (
                        <Breadcrumb 
                            currentPath={currentPath}
                            onNavigate={navigateToPath}
                        />
                    )}
                    
                    {/* File list */}
                    <div 
                        className="file-list custom-scrollbar"
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
                        {isLoading ? (
                            <div className="loading-overlay">
                                <div style={{ textAlign: 'center' }}>
                                    <div className="loading-spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }}></div>
                                    <div className="text-technical">Loading directory...</div>
                                </div>
                            </div>
                        ) : directoryContents ? (
                            <>
                                {allFiles.map((file, index) => (
                                    <FileItem
                                        key={file.path}
                                        file={file}
                                        fileIndex={index}
                                        onSelect={handleFileSelect}
                                        onOpen={handleFileOpen}
                                        onContextMenu={handleContextMenu}
                                        isLoading={isLoading}
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
                            </>
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
                onRecycleBinDelete={() => {
                    const filePaths = contextMenu.files.map(file => file.path);
                    closeContextMenu();
                    showDialog('delete', 'MOVE TO RECYCLE BIN', `Move ${filePaths.length} items to recycle bin?`, '', 
                        () => fileOperations.handleRecycleBinDelete(filePaths));
                }}
                onPermanentDelete={() => {
                    const filePaths = contextMenu.files.map(file => file.path);
                    closeContextMenu();
                    showDialog('delete', '⚠️ PERMANENT DELETE WARNING', `Permanently delete ${filePaths.length} items? This cannot be undone!`, '', 
                        () => fileOperations.handlePermanentDelete(filePaths));
                }}
            />
            
            <EmptySpaceContextMenu
                visible={emptySpaceContextMenu.visible}
                x={emptySpaceContextMenu.x}
                y={emptySpaceContextMenu.y}
                onClose={closeEmptySpaceContextMenu}
                onOpenPowerShell={() => {
                    closeEmptySpaceContextMenu();
                    fileOperations.handleOpenPowerShell();
                }}
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
                    {isDragging && ' • Dragging files (Hold Ctrl to copy)'}
                </span>
                <span style={{ marginLeft: 'auto' }}>
                    File Explorer
                </span>
            </div>
        </div>
    );
} 