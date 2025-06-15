import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import { memo } from "preact/compat";

// Memoized Sidebar component
const Sidebar = memo(({ currentPath, onNavigate, drives = [], onDriveExpand, onDriveContextMenu }) => {
    const [homeDir, setHomeDir] = useState('');
    const [drivesExpanded, setDrivesExpanded] = useState(false);
    const [loadingDrives, setLoadingDrives] = useState(false);
    
    useEffect(() => {
        // Get home directory using backend API, imported only when needed
        const getHomeDir = async () => {
            try {
                const { GetHomeDirectory } = await import('../../wailsjs/go/backend/App');
                const home = await GetHomeDirectory();
                setHomeDir(home);
            } catch (err) {
                console.error('Failed to get home directory:', err);
            }
        };
        
        getHomeDir();
    }, []);
    
    // Use proper path separators for the current OS
    const pathSep = homeDir.includes('\\') ? '\\' : '/';
    
    const quickAccess = useMemo(() => [
        { name: 'Home', path: homeDir },
        { name: 'Desktop', path: homeDir + pathSep + 'Desktop' },
        { name: 'Documents', path: homeDir + pathSep + 'Documents' },
        { name: 'Downloads', path: homeDir + pathSep + 'Downloads' },
    ].filter(item => item.path), [homeDir, pathSep]);
    
    const handleQuickAccessClick = useCallback((path) => {
        onNavigate(path);
    }, [onNavigate]);
    
    const handleDriveClick = useCallback((path) => {
        onNavigate(path);
    }, [onNavigate]);
    
    const handleDriveExpand = useCallback(async () => {
        if (!drivesExpanded && onDriveExpand) {
            setLoadingDrives(true);
            try {
                await onDriveExpand();
            } finally {
                setLoadingDrives(false);
            }
        }
        setDrivesExpanded(!drivesExpanded);
    }, [drivesExpanded, onDriveExpand]);
    
    return (
        <div className="sidebar" onSelectStart={(e) => e.preventDefault()}>
            <div className="sidebar-section">
                <div className="sidebar-title">Quick Access</div>
                {quickAccess.map((item) => (
                    <div 
                        key={item.path}
                        className={`sidebar-item ${currentPath === item.path ? 'active' : ''}`}
                        onClick={() => handleQuickAccessClick(item.path)}
                    >
                        {item.name}
                    </div>
                ))}
            </div>
            
            {/* Lazy-loaded drives section */}
            <div className="sidebar-section">
                <div 
                    className="sidebar-title sidebar-expandable"
                    onClick={handleDriveExpand}
                    style={{
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    Drives
                    <span style={{ fontSize: 'var(--font-sm)' }}>
                        {loadingDrives ? '...' : (drivesExpanded ? '▼' : '▶')}
                    </span>
                </div>
                {drivesExpanded && drives.length > 0 && (
                    drives.map((drive) => (
                        <div 
                            key={drive.path}
                            className={`sidebar-item ${currentPath === drive.path ? 'active' : ''}`}
                            onClick={() => handleDriveClick(drive.path)}
                            onContextMenu={(e) => {
                                if (onDriveContextMenu) {
                                    onDriveContextMenu(e, drive);
                                }
                            }}
                        >
                            {drive.name}
                        </div>
                    ))
                )}
                {drivesExpanded && drives.length === 0 && !loadingDrives && (
                    <div className="sidebar-item disabled" style={{ color: '#666', fontStyle: 'italic' }}>
                        No drives found
                    </div>
                )}
            </div>
        </div>
    );
});

export { Sidebar };
export default Sidebar; 