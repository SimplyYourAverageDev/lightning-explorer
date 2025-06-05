import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import { memo } from "preact/compat";
import { GetHomeDirectory } from "../../wailsjs/go/backend/App";

// Memoized Sidebar component
const Sidebar = memo(({ currentPath, onNavigate, drives = [], onDriveExpand }) => {
    const [homeDir, setHomeDir] = useState('');
    const [drivesExpanded, setDrivesExpanded] = useState(false);
    const [loadingDrives, setLoadingDrives] = useState(false);
    
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
                        <span className="sidebar-icon">{item.icon}</span>
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
                    <span style={{ fontSize: '0.8rem' }}>
                        {loadingDrives ? '⏳' : (drivesExpanded ? '▼' : '▶')}
                    </span>
                </div>
                {drivesExpanded && drives.length > 0 && (
                    drives.map((drive) => (
                        <div 
                            key={drive.path}
                            className={`sidebar-item ${currentPath === drive.path ? 'active' : ''}`}
                            onClick={() => handleDriveClick(drive.path)}
                        >
                            <span className="sidebar-icon">💽</span>
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