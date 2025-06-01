import './style.css';
import { useState, useEffect, useCallback, useRef } from "preact/hooks";
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
    MoveFilesToRecycleBin
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

// Breadcrumb component
const Breadcrumb = ({ currentPath, onNavigate }) => {
    const segments = currentPath.split(/[\/\\]/).filter(Boolean);
    
    const handleSegmentClick = (index) => {
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
    };
    
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
};

// Sidebar component
const Sidebar = ({ currentPath, onNavigate, drives = [] }) => {
    const [homeDir, setHomeDir] = useState('');
    
    useEffect(() => {
        GetHomeDirectory().then(setHomeDir);
    }, []);
    
    // Use proper path separators for the current OS
    const pathSep = homeDir.includes('\\') ? '\\' : '/';
    
    const quickAccess = [
        { name: 'Home', path: homeDir, icon: '🏠' },
        { name: 'Desktop', path: homeDir + pathSep + 'Desktop', icon: '🖥️' },
        { name: 'Documents', path: homeDir + pathSep + 'Documents', icon: '📁' },
        { name: 'Downloads', path: homeDir + pathSep + 'Downloads', icon: '⬇️' },
    ].filter(item => item.path);
    
    return (
        <div className="sidebar">
            <div className="sidebar-section">
                <div className="sidebar-title">Quick Access</div>
                {quickAccess.map((item) => (
                    <div 
                        key={item.path}
                        className={`sidebar-item ${currentPath === item.path ? 'active' : ''}`}
                        onClick={() => onNavigate(item.path)}
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
                            onClick={() => onNavigate(drive.path)}
                        >
                            <span className="sidebar-icon">💽</span>
                            {drive.name}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Context Menu Component
const ContextMenu = ({ visible, x, y, files, onClose, onRecycleBinDelete, onPermanentDelete, onCopy, onCut }) => {
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
                📋 Copy ({files.length})
            </div>
            <div className="context-menu-item" onClick={onCut}>
                ✂️ Cut ({files.length})
            </div>
            <div className="context-menu-separator"></div>
            <div className="context-menu-item" onClick={onRecycleBinDelete} style={{ color: 'var(--blueprint-warning)' }}>
                🗑️ Move to Recycle Bin ({files.length})
            </div>
            <div className="context-menu-item" onClick={onPermanentDelete} style={{ color: 'var(--blueprint-error)' }}>
                ⚠️ Permanently Delete ({files.length})
            </div>
        </div>
    );
};

// File item component
const FileItem = ({ file, onSelect, onOpen, isLoading, isSelected, fileIndex, isCut, onContextMenu }) => {
    const icon = getFileIcon(file.name, file.isDir);
    const type = getFileType(file.name, file.isDir);
    
    const handleClick = (event) => {
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
    };
    
    const handleDoubleClick = (event) => {
        console.log('🔍 File double-clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir);
        
        if (!isLoading) {
            // Double click always opens, regardless of selection state
            console.log('🚀 Double-click detected, opening:', file.name);
            onOpen(file);
        }
    };
    
    const handleRightClick = (event) => {
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
    };
    
    return (
        <div 
            className={`file-item ${isSelected ? 'selected' : ''} ${isLoading ? 'disabled' : ''} ${isCut ? 'cut' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleRightClick}
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
};

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
                const allFiles = getAllFiles();
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
            // Escape to clear selection
            else if (event.key === 'Escape') {
                setSelectedFiles(new Set());
                setLastSelectedIndex(-1);
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
            
            // Only show loading if operation takes longer than 300ms
            const loadingTimeout = setTimeout(() => {
                setIsLoading(true);
            }, 300);
            
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
            
            // Only show loading if operation takes longer than 300ms
            const loadingTimeout = setTimeout(() => {
                setIsLoading(true);
            }, 300);
            
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
    
    // Get all files in the correct order (directories first, then files)
    const getAllFiles = () => {
        if (!directoryContents) return [];
        return [...filterFiles(directoryContents.directories), ...filterFiles(directoryContents.files)];
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
    const handleArrowNavigation = (direction) => {
        const allFiles = getAllFiles();
        
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
    };
    
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
        const allFiles = getAllFiles();
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
    const handleCopy = () => {
        const allFiles = getAllFiles();
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        setClipboardFiles(filePaths);
        setClipboardOperation('copy');
        
        console.log('📋 Copied to clipboard:', filePaths);
        console.log(`📄 ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} copied`);
    };
    
    // Handle cut operation
    const handleCut = () => {
        const allFiles = getAllFiles();
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        setClipboardFiles(filePaths);
        setClipboardOperation('cut');
        
        console.log('✂️ Cut to clipboard:', filePaths);
        console.log(`✂️ ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} cut`);
    };
    
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
                }, 100);
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
    const handleRecycleBinDelete = async () => {
        if (selectedFiles.size === 0) return;
        
        const allFiles = getAllFiles();
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        // Confirm deletion
        const fileList = selectedFileObjects.map(file => file.name).join(', ');
        const confirmed = confirm(`Move ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} to Recycle Bin?\n\n${fileList}`);
        
        if (!confirmed) return;
        
        try {
            console.log('🗑️ Moving files to recycle bin:', filePaths);
            
            const success = await MoveFilesToRecycleBin(filePaths);
            
            if (success) {
                console.log('✅ Move to recycle bin successful');
                // Clear selection first
                clearSelection();
                // Small delay then refresh to ensure file system changes are visible
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after recycle bin operation');
                    handleRefresh();
                }, 100);
            } else {
                console.error('❌ Move to recycle bin failed');
                setError('Failed to move files to recycle bin');
            }
        } catch (err) {
            console.error('❌ Error during recycle bin operation:', err);
            setError('Failed to move files to recycle bin: ' + err.message);
        }
    };
    
    // Handle permanent delete operation (Shift+Delete)
    const handlePermanentDelete = async () => {
        if (selectedFiles.size === 0) return;
        
        const allFiles = getAllFiles();
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        const filePaths = selectedFileObjects.map(file => file.path);
        
        // Confirm permanent deletion with stronger warning
        const fileList = selectedFileObjects.map(file => file.name).join(', ');
        const confirmed = confirm(`⚠️ PERMANENTLY DELETE ${filePaths.length} item${filePaths.length === 1 ? '' : 's'}?\n\nThis action CANNOT be undone!\n\n${fileList}`);
        
        if (!confirmed) return;
        
        try {
            console.log('🗑️ Permanently deleting files:', filePaths);
            
            const success = await DeleteFiles(filePaths);
            
            if (success) {
                console.log('✅ Permanent delete operation successful');
                // Clear selection first
                clearSelection();
                // Small delay then refresh to ensure file system changes are visible
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after permanent delete operation');
                    handleRefresh();
                }, 100);
            } else {
                console.error('❌ Permanent delete operation failed');
                setError('Failed to permanently delete files');
            }
        } catch (err) {
            console.error('❌ Error during permanent delete operation:', err);
            setError('Failed to permanently delete files: ' + err.message);
        }
    };
    
    // Handle context menu
    const handleContextMenu = (event, file) => {
        const allFiles = getAllFiles();
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
        
        const confirmed = confirm(`Move ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} to Recycle Bin?\n\n${fileList}`);
        
        if (!confirmed) {
            closeContextMenu();
            return;
        }
        
        try {
            console.log('🗑️ Moving files to recycle bin via context menu:', filePaths);
            
            const success = await MoveFilesToRecycleBin(filePaths);
            
            if (success) {
                console.log('✅ Context menu recycle bin operation successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after recycle bin operation');
                    handleRefresh();
                }, 100);
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
        
        closeContextMenu();
    };
    
    const handleContextPermanentDelete = async () => {
        const filePaths = contextMenu.files.map(file => file.path);
        const fileList = contextMenu.files.map(file => file.name).join(', ');
        
        const confirmed = confirm(`⚠️ PERMANENTLY DELETE ${filePaths.length} item${filePaths.length === 1 ? '' : 's'}?\n\nThis action CANNOT be undone!\n\n${fileList}`);
        
        if (!confirmed) {
            closeContextMenu();
            return;
        }
        
        try {
            console.log('🗑️ Permanently deleting files via context menu:', filePaths);
            
            const success = await DeleteFiles(filePaths);
            
            if (success) {
                console.log('✅ Context menu permanent delete operation successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after permanent delete operation');
                    handleRefresh();
                }, 100);
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
        
        closeContextMenu();
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
    
    const toggleHiddenFiles = () => {
        setShowHiddenFiles(!showHiddenFiles);
    };
    
    const allFiles = getAllFiles();
    
    return (
        <div className="file-explorer blueprint-bg">
            {/* Header */}
            <header className="app-header">
                <div className="app-title">YOURAVERAGEDEV'S File Explorer</div>
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
                            }
                        }}
                        onContextMenu={(e) => {
                            // Prevent context menu on empty space
                            if (e.target === e.currentTarget) {
                                e.preventDefault();
                                closeContextMenu();
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
                                <div style={{ fontSize: '48px', marginBottom: '16px' }}>🚀</div>
                                <div className="text-technical">Blueprint File Explorer</div>
                                <div style={{ marginTop: '8px', fontSize: '11px' }}>Ready to explore</div>
                                <div style={{ marginTop: '16px', fontSize: '10px', color: 'var(--blueprint-text-muted)' }}>
                                    • Single click to select • Double click to open • Shift+click for range selection
                                </div>
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
                onRecycleBinDelete={handleContextRecycleBinDelete}
                onPermanentDelete={handleContextPermanentDelete}
            />
            
            {/* Status bar */}
            <div className="status-bar">
                <span>
                    Path: {currentPath || 'Not selected'} 
                    {selectedFiles.size > 0 && ` • ${selectedFiles.size} item${selectedFiles.size === 1 ? '' : 's'} selected`}
                    {clipboardFiles.length > 0 && ` • ${clipboardFiles.length} item${clipboardFiles.length === 1 ? '' : 's'} ${clipboardOperation === 'cut' ? 'cut' : 'copied'}`}
                </span>
                <span style={{ marginLeft: 'auto' }}>
                    Blueprint File Explorer v2.1 • Built with Wails & Go
                </span>
            </div>
        </div>
    );
}
