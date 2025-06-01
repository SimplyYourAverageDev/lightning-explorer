import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import { memo } from "preact/compat";
import { GetHomeDirectory } from "../../wailsjs/go/backend/App";

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

export { Sidebar };
export default Sidebar; 