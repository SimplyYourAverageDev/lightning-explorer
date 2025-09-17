import { useState, useEffect, useCallback } from "preact/hooks";
import { memo } from "preact/compat";
import { log } from "../utils/logger";
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
    SpinnerIcon,
    PushPinIcon,
} from '@phosphor-icons/react';
import { schedulePrefetch } from "../utils/prefetch.js";
import { serializationUtils, EnhancedAPI } from "../utils/serialization";

const QUICK_ACCESS_ICON_MAP = new Map([
	["home", HouseIcon],
	["desktop", DesktopIcon],
	["documents", FolderIcon],
	["downloads", DownloadIcon],
	["music", MusicNotesIcon],
	["pictures", ImageIcon],
	["videos", HardDriveIcon],
	["program files", HardDriveIcon],
	["program files (x86)", HardDriveIcon],
	["windows", HardDriveIcon],
]);

const resolveQuickAccessIcon = (name = "", path = "") => {
	const key = name.toLowerCase();
	if (QUICK_ACCESS_ICON_MAP.has(key)) {
		return QUICK_ACCESS_ICON_MAP.get(key);
	}
	if (path.toLowerCase().includes("desktop")) return DesktopIcon;
	if (path.toLowerCase().includes("download")) return DownloadIcon;
	return FolderIcon;
};

// Memoized Sidebar component
const Sidebar = memo(({
    currentPath,
    onNavigate,
    drives = [],
    onDriveExpand,
    onDriveContextMenu,
    // Pinned folder props
    pinnedFolders = [],
    onPinnedItemContextMenu,
    onSidebarDrop,
    onSidebarDragOver,
    onSidebarDragEnter,
    onSidebarDragLeave,
    isQuickAccessDragOver,
}) => {
    // Final list of Quick Access items (after filtering out non-existent folders)
    const [quickAccessItems, setQuickAccessItems] = useState([]);
    const [drivesExpanded, setDrivesExpanded] = useState(false);
    const [loadingDrives, setLoadingDrives] = useState(false);
    
	// Build Quick Access list via backend API (optimized messagepack path with fallback)
	useEffect(() => {
		let cancelled = false;

		const legacyBuild = async () => {
			try {
				const { GetHomeDirectory, FileExists } = await import('../../wailsjs/go/backend/App');
				const homeDir = await GetHomeDirectory();
				if (!homeDir || cancelled) return;

				const pathSep = homeDir.includes('\\') ? '\\' : '/';
				const candidates = [
					{ name: 'Home', path: homeDir },
					{ name: 'Desktop', path: `${homeDir}${pathSep}Desktop` },
					{ name: 'Documents', path: `${homeDir}${pathSep}Documents` },
					{ name: 'Downloads', path: `${homeDir}${pathSep}Downloads` },
					{ name: 'Music', path: `${homeDir}${pathSep}Music` },
					{ name: 'Pictures', path: `${homeDir}${pathSep}Pictures` },
				];

				const filtered = [];
				for (const item of candidates) {
					try {
						const exists = await FileExists(item.path);
						if (exists) {
							filtered.push({
								path: item.path,
								name: item.name,
								icon: resolveQuickAccessIcon(item.name, item.path),
							});
						}
					} catch {
						// ignore failures in fallback path
					}
				}

				if (!cancelled) {
					const unique = new Map();
					for (const item of filtered) {
						if (!unique.has(item.path)) {
							unique.set(item.path, item);
						}
					}
					setQuickAccessItems([...unique.values()]);
				}
			} catch (err) {
				console.error('Legacy quick access build failed:', err);
			}
		};

		const buildQuickAccess = async () => {
			try {
				const wailsAPI = await import('../../wailsjs/go/backend/App');
				let items = [];
				try {
					const enhancedAPI = new EnhancedAPI(wailsAPI, serializationUtils);
					const result = await enhancedAPI.getQuickAccessPaths();
					if (Array.isArray(result)) {
						items = result;
					}
				} catch (enhancedErr) {
					if (wailsAPI.GetQuickAccessPaths) {
						const fallback = await wailsAPI.GetQuickAccessPaths();
						if (Array.isArray(fallback)) {
							items = fallback;
						}
					} else {
						throw enhancedErr;
					}
				}

				if (cancelled) {
					return;
				}

				if (!Array.isArray(items)) {
					items = [];
				}

				const normalized = items
					.map((item) => {
						const path = item?.path || item?.Path || '';
						if (!path) return null;
						const name = item?.name || item?.Name || (path.split(/[\\/]/).pop() || path);
						const IconComponent = resolveQuickAccessIcon(name, path);
						return { path, name, icon: IconComponent };
					})
					.filter(Boolean);

				const unique = new Map();
				for (const item of normalized) {
					if (!unique.has(item.path)) {
						unique.set(item.path, item);
					}
				}

				setQuickAccessItems([...unique.values()]);
			} catch (err) {
				console.error('Failed to build quick access list via backend:', err);
				if (!cancelled) {
					legacyBuild();
				}
			}
		};

		buildQuickAccess();

		return () => {
			cancelled = true;
		};
	}, []);
    
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
            <div
                className={`sidebar-section ${isQuickAccessDragOver ? 'drag-over' : ''}`}
                onDrop={(e) => {
                    log('🔗 Sidebar onDrop triggered (before handler)');
                    e.preventDefault();
                    e.stopPropagation();
                    onSidebarDrop(e);
                    log('🔗 Sidebar onDrop handler completed');
                }}
                onDropCapture={(e) => {
                    log('🔗 Sidebar onDropCapture triggered');
                }}
                onDragOver={(e) => {
                    log('🔗 Sidebar onDragOver triggered');
                    onSidebarDragOver(e);
                }}
                onDragEnter={(e) => {
                    log('🔗 Sidebar onDragEnter triggered');
                    onSidebarDragEnter(e);
                }}
                onDragLeave={(e) => {
                    log('🔗 Sidebar onDragLeave triggered');
                    onSidebarDragLeave(e);
                }}
            >
                <div className="sidebar-title">Quick Access</div>
                {quickAccessItems.map((item) => (
                    <div
                        key={item.path}
                        className={`sidebar-item ${currentPath === item.path ? 'active' : ''}`}
                        onClick={() => handleQuickAccessClick(item.path)}
                        onMouseEnter={() => schedulePrefetch(item.path)}
                        title={item.path}
                    >
                        <item.icon size={16} weight="bold" className="sidebar-icon" />
                        {item.name}
                    </div>
                ))}
                {/* Render pinned folders */}
                {pinnedFolders.map((path) => {
                    // Derive name from path
                    const name = path.split(/[\\/]/).pop() || path;
                    return (
                        <div
                            key={path}
                            className={`sidebar-item ${currentPath === path ? 'active' : ''}`}
                            onClick={() => handleQuickAccessClick(path)}
                            onContextMenu={(e) => onPinnedItemContextMenu && onPinnedItemContextMenu(e, path)}
                            onMouseEnter={() => schedulePrefetch(path)}
                            title={path}
                        >
                            <PushPinIcon size={16} weight="bold" className="sidebar-icon" />
                            {name}
                        </div>
                    )
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
                            className={`sidebar-item ${currentPath.toLowerCase().startsWith(drive.path.toLowerCase()) ? 'active' : ''}`}
                            onClick={() => handleDriveClick(drive.path)}
                            onMouseEnter={() => schedulePrefetch(drive.path)}
                            onContextMenu={(e) => {
                                e.preventDefault();
                                onDriveContextMenu(e, drive);
                            }}
                        >
                            <HardDriveIcon size={16} weight="bold" className="sidebar-icon" />
                            <span style={{flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'}} title={drive.path}>{drive.name}</span>
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
