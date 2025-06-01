import './style.css';
import { useState, useEffect, useCallback } from "preact/hooks";
import { 
    GetHomeDirectory, 
    ListDirectory, 
    NavigateToPath, 
    NavigateUp, 
    GetSystemRoots,
    GetDriveInfo,
    OpenInSystemExplorer
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

// File item component
const FileItem = ({ file, onNavigate, onDoubleClick, isLoading }) => {
    const icon = getFileIcon(file.name, file.isDir);
    const type = getFileType(file.name, file.isDir);
    
    const handleClick = () => {
        console.log('📁 Folder clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir);
        if (file.isDir && !isLoading) {
            onNavigate(file.path);
        }
    };
    
    const handleDoubleClick = () => {
        if (!file.isDir && !isLoading) {
            onDoubleClick(file);
        }
    };
    
    return (
        <div 
            className={`file-item ${isLoading ? 'disabled' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            style={{ 
                cursor: isLoading ? 'wait' : (file.isDir ? 'pointer' : 'default'),
                opacity: isLoading ? 0.7 : 1 
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
    
    // Initialize app
    useEffect(() => {
        console.log('🚀 Blueprint File Explorer initializing...');
        initializeApp();
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
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentPath]);
    
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
            setIsLoading(true);
            setError('');
            console.log('🧭 Navigating to:', path);
            
            // Add timeout to prevent hanging
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigation timeout - this folder may have permission issues or be inaccessible')), 10000);
            });
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
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
            setIsLoading(true);
            setError('');
            console.log('⬆️ Navigating up from:', currentPath);
            
            // Add timeout for navigate up as well
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigate up timeout')), 10000);
            });
            
            const navigationPromise = NavigateUp(currentPath);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
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
    
    const handleFileDoubleClick = (file) => {
        console.log('🔍 File double-clicked:', file);
        try {
            OpenInSystemExplorer(file.path);
        } catch (err) {
            console.error('❌ Error opening file:', err);
            setError('Failed to open file: ' + err.message);
        }
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
    
    return (
        <div className="file-explorer blueprint-bg">
            {/* Header */}
            <header className="app-header">
                <div className="app-title">Blueprint File Explorer</div>
                <div className="app-subtitle">Technical File System Navigator</div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {isLoading && (
                        <div className="loading-spinner"></div>
                    )}
                    <span className="text-technical">
                        {directoryContents ? 
                            `${filterFiles(directoryContents.directories).length} dirs • ${filterFiles(directoryContents.files).length} files${!showHiddenFiles ? ' (hidden filtered)' : ''}` : 
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
                    <div className="file-list custom-scrollbar">
                        {isLoading ? (
                            <div className="loading-overlay">
                                <div style={{ textAlign: 'center' }}>
                                    <div className="loading-spinner" style={{ width: '32px', height: '32px', marginBottom: '16px' }}></div>
                                    <div className="text-technical">Loading directory...</div>
                                </div>
                            </div>
                        ) : directoryContents ? (
                            <>
                                {/* Directories first */}
                                {filterFiles(directoryContents.directories).map((dir) => (
                                    <FileItem
                                        key={dir.path}
                                        file={dir}
                                        onNavigate={navigateToPath}
                                        onDoubleClick={handleFileDoubleClick}
                                        isLoading={isLoading}
                                    />
                                ))}
                                
                                {/* Then files */}
                                {filterFiles(directoryContents.files).map((file) => (
                                    <FileItem
                                        key={file.path}
                                        file={file}
                                        onNavigate={navigateToPath}
                                        onDoubleClick={handleFileDoubleClick}
                                        isLoading={isLoading}
                                    />
                                ))}
                                
                                {/* Empty directory message */}
                                {filterFiles(directoryContents.directories).length === 0 && filterFiles(directoryContents.files).length === 0 && (
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
                            </div>
                        )}
                    </div>
                </div>
            </div>
            
            {/* Status bar */}
            <div className="status-bar">
                <span>
                    Path: {currentPath || 'Not selected'}
                </span>
                <span style={{ marginLeft: 'auto' }}>
                    Blueprint File Explorer v2.0 • Built with Wails & Go
                </span>
            </div>
        </div>
    );
}
