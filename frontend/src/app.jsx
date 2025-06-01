import './style.css';
import './components/FastNavigation.css';
import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import { 
    GetHomeDirectory, 
    NavigateToPath, 
    NavigateUp, 
    GetDriveInfo,
    OpenInSystemExplorer,
    GetCacheStats
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
import { useFileOperations } from "./hooks/useFileOperations";
import { useSelection } from "./hooks/useSelection";
import { useClipboard } from "./hooks/useClipboard";
import { useOptimizedState } from "./hooks/useOptimizedState";

// Import our utilities
import { filterFiles } from "./utils/fileUtils";
import { debounce, throttle } from "./utils/debounce";

// Frontend cache for ultra-fast navigation
class NavigationCache {
    constructor(maxSize = 100, ttl = 10000) { // 10 second TTL, 100 entries max
        this.cache = new Map();
        this.accessOrder = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.hitCount = 0;
        this.missCount = 0;
    }

    get(path) {
        const entry = this.cache.get(path);
        if (!entry) {
            this.missCount++;
            return null;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(path);
            this.accessOrder.delete(path);
            this.missCount++;
            return null;
        }

        // Update access order for LRU
        this.accessOrder.set(path, Date.now());
        this.hitCount++;
        console.log(`⚡ Frontend cache HIT for: ${path} (${this.hitCount}/${this.hitCount + this.missCount} hit rate: ${(this.hitCount / (this.hitCount + this.missCount) * 100).toFixed(1)}%)`);
        return entry.data;
    }

    set(path, data) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestPath = [...this.accessOrder.entries()]
                .sort(([,a], [,b]) => a - b)[0][0];
            this.cache.delete(oldestPath);
            this.accessOrder.delete(oldestPath);
        }

        this.cache.set(path, {
            data,
            timestamp: Date.now()
        });
        this.accessOrder.set(path, Date.now());
        console.log(`💾 Frontend cached: ${path} (${this.cache.size}/${this.maxSize} entries)`);
    }

    clear() {
        this.cache.clear();
        this.accessOrder.clear();
        console.log('🧹 Frontend cache cleared');
    }

    getStats() {
        return {
            entries: this.cache.size,
            hitRate: this.hitCount / (this.hitCount + this.missCount) * 100,
            hits: this.hitCount,
            misses: this.missCount
        };
    }
}

// Create global cache instance
const navCache = new NavigationCache();

// Smart prefetching for likely navigation targets
class NavigationPrefetcher {
    constructor() {
        this.prefetchQueue = new Set();
        this.isRunning = false;
    }

    async prefetch(paths) {
        if (this.isRunning) return;
        
        for (const path of paths) {
            if (navCache.get(path)) continue; // Already cached
            
            this.prefetchQueue.add(path);
        }

        if (this.prefetchQueue.size > 0) {
            this.processPrefetchQueue();
        }
    }

    async processPrefetchQueue() {
        if (this.isRunning || this.prefetchQueue.size === 0) return;
        
        this.isRunning = true;
        const path = [...this.prefetchQueue][0];
        this.prefetchQueue.delete(path);

        try {
            console.log(`🔮 Prefetching: ${path}`);
            const response = await NavigateToPath(path);
            if (response && response.success) {
                navCache.set(path, response.data);
            }
        } catch (err) {
            console.log(`❌ Prefetch failed for ${path}:`, err);
        }

        this.isRunning = false;
        
        // Process next item with a small delay
        if (this.prefetchQueue.size > 0) {
            setTimeout(() => this.processPrefetchQueue(), 100);
        }
    }
}

const prefetcher = new NavigationPrefetcher();

// Main App component
export function App() {
    // Basic state
    const [currentPath, setCurrentPath] = useState('');
    const [directoryContents, setDirectoryContents] = useState(null);
    const [isActuallyLoading, setIsActuallyLoading] = useState(true); // True loading state
    const [showLoadingIndicator, setShowLoadingIndicator] = useState(false); // UI loading state
    const [error, setError] = useState('');
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    
    // Performance monitoring
    const [navigationStats, setNavigationStats] = useState({
        totalNavigations: 0,
        cacheHits: 0,
        averageTime: 0
    });
    
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

    // Performance tracking refs
    const navigationStartTime = useRef(null);
    const loadingTimeout = useRef(null);

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

    // Smart loading indicator management
    const showSmartLoadingIndicator = useCallback(() => {
        // Clear any existing timeout
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
        }
        
        // Only show loading after 150ms delay for perceived speed
        loadingTimeout.current = setTimeout(() => {
            if (isActuallyLoading) {
                setShowLoadingIndicator(true);
            }
        }, 150);
    }, [isActuallyLoading]);

    const hideLoadingIndicator = useCallback(() => {
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
            loadingTimeout.current = null;
        }
        setShowLoadingIndicator(false);
    }, []);

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

    // Ultra-fast navigation with intelligent caching and prefetching
    const navigateToPath = useCallback(async (path, source = 'user') => {
        console.log(`🧭 Navigation request: ${path} (${source})`);
        navigationStartTime.current = Date.now();
        
        try {
            setError('');
            
            // Check frontend cache first - INSTANT response
            const cached = navCache.get(path);
            if (cached) {
                setCurrentPath(cached.currentPath);
                setDirectoryContents(cached);
                hideLoadingIndicator();
                
                // Update stats
                setNavigationStats(prev => ({
                    totalNavigations: prev.totalNavigations + 1,
                    cacheHits: prev.cacheHits + 1,
                    averagedTime: (prev.averageTime * prev.totalNavigations + (Date.now() - navigationStartTime.current)) / (prev.totalNavigations + 1)
                }));

                // Prefetch sibling directories and common navigation targets
                if (source === 'user') {
                    prefetchSiblingDirectories(path);
                }
                
                return;
            }

            // Show loading indicator with smart delay
            setIsActuallyLoading(true);
            showSmartLoadingIndicator();
            
            // Backend call with optimized timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigation timeout')), 5000);
            });
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            if (response && response.success) {
                // Cache the result for future use
                navCache.set(path, response.data);
                
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                
                // Update performance stats
                const navigationTime = Date.now() - navigationStartTime.current;
                setNavigationStats(prev => ({
                    totalNavigations: prev.totalNavigations + 1,
                    cacheHits: prev.cacheHits,
                    averageTime: (prev.averageTime * prev.totalNavigations + navigationTime) / (prev.totalNavigations + 1)
                }));
                
                console.log(`✅ Navigation completed in ${navigationTime}ms: ${response.data.currentPath}`);
                
                // Prefetch likely navigation targets
                if (source === 'user') {
                    prefetchNavigationTargets(response.data);
                }
            } else {
                const errorMsg = response?.message || 'Unknown navigation error';
                setError(errorMsg);
                console.error('❌ Navigation failed:', errorMsg);
            }
        } catch (err) {
            console.error('❌ Navigation error:', err);
            setError('Failed to navigate: ' + err.message);
        } finally {
            setIsActuallyLoading(false);
            hideLoadingIndicator();
        }
    }, [showSmartLoadingIndicator, hideLoadingIndicator]);

    // Prefetch sibling directories for fast navigation
    const prefetchSiblingDirectories = useCallback(async (path) => {
        try {
            const parentPath = path.includes('\\') ? path.split('\\').slice(0, -1).join('\\') : path.split('/').slice(0, -1).join('/');
            if (parentPath && parentPath !== path) {
                const cached = navCache.get(parentPath);
                if (cached) {
                    // Prefetch up to 5 sibling directories
                    const siblings = cached.directories.slice(0, 5).map(dir => dir.path);
                    prefetcher.prefetch(siblings);
                }
            }
        } catch (err) {
            console.log('Prefetch siblings failed:', err);
        }
    }, []);

    // Prefetch common navigation targets
    const prefetchNavigationTargets = useCallback(async (directoryData) => {
        try {
            const prefetchTargets = [];
            
            // Prefetch parent directory
            if (directoryData.parentPath) {
                prefetchTargets.push(directoryData.parentPath);
            }
            
            // Prefetch first few subdirectories (most likely to be accessed)
            const subDirs = directoryData.directories.slice(0, 3).map(dir => dir.path);
            prefetchTargets.push(...subDirs);
            
            prefetcher.prefetch(prefetchTargets);
        } catch (err) {
            console.log('Prefetch targets failed:', err);
        }
    }, []);

    // Optimized navigate up
    const handleNavigateUp = useCallback(async () => {
        if (!currentPath) return;
        
        try {
            // For navigate up, we can often predict the parent path instantly
            const parentPath = currentPath.includes('\\') 
                ? currentPath.split('\\').slice(0, -1).join('\\')
                : currentPath.split('/').slice(0, -1).join('/');
                
            if (parentPath && parentPath !== currentPath) {
                await navigateToPath(parentPath, 'navigate-up');
            }
        } catch (err) {
            console.error('❌ Navigate up error:', err);
            setError('Failed to navigate up: ' + err.message);
        }
    }, [currentPath, navigateToPath]);

    // File operation handlers
    const handleFileOpen = useCallback((file) => {
        const result = fileOperations.handleFileOpen(file);
        if (result && result.type === 'navigate') {
            // Use direct navigation for file opens (immediate response)
            navigateToPath(result.path, 'file-open');
        }
    }, [fileOperations, navigateToPath]);

    const handleRefresh = useCallback(() => {
        if (currentPath) {
            // Clear cache for current path to force refresh
            navCache.cache.delete(currentPath);
            navigateToPath(currentPath, 'refresh');
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
            } else {
                // Clear cache for current directory to show changes
                navCache.cache.delete(currentPath);
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
                    fileOperations.handleRename(file.path, newName.trim()).then(() => {
                        // Clear cache to show renamed file
                        navCache.cache.delete(currentPath);
                    });
                }
            }
        );
    }, [contextMenu.files, closeContextMenu, showDialog, fileOperations, currentPath]);

    const handleContextHide = useCallback(() => {
        const filePaths = contextMenu.files.map(file => file.path);
        closeContextMenu();
        
        showDialog(
            'confirm',
            'HIDE FILES',
            `HIDE ${filePaths.length} ITEM${filePaths.length === 1 ? '' : 'S'}?\n\nHidden files will not be visible unless "Show Hidden Files" is enabled.`,
            '',
            () => {
                fileOperations.handleHideFiles(filePaths).then(() => {
                    // Clear cache to hide files
                    navCache.cache.delete(currentPath);
                });
            }
        );
    }, [contextMenu.files, closeContextMenu, showDialog, fileOperations, currentPath]);

    // Initialize app
    useEffect(() => {
        console.log('🚀 Blueprint File Explorer initializing...');
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            setIsActuallyLoading(true);
            showSmartLoadingIndicator();
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
        } finally {
            setIsActuallyLoading(false);
            hideLoadingIndicator();
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

    // Performance monitoring
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const [frontendStats, backendStats] = await Promise.all([
                    Promise.resolve(navCache.getStats()),
                    GetCacheStats()
                ]);
                console.log('📊 Performance Stats:', {
                    frontend: frontendStats,
                    backend: backendStats,
                    navigation: navigationStats
                });
            } catch (err) {
                console.log('Stats collection failed:', err);
            }
        }, 30000); // Every 30 seconds

        return () => clearInterval(interval);
    }, [navigationStats]);

    // Optimized keyboard shortcuts
    const keyboardHandler = useMemo(
        () => throttle((event) => {
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
            } else if (event.ctrlKey && event.shiftKey && event.key === 'C') {
                // Clear both frontend and backend cache
                event.preventDefault();
                navCache.clear();
                console.log('🧹 Manual cache clear requested');
            }
        }, 50), // Faster response for keyboard
        [currentPath, selectedFiles, allFiles, handleRefresh, handleNavigateUp, handleFileOpen, selectAll, handleCopySelected, handleCutSelected, handlePaste, isPasteAvailable, handleArrowNavigation, clearSelection, closeContextMenu, closeEmptySpaceContextMenu]
    );

    // Keyboard shortcuts
    useEffect(() => {
        window.addEventListener('keydown', keyboardHandler);
        return () => window.removeEventListener('keydown', keyboardHandler);
    }, [keyboardHandler]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (loadingTimeout.current) {
                clearTimeout(loadingTimeout.current);
            }
        };
    }, []);

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
                                    containerHeight={500}
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
                onPermanentDelete={() => {
                    const filePaths = contextMenu.files.map(file => file.path);
                    closeContextMenu();
                    showDialog('delete', '⚠️ PERMANENT DELETE WARNING', `Permanently delete ${filePaths.length} items? This cannot be undone!`, '', 
                        () => {
                            fileOperations.handlePermanentDelete(filePaths).then(() => {
                                // Clear cache to reflect changes
                                navCache.cache.delete(currentPath);
                            });
                        });
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
                    File Explorer • Ctrl+Shift+C: Clear Cache
                </span>
            </div>
        </div>
    );
} 