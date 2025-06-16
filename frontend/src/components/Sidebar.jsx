import { useState, useEffect, useMemo, useCallback } from "preact/hooks";
import { memo } from "preact/compat";
import { 
    HouseIcon, 
    FolderIcon, 
    DesktopIcon, 
    DownloadIcon, 
    MusicNotesIcon, 
    ImageIcon, 
    HardDriveIcon,
    CaretRightIcon,
    CaretDownIcon,
    SpinnerIcon
} from '@phosphor-icons/react';

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
        { name: 'Home', path: homeDir, icon: HouseIcon },
        { name: 'Desktop', path: homeDir + pathSep + 'Desktop', icon: DesktopIcon },
        { name: 'Documents', path: homeDir + pathSep + 'Documents', icon: FolderIcon },
        { name: 'Downloads', path: homeDir + pathSep + 'Downloads', icon: DownloadIcon },
        { name: 'Music', path: homeDir + pathSep + 'Music', icon: MusicNotesIcon },
        { name: 'Pictures', path: homeDir + pathSep + 'Pictures', icon: ImageIcon }
    ].filter(item => item.path), [homeDir, pathSep]);
    
    const handleQuickAccessClick = useCallback((path) => {
        onNavigate(path);
    }, [onNavigate]);
    
    const handleDriveClick = useCallback((path) => {
        onNavigate(path);
    }, [onNavigate]);
    
    const handleDriveExpand = useCallback(async () => {
        if (!drivesExpanded && !loadingDrives) {
            setLoadingDrives(true);
            await onDriveExpand();
            setLoadingDrives(false);
        }
        setDrivesExpanded(!drivesExpanded);
    }, [drivesExpanded, loadingDrives, onDriveExpand]);
    
    return (
        <div className="sidebar" onSelectStart={(e) => e.preventDefault()}>
            <div className="sidebar-section">
                <div className="sidebar-title">Quick Access</div>
                {quickAccess.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <div 
                            key={item.path}
                            className={`sidebar-item ${currentPath === item.path ? 'active' : ''}`}
                            onClick={() => handleQuickAccessClick(item.path)}
                        >
                            <IconComponent size={16} weight="bold" className="sidebar-icon" />
                            {item.name}
                        </div>
                    );
                })}
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
                        {loadingDrives ? (
                            <SpinnerIcon size={12} className="spinning" />
                        ) : drivesExpanded ? (
                            <CaretDownIcon size={12} weight="bold" />
                        ) : (
                            <CaretRightIcon size={12} weight="bold" />
                        )}
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
                            <HardDriveIcon size={16} weight="bold" className="sidebar-icon" />
                            {drive.name}
                        </div>
                    ))
                )}
                {drivesExpanded && drives.length === 0 && !loadingDrives && (
                    <div className="sidebar-item disabled" style={{ color: '#666', fontStyle: 'italic' }}>
                        <HardDriveIcon size={16} weight="regular" className="sidebar-icon" />
                        No drives found
                    </div>
                )}
            </div>
        </div>
    );
});

export { Sidebar };
export default Sidebar; 