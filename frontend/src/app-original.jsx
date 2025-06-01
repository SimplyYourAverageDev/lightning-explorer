import './style.css';
import { useState, useEffect, useCallback, useRef, useMemo } from "preact/hooks";
import { memo } from "preact/compat";
import { 
    GetHomeDirectory, 
    ListDirectory, 
    NavigateToPath, 
    NavigateUp, 
    GetSystemRoots,
    GetDriveInfo,
    OpenInSystemExplorer,
    OpenFile,
    CopyFiles,
    MoveFiles,
    DeleteFiles,
    MoveFilesToRecycleBin,
    RenameFile,
    OpenPowerShellHere
} from "../wailsjs/go/main/App";

// File type detection and icon mapping
const getFileType = (fileName, isDir) => {
    if (isDir) return 'folder';
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'cpp', 'c', 'h', 'java', 'cs', 'php', 'rb', 'swift', 'kt', 'dart', 'vue', 'svelte'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'bmp', 'webp', 'ico'];
    const documentExtensions = ['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt'];
    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
    const executableExtensions = ['exe', 'msi', 'app', 'deb', 'rpm', 'dmg'];
    
    if (codeExtensions.includes(ext)) return 'code';
    if (imageExtensions.includes(ext)) return 'image';
    if (documentExtensions.includes(ext)) return 'document';
    if (archiveExtensions.includes(ext)) return 'archive';
    if (executableExtensions.includes(ext)) return 'executable';
    
    return 'file';
};

const getFileIcon = (fileName, isDir) => {
    const type = getFileType(fileName, isDir);
    
    const icons = {
        folder: '📁',
        file: '📄',
        code: '💾',
        image: '🖼️',
        document: '📋',
        archive: '📦',
        executable: '⚡'
    };
    
    return icons[type] || '📄';
};

const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatFileSize = (size) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let unitIndex = 0;
    let fileSize = size;
    
    while (fileSize >= 1024 && unitIndex < units.length - 1) {
        fileSize /= 1024;
        unitIndex++;
    }
    
    return fileSize < 10 && unitIndex > 0 
        ? `${fileSize.toFixed(1)} ${units[unitIndex]}`
        : `${Math.round(fileSize)} ${units[unitIndex]}`;
};

// Memoized Breadcrumb component
const Breadcrumb = memo(({ currentPath, onNavigate }) => {
    const segments = useMemo(() => 
        currentPath.split(/[\/\\]/).filter(Boolean), 
        [currentPath]
    );
    
    const handleSegmentClick = useCallback((index) => {
        if (index === -1) {
            // Root click - navigate to first drive on Windows or root on Unix
            if (segments.length > 0 && segments[0].includes(':')) {
                // Windows - navigate to drive root
                onNavigate(segments[0] + '\\');
            } else {
                // Unix - navigate to root
                onNavigate('/');
            }
        } else {
            // Build path from segments
            const pathSegments = segments.slice(0, index + 1);
            let newPath;
            
            if (pathSegments[0].includes(':')) {
                // Windows path
                newPath = pathSegments.join('\\');
                if (!newPath.endsWith('\\') && index === 0) {
                    newPath += '\\';
                }
            } else {
                // Unix path
                newPath = '/' + pathSegments.join('/');
            }
            
            onNavigate(newPath);
        }
    }, [segments, onNavigate]);
    
    return (
        <div className="nav-breadcrumb custom-scrollbar">
            <span 
                className="nav-segment" 
                onClick={() => handleSegmentClick(-1)}
            >
                ROOT
            </span>
            {segments.map((segment, index) => (
                <span key={index}>
                    <span className="separator">/</span>
                    <span 
                        className={`nav-segment ${index === segments.length - 1 ? 'current' : ''}`}
                        onClick={() => handleSegmentClick(index)}
                    >
                        {segment}
                    </span>
                </span>
            ))}
        </div>
    );
});

// Memoized Sidebar component
const Sidebar = memo(({ currentPath, onNavigate, drives = [] }) => {
    const [homeDir, setHomeDir] = useState('');
    
    useEffect(() => {
        GetHomeDirectory().then(setHomeDir);
    }, []);
    
    // Use proper path separators for the current OS
    const pathSep = homeDir.includes('\\') ? '\\' : '/';
    
    const quickAccess = useMemo(() => [
        { name: 'Home', path: homeDir, icon: '🏠' },
        { name: 'Desktop', path: homeDir + pathSep + 'Desktop', icon: '🖥️' },
        { name: 'Documents', path: homeDir + pathSep + 'Documents', icon: '📁' },
        { name: 'Downloads', path: homeDir + pathSep + 'Downloads', icon: '⬇️' },
    ].filter(item => item.path), [homeDir, pathSep]);
    
    const handleQuickAccessClick = useCallback((path) => {
        onNavigate(path);
    }, [onNavigate]);
    
    const handleDriveClick = useCallback((path) => {
        onNavigate(path);
    }, [onNavigate]);
    
    return (
        <div className="sidebar">
            <div className="sidebar-section">
                <div className="sidebar-title">Quick Access</div>
                {quickAccess.map((item) => (
                    <div 
                        key={item.path}
                        className={`sidebar-item ${currentPath === item.path ? 'active' : ''}`}
                        onClick={() => handleQuickAccessClick(item.path)}
                    >
                        <span className="sidebar-icon">{item.icon}</span>
                        {item.name}
                    </div>
                ))}
            </div>
            
            {drives.length > 0 && (
                <div className="sidebar-section">
                    <div className="sidebar-title">Drives</div>
                    {drives.map((drive) => (
                        <div 
                            key={drive.path}
                            className={`sidebar-item ${currentPath === drive.path ? 'active' : ''}`}
                            onClick={() => handleDriveClick(drive.path)}
                        >
                            <span className="sidebar-icon">💽</span>
                            {drive.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
});

// Memoized Empty Space Context Menu Component  
const EmptySpaceContextMenu = memo(({ visible, x, y, onClose, onOpenPowerShell }) => {
    const menuRef = useRef(null);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        
        if (visible) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [visible, onClose]);
    
    if (!visible) return null;
    
    return (
        <div 
            ref={menuRef}
            className="context-menu empty-space-context-menu"
            style={{ 
                position: 'fixed', 
                left: x, 
                top: y, 
                zIndex: 1000 
            }}
        >
            <div className="context-menu-item" onClick={onOpenPowerShell}>
                <span className="context-menu-icon">[{'>'}_]</span>
                <span className="context-menu-text">Open PowerShell 7 Here</span>
            </div>
        </div>
    );
});

// Memoized Context Menu Component
const ContextMenu = memo(({ visible, x, y, files, onClose, onRecycleBinDelete, onPermanentDelete, onCopy, onCut, onRename }) => {
    const menuRef = useRef(null);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        
        if (visible) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [visible, onClose]);
    
    if (!visible) return null;
    
    return (
        <div 
            ref={menuRef}
            className="context-menu"
            style={{ 
                position: 'fixed', 
                left: x, 
                top: y, 
                zIndex: 1000 
            }}
        >
            <div className="context-menu-item" onClick={onCopy}>
                <span className="context-menu-icon">[C]</span>
                <span className="context-menu-text">Copy ({files.length})</span>
            </div>
            <div className="context-menu-item" onClick={onCut}>
                <span className="context-menu-icon">[X]</span>
                <span className="context-menu-text">Cut ({files.length})</span>
            </div>
            <div className="context-menu-separator"></div>
            {files.length === 1 && (
                <div className="context-menu-item" onClick={onRename}>
                    <span className="context-menu-icon">[F2]</span>
                    <span className="context-menu-text">Rename</span>
                </div>
            )}
            <div className="context-menu-separator"></div>
            <div className="context-menu-item" onClick={onRecycleBinDelete} style={{ color: 'var(--blueprint-warning)' }}>
                <span className="context-menu-icon">[R]</span>
                <span className="context-menu-text">Recycle ({files.length})</span>
            </div>
            <div className="context-menu-item" onClick={onPermanentDelete} style={{ color: 'var(--blueprint-error)' }}>
                <span className="context-menu-icon">[!]</span>
                <span className="context-menu-text">Delete ({files.length})</span>
            </div>
        </div>
    );
});

// Memoized File item component
const FileItem = memo(({ file, onSelect, onOpen, isLoading, isSelected, fileIndex, isCut, onContextMenu, onDragStart, onDragOver, onDragEnter, onDragLeave, onDrop, isDragOver }) => {
    const icon = useMemo(() => getFileIcon(file.name, file.isDir), [file.name, file.isDir]);
    const type = useMemo(() => getFileType(file.name, file.isDir), [file.name, file.isDir]);
    
    const handleClick = useCallback((event) => {
        console.log('📋 File clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir, 'IsSelected:', isSelected);
        
        if (!isLoading) {
            // If the file is already selected and this is a single click (no modifier keys), open it
            if (isSelected && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                console.log('🚀 File already selected, opening:', file.name);
                onOpen(file);
            } else {
                // Otherwise, handle selection
                console.log('🖱️ Processing selection for:', file.name);
                onSelect(fileIndex, event.shiftKey, event.ctrlKey || event.metaKey);
            }
        }
    }, [file, isLoading, isSelected, fileIndex, onOpen, onSelect]);
    
    const handleDoubleClick = useCallback((event) => {
        console.log('🔍 File double-clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir);
        
        if (!isLoading) {
            // Double click always opens, regardless of selection state
            console.log('🚀 Double-click detected, opening:', file.name);
            onOpen(file);
        }
    }, [file, isLoading, onOpen]);
    
    const handleRightClick = useCallback((event) => {
        event.preventDefault();
        console.log('🖱️ Right-click on:', file.name, 'IsSelected:', isSelected);
        
        if (!isLoading) {
            // If file is not selected, select it first
            if (!isSelected) {
                onSelect(fileIndex, false, false);
            }
            
            // Show context menu
            onContextMenu(event, file);
        }
    }, [file, isLoading, isSelected, fileIndex, onSelect, onContextMenu]);
    
    const handleDragStart = useCallback((event) => {
        if (isLoading) {
            event.preventDefault();
            return;
        }
        
        // If the dragged item is not selected, select it first
        if (!isSelected) {
            onSelect(fileIndex, false, false);
        }
        
        if (onDragStart) {
            onDragStart(event, file);
        }
    }, [isLoading, isSelected, fileIndex, file, onSelect, onDragStart]);
    
    const handleDragOver = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        event.preventDefault();
        event.dataTransfer.dropEffect = event.ctrlKey ? 'copy' : 'move';
        
        if (onDragOver) {
            onDragOver(event, file);
        }
    }, [file.isDir, isLoading, onDragOver, file]);
    
    const handleDragEnter = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        event.preventDefault();
        if (onDragEnter) {
            onDragEnter(event, file);
        }
    }, [file.isDir, isLoading, onDragEnter, file]);
    
    const handleDragLeave = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        if (onDragLeave) {
            onDragLeave(event, file);
        }
    }, [file.isDir, isLoading, onDragLeave, file]);
    
    const handleDrop = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        event.preventDefault();
        
        try {
            const dragData = JSON.parse(event.dataTransfer.getData('application/json'));
            console.log('📂 Drop on folder:', file.name, 'Items:', dragData.files?.length, 'Operation:', dragData.operation);
            
            if (onDrop) {
                onDrop(event, file, dragData);
            }
        } catch (err) {
            console.error('❌ Error parsing drag data:', err);
        }
    }, [file, isLoading, onDrop]);
    
    return (
        <div 
            className={`file-item ${isSelected ? 'selected' : ''} ${isLoading ? 'disabled' : ''} ${isCut ? 'cut' : ''} ${isDragOver ? 'drag-over' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleRightClick}
            draggable={!isLoading}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ 
                cursor: isLoading ? 'wait' : 'pointer',
                opacity: isLoading ? 0.7 : (isCut ? 0.5 : 1) 
            }}
        >
            <div className={`file-icon ${type}`}>
                {icon}
            </div>
            <div className="file-details">
                <div className="file-name">{file.name}</div>
                <div className="file-meta">
                    {file.isDir ? (
                        <span>DIR</span>
                    ) : (
                        <>
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.modTime)}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

// Memoized 8-bit Dialog Component
const RetroDialog = memo(({ isOpen, type, title, message, defaultValue, onConfirm, onCancel, onClose }) => {
    const [inputValue, setInputValue] = useState(defaultValue || '');
    const inputRef = useRef(null);
    
    useEffect(() => {
        setInputValue(defaultValue || '');
    }, [defaultValue]);
    
    useEffect(() => {
        if (isOpen && type === 'prompt' && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [isOpen, type]);
    
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            
            if (e.key === 'Escape') {
                onCancel();
            } else if (e.key === 'Enter') {
                if (type === 'prompt') {
                    onConfirm(inputValue);
                } else {
                    onConfirm();
                }
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, type, inputValue, onConfirm, onCancel]);
    
    const handleInputChange = useCallback((e) => {
        setInputValue(e.target.value);
    }, []);
    
    const handleConfirm = useCallback(() => {
        if (type === 'prompt') {
            onConfirm(inputValue);
        } else {
            onConfirm();
        }
    }, [type, inputValue, onConfirm]);
    
    if (!isOpen) return null;
    
    return (
        <div className="retro-dialog-overlay">
            <div className="retro-dialog">
                {/* Dialog header */}
                <div className="retro-dialog-header">
                    <div className="retro-dialog-title">{title || 'SYSTEM MESSAGE'}</div>
                    <button 
                        className="retro-dialog-close"
                        onClick={onCancel}
                        title="CLOSE [ESC]"
                    >
                        ✕
                    </button>
                </div>
                
                {/* Dialog content */}
                <div className="retro-dialog-content">
                    <div className="retro-dialog-icon">
                        {type === 'confirm' && '⚠️'}
                        {type === 'prompt' && '✏️'}
                        {type === 'alert' && 'ℹ️'}
                        {type === 'error' && '❌'}
                        {type === 'success' && '✅'}
                        {type === 'delete' && '🗑️'}
                    </div>
                    <div className="retro-dialog-message">
                        {message.split('\n').map((line, index) => (
                            <div key={index}>{line}</div>
                        ))}
                    </div>
                    
                    {type === 'prompt' && (
                        <div className="retro-dialog-input-container">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={handleInputChange}
                                className="retro-dialog-input"
                                placeholder="ENTER VALUE..."
                            />
                        </div>
                    )}
                </div>
                
                {/* Dialog buttons */}
                <div className="retro-dialog-buttons">
                    {type === 'prompt' ? (
                        <>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-primary"
                                onClick={handleConfirm}
                            >
                                [ENTER] CONFIRM
                            </button>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-secondary"
                                onClick={onCancel}
                            >
                                [ESC] CANCEL
                            </button>
                        </>
                    ) : type === 'confirm' || type === 'delete' ? (
                        <>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-primary"
                                onClick={handleConfirm}
                            >
                                [ENTER] YES
                            </button>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-secondary"
                                onClick={onCancel}
                            >
                                [ESC] NO
                            </button>
                        </>
                    ) : (
                        <button 
                            className="retro-dialog-btn retro-dialog-btn-primary"
                            onClick={handleConfirm}
                        >
                            [ENTER] OK
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

// Main App component
export function App() {
    const [currentPath, setCurrentPath] = useState('');
    const [directoryContents, setDirectoryContents] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [drives, setDrives] = useState([]);
    const [showHiddenFiles, setShowHiddenFiles] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
    const [clipboardFiles, setClipboardFiles] = useState([]);
    const [clipboardOperation, setClipboardOperation] = useState(''); // 'copy' or 'cut'
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, files: [] });
    const [emptySpaceContextMenu, setEmptySpaceContextMenu] = useState({ visible: false, x: 0, y: 0 });
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
    
    // Dialog helper functions
    const showDialog = (type, title, message, defaultValue = '', onConfirm = () => {}, onCancel = () => {}) => {
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
    };
    
    const closeDialog = () => {
        setDialog(prev => ({ ...prev, isOpen: false }));
    };
    
    // Filter function for hidden and system files
    const filterFiles = (files) => {
        if (!files) return [];
        if (showHiddenFiles) return files;
        
        return files.filter(file => {
            // Hide files that start with . (hidden files)
            if (file.name.startsWith('.')) return false;
            
            // Hide common Windows system files
            const systemFiles = [
                'NTUSER.DAT', 'ntuser.dat.LOG1', 'ntuser.dat.LOG2', 'ntuser.ini',
                'Application Data', 'Cookies', 'Local Settings', 'My Documents',
                'NetHood', 'PrintHood', 'Recent', 'SendTo', 'Start Menu', 'Templates'
            ];
            
            if (systemFiles.includes(file.name)) return false;
            
            // Hide files with system file extensions and patterns
            const hiddenPatterns = [
                /^NTUSER\.DAT/i,
                /\.TM\.blf$/i,
                /\.TMContainer.*\.regtrans-ms$/i,
                /^thumbs\.db$/i,
                /^desktop\.ini$/i
            ];
            
            return !hiddenPatterns.some(pattern => pattern.test(file.name));
        });
    };
    
    // Memoized computed values
    const filteredDirectories = useMemo(() => 
        directoryContents ? filterFiles(directoryContents.directories) : [], 
        [directoryContents, showHiddenFiles]
    );
    
    const filteredFiles = useMemo(() => 
        directoryContents ? filterFiles(directoryContents.files) : [], 
        [directoryContents, showHiddenFiles]
    );
    
    const allFiles = useMemo(() => 
        [...filteredDirectories, ...filteredFiles], 
        [filteredDirectories, filteredFiles]
    );

    // Initialize app
    useEffect(() => {
        console.log('🚀 Blueprint File Explorer initializing...');
        initializeApp();
    }, []);
    
    // Clear selection when path changes
    useEffect(() => {
        setSelectedFiles(new Set());
        setLastSelectedIndex(-1);
        setContextMenu({ visible: false, x: 0, y: 0, files: [] });
    }, [currentPath]);
    
    // Global drag end handling
    useEffect(() => {
        const handleGlobalDragEnd = () => {
            setIsDragging(false);
            setDragOverFolder(null);
        };
        
        window.addEventListener('dragend', handleGlobalDragEnd);
        return () => window.removeEventListener('dragend', handleGlobalDragEnd);
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            // F5 for refresh
            if (event.key === 'F5') {
                event.preventDefault();
                handleRefresh();
            }
            // Backspace or Alt+Left for navigate up
            else if ((event.key === 'Backspace' && !event.target.matches('input, textarea')) || 
                     (event.altKey && event.key === 'ArrowLeft')) {
                event.preventDefault();
                handleNavigateUp();
            }
            // Enter to open selected files
            else if (event.key === 'Enter' && selectedFiles.size > 0) {
                event.preventDefault();
                const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
                selectedFileObjects.forEach(file => handleFileOpen(file));
            }
            // Ctrl+A to select all
            else if (event.ctrlKey && event.key === 'a' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                selectAll();
            }
            // Ctrl+C to copy
            else if (event.ctrlKey && event.key === 'c' && selectedFiles.size > 0) {
                event.preventDefault();
                handleCopy();
            }
            // Ctrl+X to cut
            else if (event.ctrlKey && event.key === 'x' && selectedFiles.size > 0) {
                event.preventDefault();
                handleCut();
            }
            // Ctrl+V to paste
            else if (event.ctrlKey && event.key === 'v' && clipboardFiles.length > 0) {
                event.preventDefault();
                handlePaste();
            }
            // Delete key to move to recycle bin, Shift+Delete to permanently delete
            else if (event.key === 'Delete' && selectedFiles.size > 0) {
                event.preventDefault();
                if (event.shiftKey) {
                    handlePermanentDelete();
                } else {
                    handleRecycleBinDelete();
                }
            }
            // Arrow keys for navigation
            else if (event.key === 'ArrowUp' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                handleArrowNavigation('up');
            }
            else if (event.key === 'ArrowDown' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                handleArrowNavigation('down');
            }
            // F2 to rename selected file (only if exactly one file is selected)
            else if (event.key === 'F2' && selectedFiles.size === 1) {
                event.preventDefault();
                const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
                const file = selectedFileObjects[0];
                
                showDialog(
                    'prompt',
                    'RENAME FILE',
                    `RENAME "${file.name}" TO:`,
                    file.name,
                    (newName) => {
                        if (newName && newName !== file.name && newName.trim() !== '') {
                            handleRename(file.path, newName.trim());
                        }
                    }
                );
            }
            // Escape to clear selection and close context menus
            else if (event.key === 'Escape') {
                setSelectedFiles(new Set());
                setLastSelectedIndex(-1);
                closeContextMenu();
                closeEmptySpaceContextMenu();
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPath, selectedFiles, clipboardFiles]);
    
    // Load drives on Windows
    useEffect(() => {
        GetDriveInfo().then(driveList => {
            console.log('💽 Drives detected:', driveList);
            setDrives(driveList);
        });
    }, []);
    
    const initializeApp = async () => {
        try {
            setIsLoading(true);
            setError('');
            console.log('🏠 Getting home directory...');
            
            const homeDir = await GetHomeDirectory();
            console.log('📁 Home directory:', homeDir);
            
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
    
    const navigateToPath = useCallback(async (path) => {
        try {
            setError('');
            console.log('🧭 Navigating to:', path);
            
            // Only show loading if operation takes longer than 150ms
            const loadingTimeout = setTimeout(() => {
                setIsLoading(true);
            }, 150);
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigation timeout - this folder may have permission issues or be inaccessible')), 10000);
            });
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            // Clear the loading timeout since operation completed
            clearTimeout(loadingTimeout);
            
            console.log('📂 Directory response:', response);
            
            if (response && response.success) {
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                console.log('✅ Successfully navigated to:', response.data.currentPath);
            } else {
                const errorMsg = response?.message || 'Unknown navigation error';
                console.warn('⚠️ Navigation failed:', errorMsg);
                setError(errorMsg);
            }
        } catch (err) {
            console.error('❌ Navigation error:', err);
            setError('Failed to navigate: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);
    
    const handleNavigateUp = async () => {
        if (!currentPath) return;
        
        try {
            setError('');
            console.log('⬆️ Navigating up from:', currentPath);
            
            // Only show loading if operation takes longer than 150ms
            const loadingTimeout = setTimeout(() => {
                setIsLoading(true);
            }, 150);
            
            // Add timeout for navigate up as well
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigate up timeout')), 10000);
            });
            
            const navigationPromise = NavigateUp(currentPath);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            // Clear the loading timeout since operation completed
            clearTimeout(loadingTimeout);
            
            console.log('📂 Navigate up response:', response);
            
            if (response && response.success) {
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                console.log('✅ Successfully navigated up to:', response.data.currentPath);
            } else {
                const errorMsg = response?.message || 'Unknown navigate up error';
                console.warn('⚠️ Navigate up failed:', errorMsg);
                setError(errorMsg);
            }
        } catch (err) {
            console.error('❌ Navigate up error:', err);
            setError('Failed to navigate up: ' + err.message);
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleRefresh = () => {
        if (currentPath) {
            navigateToPath(currentPath);
        }
    };
    
    const handleOpenInExplorer = () => {
        if (currentPath) {
            OpenInSystemExplorer(currentPath);
        }
    };
    
    const handleFileOpen = (file) => {
        console.log('🔍 Opening file/folder:', file);
        console.log('📊 File properties - Name:', file.name, 'IsDir:', file.isDir, 'Path:', file.path);
        
        try {
            if (file.isDir) {
                console.log('📁 Navigating to folder:', file.path);
                navigateToPath(file.path);
            } else {
                console.log('📄 Opening file with default application:', file.path);
                const success = OpenFile(file.path);
                if (!success) {
                    console.warn('⚠️ Failed to open file with default application, falling back to explorer');
                    OpenInSystemExplorer(file.path);
                }
            }
        } catch (err) {
            console.error('❌ Error opening file:', err);
            setError('Failed to open file: ' + err.message);
        }
    };
    

    
    // Handle file selection
    const handleFileSelect = (fileIndex, isShiftKey, isCtrlKey) => {
        console.log('📋 File selection:', fileIndex, 'Shift:', isShiftKey, 'Ctrl:', isCtrlKey);
        
        setSelectedFiles(prevSelected => {
            const newSelected = new Set(prevSelected);
            
            if (isShiftKey && lastSelectedIndex !== -1) {
                // Range selection
                const start = Math.min(lastSelectedIndex, fileIndex);
                const end = Math.max(lastSelectedIndex, fileIndex);
                
                for (let i = start; i <= end; i++) {
                    newSelected.add(i);
                }
            } else if (isCtrlKey) {
                // Toggle selection
                if (newSelected.has(fileIndex)) {
                    newSelected.delete(fileIndex);
                } else {
                    newSelected.add(fileIndex);
                }
            } else {
                // Single selection
                newSelected.clear();
                newSelected.add(fileIndex);
            }
            
            return newSelected;
        });
        
        setLastSelectedIndex(fileIndex);
    };
    
    // Handle arrow key navigation
    const handleArrowNavigation = useCallback((direction) => {
        if (allFiles.length === 0) return;
        
        let targetIndex;
        
        if (selectedFiles.size === 1) {
            // Move from current selection
            const currentIndex = Array.from(selectedFiles)[0];
            
            if (direction === 'up') {
                targetIndex = currentIndex > 0 ? currentIndex - 1 : allFiles.length - 1; // Wrap to bottom
            } else {
                targetIndex = currentIndex < allFiles.length - 1 ? currentIndex + 1 : 0; // Wrap to top
            }
        } else {
            // No selection or multiple selections - select first/last item
            if (direction === 'up') {
                targetIndex = allFiles.length - 1; // Select last item
            } else {
                targetIndex = 0; // Select first item
            }
        }
        
        console.log(`⬆️⬇️ Arrow navigation ${direction}: moving to index ${targetIndex} (${allFiles[targetIndex]?.name})`);
        
        // Select the target file
        setSelectedFiles(new Set([targetIndex]));
        setLastSelectedIndex(targetIndex);
        
        // Scroll the item into view
        scrollToFileIndex(targetIndex);
    }, [allFiles, selectedFiles]);
    
    // Scroll to make a file visible
    const scrollToFileIndex = (fileIndex) => {
        // Find the file item element by its index
        const fileList = document.querySelector('.file-list');
        const fileItems = fileList?.querySelectorAll('.file-item');
        
        if (fileItems && fileItems[fileIndex]) {
            fileItems[fileIndex].scrollIntoView({
                behavior: 'smooth',
                block: 'nearest'
            });
        }
    };
    
    // Select all files
    const selectAll = () => {
        const allIndices = new Set();
        for (let i = 0; i < allFiles.length; i++) {
            allIndices.add(i);
        }
        setSelectedFiles(allIndices);
        console.log('📋 Selected all files:', allIndices.size);
    };
    
    // Clear selection
    const clearSelection = () => {
        setSelectedFiles(new Set());
        setLastSelectedIndex(-1);
        console.log('📋 Cleared selection');
    };
    
    // Handle copy operation
    const handleCopy = useCallback(() => {
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        setClipboardFiles(filePaths);
        setClipboardOperation('copy');
        
        console.log('📋 Copied to clipboard:', filePaths);
        console.log(`📄 ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} copied`);
    }, [selectedFiles, allFiles]);
    
    // Handle cut operation
    const handleCut = useCallback(() => {
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        setClipboardFiles(filePaths);
        setClipboardOperation('cut');
        
        console.log('✂️ Cut to clipboard:', filePaths);
        console.log(`✂️ ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} cut`);
    }, [selectedFiles, allFiles]);
    
    // Handle paste operation
    const handlePaste = async () => {
        if (clipboardFiles.length === 0 || !currentPath) return;
        
        try {
            console.log(`📥 Pasting ${clipboardFiles.length} items to:`, currentPath);
            console.log('Operation:', clipboardOperation);
            console.log('Files:', clipboardFiles);
            
            let success = false;
            let errorMessage = '';
            
            if (clipboardOperation === 'copy') {
                success = await CopyFiles(clipboardFiles, currentPath);
                console.log('📄 Copy operation result:', success);
                if (!success) {
                    errorMessage = `Failed to copy files to "${currentPath}". This may be due to:
• Insufficient permissions (try running as administrator)
• Destination folder is read-only
• Not enough disk space
• Files are in use by another application`;
                }
            } else if (clipboardOperation === 'cut') {
                success = await MoveFiles(clipboardFiles, currentPath);
                console.log('✂️ Move operation result:', success);
                
                if (!success) {
                    errorMessage = `Failed to move files to "${currentPath}". This may be due to:
• Insufficient permissions (try running as administrator)
• Destination folder is read-only
• Files are in use by another application
• Cannot move across different drive types`;
                } else {
                    // Clear clipboard after successful cut operation
                    setClipboardFiles([]);
                    setClipboardOperation('');
                }
            }
            
            if (success) {
                console.log('✅ Paste operation successful');
                // Clear selection first
                clearSelection();
                // Small delay to ensure file system operations are complete, then refresh
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after paste operation');
                    handleRefresh();
                }, 50);
            } else {
                console.error('❌ Paste operation failed');
                setError(errorMessage);
            }
        } catch (err) {
            console.error('❌ Error during paste operation:', err);
            setError('Failed to paste files: ' + err.message);
        }
    };
    
    // Handle move to recycle bin operation (Delete key)
    const handleRecycleBinDelete = useCallback(async () => {
        if (selectedFiles.size === 0) return;
        
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        // Show custom confirm dialog
        const fileList = selectedFileObjects.map(file => file.name).join(', ');
        showDialog(
            'delete',
            'MOVE TO RECYCLE BIN',
            `MOVE ${filePaths.length} ITEM${filePaths.length === 1 ? '' : 'S'} TO RECYCLE BIN?\n\n${fileList}`,
            '',
            async () => {
                try {
                    console.log('🗑️ Moving files to recycle bin:', filePaths);
                    
                    const success = await MoveFilesToRecycleBin(filePaths);
                    
                    if (success) {
                        console.log('✅ Move to recycle bin successful');
                        clearSelection();
                        setTimeout(() => {
                            console.log('🔄 Refreshing directory after recycle bin operation');
                            handleRefresh();
                        }, 50);
                    } else {
                        console.error('❌ Move to recycle bin failed');
                        setError('Failed to move files to recycle bin');
                    }
                } catch (err) {
                    console.error('❌ Error during recycle bin operation:', err);
                    setError('Failed to move files to recycle bin: ' + err.message);
                }
            }
        );
    }, [selectedFiles, allFiles]);
    
    // Get all files helper function
    const getAllFiles = useCallback(() => {
        return [...filteredDirectories, ...filteredFiles];
    }, [filteredDirectories, filteredFiles]);
    
    // Handle permanent delete operation (Shift+Delete)
    const handlePermanentDelete = async () => {
        if (selectedFiles.size === 0) return;
        
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        // Show custom confirm dialog with stronger warning
        const fileList = selectedFileObjects.map(file => file.name).join(', ');
        showDialog(
            'delete',
            '⚠️ PERMANENT DELETE WARNING',
            `PERMANENTLY DELETE ${filePaths.length} ITEM${filePaths.length === 1 ? '' : 'S'}?\n\n⚠️ THIS ACTION CANNOT BE UNDONE!\n\n${fileList}`,
            '',
            async () => {
                try {
                    console.log('🗑️ Permanently deleting files:', filePaths);
                    
                    const success = await DeleteFiles(filePaths);
                    
                    if (success) {
                        console.log('✅ Permanent delete operation successful');
                        clearSelection();
                        setTimeout(() => {
                            console.log('🔄 Refreshing directory after permanent delete operation');
                            handleRefresh();
                        }, 50);
                    } else {
                        console.error('❌ Permanent delete operation failed');
                        setError('Failed to permanently delete files');
                    }
                } catch (err) {
                    console.error('❌ Error during permanent delete operation:', err);
                    setError('Failed to permanently delete files: ' + err.message);
                }
            }
        );
    };
    
    // Handle context menu
    const handleContextMenu = (event, file) => {
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        
        // If right-clicked file is not in selection, use just that file
        const contextFiles = selectedFiles.size > 0 && selectedFileObjects.some(f => f.path === file.path) 
            ? selectedFileObjects 
            : [file];
        
        setContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            files: contextFiles
        });
        
        console.log('📋 Context menu opened for:', contextFiles.map(f => f.name));
    };
    
    // Close context menu
    const closeContextMenu = () => {
        setContextMenu({ visible: false, x: 0, y: 0, files: [] });
    };
    
    // Close empty space context menu
    const closeEmptySpaceContextMenu = () => {
        setEmptySpaceContextMenu({ visible: false, x: 0, y: 0 });
    };
    
    // Handle empty space context menu
    const handleEmptySpaceContextMenu = (event) => {
        event.preventDefault();
        setEmptySpaceContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY
        });
        console.log('📋 Empty space context menu opened at:', event.clientX, event.clientY);
    };
    
    // Open PowerShell 7 in current directory
    const handleOpenPowerShell = async () => {
        closeEmptySpaceContextMenu();
        
        if (!currentPath) {
            console.warn('⚠️ No current path available for PowerShell');
            return;
        }
        
        try {
            console.log('🔧 Opening PowerShell 7 in:', currentPath);
            
            // Use the dedicated backend function to open PowerShell in the current directory
            const success = await OpenPowerShellHere(currentPath);
            
            if (!success) {
                console.warn('⚠️ Failed to open PowerShell 7');
                setError('Failed to open PowerShell 7. Please ensure PowerShell 7 is installed at the default location.');
            } else {
                console.log('✅ PowerShell 7 opened successfully in:', currentPath);
            }
        } catch (err) {
            console.error('❌ Error opening PowerShell 7:', err);
            setError('Failed to open PowerShell 7: ' + err.message);
        }
    };
    
    // Drag and drop handlers
    const handleDragStart = (event, draggedFiles) => {
        setIsDragging(true);
        console.log('🖱️ Drag operation started with', draggedFiles.length, 'files');
    };
    
    const handleDragOver = (event, targetFolder) => {
        if (targetFolder && targetFolder.isDir) {
            setDragOverFolder(targetFolder.path);
        }
    };
    
    const handleDragEnter = (event, targetFolder) => {
        if (targetFolder && targetFolder.isDir) {
            setDragOverFolder(targetFolder.path);
        }
    };
    
    const handleDragLeave = (event, targetFolder) => {
        // Only clear if we're actually leaving the folder (not just moving to a child element)
        if (event.currentTarget === event.target || !event.currentTarget.contains(event.relatedTarget)) {
            setDragOverFolder(null);
        }
    };
    
    const handleDrop = async (event, targetFolder, dragData) => {
        setIsDragging(false);
        setDragOverFolder(null);
        
        if (!targetFolder || !targetFolder.isDir || !dragData || !dragData.files) {
            console.warn('⚠️ Invalid drop operation');
            return;
        }
        
        const sourcePaths = dragData.files.map(file => file.path);
        const targetPath = targetFolder.path;
        
        // Don't allow dropping items into themselves or their children
        for (const file of dragData.files) {
            if (targetPath === file.path || targetPath.startsWith(file.path + '\\') || targetPath.startsWith(file.path + '/')) {
                console.warn('⚠️ Cannot drop item into itself or its child');
                setError('Cannot move/copy items into themselves or their children');
                return;
            }
        }
        
        console.log(`📂 Drop operation: ${dragData.operation} ${sourcePaths.length} items to ${targetPath}`);
        
        try {
            let success = false;
            
            if (dragData.operation === 'copy') {
                success = await CopyFiles(sourcePaths, targetPath);
                if (success) {
                    console.log('✅ Drag and drop copy successful');
                } else {
                    setError(`Failed to copy files to "${targetFolder.name}". Check permissions and available space.`);
                }
            } else if (dragData.operation === 'move') {
                success = await MoveFiles(sourcePaths, targetPath);
                if (success) {
                    console.log('✅ Drag and drop move successful');
                } else {
                    setError(`Failed to move files to "${targetFolder.name}". Check permissions and ensure files are not in use.`);
                }
            }
            
            if (success) {
                // Clear selection and refresh
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after drag and drop operation');
                    handleRefresh();
                }, 50);
            }
        } catch (err) {
            console.error('❌ Error during drag and drop operation:', err);
            setError('Drag and drop operation failed: ' + err.message);
        }
    };
    
    const handleDragEnd = () => {
        setIsDragging(false);
        setDragOverFolder(null);
    };

    // Handle context menu actions
    const handleContextCopy = () => {
        const filePaths = contextMenu.files.map(file => file.path);
        setClipboardFiles(filePaths);
        setClipboardOperation('copy');
        console.log('📋 Copied via context menu:', filePaths);
        closeContextMenu();
    };
    
    const handleContextCut = () => {
        const filePaths = contextMenu.files.map(file => file.path);
        setClipboardFiles(filePaths);
        setClipboardOperation('cut');
        console.log('✂️ Cut via context menu:', filePaths);
        closeContextMenu();
    };
    
    const handleContextRecycleBinDelete = async () => {
        const filePaths = contextMenu.files.map(file => file.path);
        const fileList = contextMenu.files.map(file => file.name).join(', ');
        
        closeContextMenu();
        
        showDialog(
            'delete',
            'MOVE TO RECYCLE BIN',
            `MOVE ${filePaths.length} ITEM${filePaths.length === 1 ? '' : 'S'} TO RECYCLE BIN?\n\n${fileList}`,
            '',
            async () => {
                try {
                    console.log('🗑️ Moving files to recycle bin via context menu:', filePaths);
                    
                    const success = await MoveFilesToRecycleBin(filePaths);
                    
                    if (success) {
                        console.log('✅ Context menu recycle bin operation successful');
                        clearSelection();
                        setTimeout(() => {
                            console.log('🔄 Refreshing directory after recycle bin operation');
                            handleRefresh();
                        }, 50);
                    } else {
                        console.error('❌ Context menu recycle bin operation failed');
                        setError(`Failed to move files to recycle bin. This may be due to:
• Files are in use by another application
• Insufficient permissions
• Files are on a network drive or external storage`);
                    }
                } catch (err) {
                    console.error('❌ Error during context menu recycle bin operation:', err);
                    setError('Failed to move files to recycle bin: ' + err.message);
                }
            }
        );
    };
    
    const handleContextPermanentDelete = async () => {
        const filePaths = contextMenu.files.map(file => file.path);
        const fileList = contextMenu.files.map(file => file.name).join(', ');
        
        closeContextMenu();
        
        showDialog(
            'delete',
            '⚠️ PERMANENT DELETE WARNING',
            `PERMANENTLY DELETE ${filePaths.length} ITEM${filePaths.length === 1 ? '' : 'S'}?\n\n⚠️ THIS ACTION CANNOT BE UNDONE!\n\n${fileList}`,
            '',
            async () => {
                try {
                    console.log('🗑️ Permanently deleting files via context menu:', filePaths);
                    
                    const success = await DeleteFiles(filePaths);
                    
                    if (success) {
                        console.log('✅ Context menu permanent delete operation successful');
                        clearSelection();
                        setTimeout(() => {
                            console.log('🔄 Refreshing directory after permanent delete operation');
                            handleRefresh();
                        }, 50);
                    } else {
                        console.error('❌ Context menu permanent delete operation failed');
                        setError(`Failed to permanently delete files. This may be due to:
• Files are in use by another application
• Insufficient permissions
• Files are read-only or system protected`);
                    }
                } catch (err) {
                    console.error('❌ Error during context menu permanent delete operation:', err);
                    setError('Failed to permanently delete files: ' + err.message);
                }
            }
        );
    };
    
    // Handle context menu rename
    const handleContextRename = () => {
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
                    handleRename(file.path, newName.trim());
                }
            }
        );
    };
    
    // Handle rename operation
    const handleRename = async (filePath, newName) => {
        try {
            console.log('✏️ Renaming file:', filePath, 'to:', newName);
            
            const success = await RenameFile(filePath, newName);
            
            if (success) {
                console.log('✅ Rename operation successful');
                // Clear selection and refresh
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after rename operation');
                    handleRefresh();
                }, 50);
            } else {
                console.error('❌ Rename operation failed');
                setError(`Failed to rename "${filePath}". This may be due to:
• A file with that name already exists
• Insufficient permissions
• Invalid characters in the new name
• File is in use by another application`);
            }
        } catch (err) {
            console.error('❌ Error during rename operation:', err);
            setError('Failed to rename file: ' + err.message);
        }
    };
    
    const toggleHiddenFiles = () => {
        setShowHiddenFiles(!showHiddenFiles);
    };
    
    return (
        <div className="file-explorer blueprint-bg">
            {/* Header */}
            <header className="app-header">
                <div className="app-title">Files</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isLoading && (
                        <div className="loading-spinner"></div>
                    )}
                    <span className="text-technical">
                        {directoryContents ? 
                            `${filterFiles(directoryContents.directories).length} dirs • ${filterFiles(directoryContents.files).length} files${!showHiddenFiles ? ' (hidden filtered)' : ''}${selectedFiles.size > 0 ? ` • ${selectedFiles.size} selected` : ''}` : 
                            'Ready'
                        }
                    </span>
                </div>
            </header>
            
            {/* Error display */}
            {error && (
                <div className="error-message">
                    <strong>⚠️ Error:</strong> {error}
                    <button
                        onClick={() => setError('')}
                        style={{ marginLeft: '12px', background: 'none', border: 'none', color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
                    >
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
                        <button 
                            className="toolbar-btn"
                            onClick={handleNavigateUp}
                            disabled={!currentPath || isLoading}
                        >
                            ⬆️ Up
                        </button>
                        <button 
                            className="toolbar-btn"
                            onClick={handleRefresh}
                            disabled={!currentPath || isLoading}
                        >
                            🔄 Refresh
                        </button>
                        <button 
                            className="toolbar-btn"
                            onClick={handleOpenInExplorer}
                            disabled={!currentPath || isLoading}
                        >
                            🖥️ Open in Explorer
                        </button>
                        <button 
                            className={`toolbar-btn ${showHiddenFiles ? 'active' : ''}`}
                            onClick={toggleHiddenFiles}
                            disabled={isLoading}
                            title={showHiddenFiles ? 'Hide hidden files' : 'Show hidden files'}
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
                            // Clear selection when clicking empty space
                            if (e.target === e.currentTarget) {
                                clearSelection();
                                closeContextMenu();
                                closeEmptySpaceContextMenu();
                            }
                        }}
                        onContextMenu={(e) => {
                            // Show empty space context menu on right-click
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
                                {/* Render all files in order */}
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
                                        selectedFiles={selectedFiles}
                                        allFiles={allFiles}
                                        onDragStart={handleDragStart}
                                        onDragOver={handleDragOver}
                                        onDragEnter={handleDragEnter}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        isDragOver={dragOverFolder === file.path}
                                    />
                                ))}
                                
                                {/* Empty directory message */}
                                {allFiles.length === 0 && (
                                    <div style={{ 
                                        textAlign: 'center', 
                                        padding: '64px 32px',
                                        color: 'var(--blueprint-text-muted)' 
                                    }}>
                                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                                        <div className="text-technical">Directory is empty</div>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div style={{ 
                                textAlign: 'center', 
                                padding: '64px 32px',
                                color: 'var(--blueprint-text-muted)' 
                            }}>
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                                <div className="text-technical">Ready</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Context Menu */}
            <ContextMenu
                visible={contextMenu.visible}
                x={contextMenu.x}
                y={contextMenu.y}
                files={contextMenu.files}
                onClose={closeContextMenu}
                onCopy={handleContextCopy}
                onCut={handleContextCut}
                onRename={handleContextRename}
                onRecycleBinDelete={handleContextRecycleBinDelete}
                onPermanentDelete={handleContextPermanentDelete}
            />
            
            {/* Empty Space Context Menu */}
            <EmptySpaceContextMenu
                visible={emptySpaceContextMenu.visible}
                x={emptySpaceContextMenu.x}
                y={emptySpaceContextMenu.y}
                onClose={closeEmptySpaceContextMenu}
                onOpenPowerShell={handleOpenPowerShell}
            />
            
            {/* Custom 8-bit Dialog */}
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
