import { memo, useMemo, useCallback, useState } from "preact/compat";
import { BreadcrumbContextMenu } from "./BreadcrumbContextMenu";
import { schedulePrefetch } from "../utils/prefetch.js";

// Memoized Breadcrumb component with drag and drop support
const Breadcrumb = memo(({ 
    currentPath, 
    onNavigate,
    // Drag and drop props
    dragState,
    onDragOver,
    onDragEnter, 
    onDragLeave,
    onDrop
}) => {
    const [dragOverSegment, setDragOverSegment] = useState(null);
    const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, path: '' });
    
    const segments = useMemo(() => {
        if (!currentPath) return [];
        
        // Windows paths like "C:\Users\username"
        const parts = currentPath.split(/[\\]/);
        return parts.filter(Boolean);
    }, [currentPath]);
    
    const handleSegmentClick = useCallback((index) => {
        // Don't navigate if dragging
        if (dragState?.isDragging) return;
        
        // Build Windows path from segments
        const pathSegments = segments.slice(0, index + 1);
        let newPath = pathSegments.join('\\');
        
        // Add trailing backslash for drive roots
        if (index === 0 && pathSegments[0].includes(':')) {
            newPath += '\\';
        }
        
        onNavigate(newPath);
    }, [segments, onNavigate, dragState?.isDragging]);

    const getSegmentPath = useCallback((index) => {
        const pathSegments = segments.slice(0, index + 1);
        let p = pathSegments.join('\\');
        if (index === 0 && pathSegments[0].includes(':')) p += '\\';
        return p;
    }, [segments]);

    const handleSegmentContextMenu = useCallback((e, index) => {
        e.preventDefault();
        e.stopPropagation();
        const path = getSegmentPath(index);
        // Pre-clamp roughly
        const pad = 8; const vw = window.innerWidth; const vh = window.innerHeight;
        const approxW = 220; const approxH = 60;
        const nx = Math.max(pad, Math.min(e.clientX, vw - pad - approxW));
        const ny = Math.max(pad, Math.min(e.clientY, vh - pad - approxH));
        setMenu({ visible: true, x: nx, y: ny, path });
    }, [getSegmentPath]);

    const closeMenu = useCallback(() => setMenu({ visible: false, x: 0, y: 0, path: '' }), []);

    const handleCopyPath = useCallback(async (path) => {
        const text = `"${path}"`;
        try {
            const { CopyTextToClipboard } = await import('../../wailsjs/go/backend/App');
            await CopyTextToClipboard(text);
        } catch (_) {
            try { await navigator.clipboard.writeText(text); } catch (_) {}
        }
        closeMenu();
    }, [closeMenu]);
    
    // Create virtual folder objects for each breadcrumb segment
    const getSegmentFolder = useCallback((index) => {
        const pathSegments = segments.slice(0, index + 1);
        let segmentPath = pathSegments.join('\\');
        
        // Add trailing backslash for drive roots
        if (index === 0 && pathSegments[0].includes(':')) {
            segmentPath += '\\';
        }
        
        return {
            name: segments[index],
            path: segmentPath,
            isDir: true
        };
    }, [segments]);
    
    // Drag over handler for breadcrumb segments
    const handleBreadcrumbDragOver = useCallback((event, index) => {
        if (!dragState?.isDragging) return;
        
        // Don't allow dropping on current directory
        const segmentFolder = getSegmentFolder(index);
        if (segmentFolder.path === currentPath) {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'none';
            return;
        }
        
        event.preventDefault();
        const operation = event.ctrlKey ? 'copy' : 'move';
        event.dataTransfer.dropEffect = operation;
        
        if (onDragOver) {
            onDragOver(event, segmentFolder);
        }
    }, [dragState?.isDragging, getSegmentFolder, currentPath, onDragOver]);
    
    // Drag enter handler for breadcrumb segments
    const handleBreadcrumbDragEnter = useCallback((event, index) => {
        if (!dragState?.isDragging) return;
        
        const segmentFolder = getSegmentFolder(index);
        
        // Don't allow dropping on current directory
        if (segmentFolder.path === currentPath) return;
        
        event.preventDefault();
        setDragOverSegment(index);
        
        if (onDragEnter) {
            onDragEnter(event, segmentFolder);
        }
    }, [dragState?.isDragging, getSegmentFolder, currentPath, onDragEnter]);
    
    // Drag leave handler for breadcrumb segments  
    const handleBreadcrumbDragLeave = useCallback((event, index) => {
        if (!dragState?.isDragging) return;
        
        const segmentFolder = getSegmentFolder(index);
        
        // Don't allow dropping on current directory
        if (segmentFolder.path === currentPath) return;
        
        // Clear drag over state
        setDragOverSegment(null);
        
        if (onDragLeave) {
            onDragLeave(event, segmentFolder);
        }
    }, [dragState?.isDragging, getSegmentFolder, currentPath, onDragLeave]);
    
    // Drop handler for breadcrumb segments
    const handleBreadcrumbDrop = useCallback((event, index) => {
        if (!dragState?.isDragging) return;
        
        const segmentFolder = getSegmentFolder(index);
        
        // Don't allow dropping on current directory
        if (segmentFolder.path === currentPath) {
            event.preventDefault();
            return;
        }
        
        event.preventDefault();
        setDragOverSegment(null);
        
        if (onDrop) {
            onDrop(event, segmentFolder, null);
        }
    }, [dragState?.isDragging, getSegmentFolder, currentPath, onDrop]);
    
    if (!segments.length) return null;
    
    return (
        <div className="nav-breadcrumb custom-scrollbar" onSelectStart={(e) => e.preventDefault()}>
            {segments.map((segment, index) => {
                const isCurrentPath = index === segments.length - 1;
                const isDragOver = dragOverSegment === index;
                const canDrop = dragState?.isDragging && !isCurrentPath;
                
                return (
                    <div key={index} className="breadcrumb-segment-wrapper">
                        {index > 0 && <span className="separator">{'/'}</span>}
                        <span 
                            className={`nav-segment ${isCurrentPath ? 'current' : ''} ${isDragOver ? 'drag-over' : ''} ${canDrop ? 'drop-target' : ''}`}
                            onClick={() => handleSegmentClick(index)}
                            onContextMenu={(e) => handleSegmentContextMenu(e, index)}
                            onMouseEnter={() => {
                                const segmentFolder = getSegmentFolder(index);
                                schedulePrefetch(segmentFolder.path);
                            }}
                            title={segment}
                            onDragOver={(e) => handleBreadcrumbDragOver(e, index)}
                            onDragEnter={(e) => handleBreadcrumbDragEnter(e, index)}
                            onDragLeave={(e) => handleBreadcrumbDragLeave(e, index)}
                            onDrop={(e) => handleBreadcrumbDrop(e, index)}
                            style={{
                                cursor: dragState?.isDragging ? (canDrop ? 'copy' : 'not-allowed') : 'pointer'
                            }}
                        >
                            {segment}
                        </span>
                    </div>
                );
            })}
            {/* Breadcrumb context menu */}
            <BreadcrumbContextMenu
                visible={menu.visible}
                x={menu.x}
                y={menu.y}
                path={menu.path}
                onClose={closeMenu}
                onCopy={handleCopyPath}
            />
        </div>
    );
});

export { Breadcrumb };
export default Breadcrumb; 
