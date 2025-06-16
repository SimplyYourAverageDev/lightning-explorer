import { useMemo, useCallback, useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";
import { getFileIcon, getFileType, getFileIconType } from "../utils/fileUtils.js";
import { log, error } from "../utils/logger";
import { serializationUtils } from "../utils/serialization";

// Local utility functions (moved from formatUtils)
const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const formatFileSize = (size) => {
    // Handle edge cases: undefined, null, or negative sizes
    if (size === undefined || size === null || size < 0) {
        return "0 B";
    }
    
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

// Memoized File item component
const FileItem = memo(({ 
    file, 
    onSelect, 
    onOpen, 
    isLoading, 
    isSelected, 
    fileIndex, 
    isCut, 
    onContextMenu, 
    onDragStart, 
    onDragOver, 
    onDragEnter, 
    onDragLeave, 
    onDrop, 
    isDragOver,
    isInspectMode = false

}) => {
    // Get the Phosphor Icon component for this file
    const IconComponent = useMemo(() => getFileIcon(file.name, file.isDir), [file.name, file.isDir]);
    const type = useMemo(() => getFileType(file.name, file.isDir), [file.name, file.isDir]);
    const iconType = useMemo(() => getFileIconType(file.name, file.isDir), [file.name, file.isDir]);
    
    // Memoize formatted file metadata
    const formattedDate = useMemo(() => formatDate(file.modTime), [file.modTime]);
    const formattedSize = useMemo(() => formatFileSize(file.size), [file.size]);
    
    // Refs for click timing and debouncing
    const clickTimeoutRef = useRef(null);
    const lastOpenTimeRef = useRef(0);
    const clickCountRef = useRef(0);
    
    // Configuration for click timing - Made configurable for performance tuning
    const INSTANT_MODE = false; // Set to true for zero-latency mode (disables double-click protection)
    const DOUBLE_CLICK_DELAY = INSTANT_MODE ? 0 : 300; // ms to wait for potential double-click (Windows standard)
    const OPEN_COOLDOWN = INSTANT_MODE ? 100 : 500; // ms cooldown between opens to prevent rapid-fire
    const PERFORMANCE_LOGGING = false; // Set to true to enable performance logs

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
        };
    }, []);

    // Optimized click handler with configurable timing
    const handleClick = useCallback((e) => {
        if (isInspectMode) {
            return; // Let parent handle inspect mode clicks
        }
        
        e.stopPropagation();
        
        const now = Date.now();
        const timeSinceLastOpen = now - lastOpenTimeRef.current;
        
        // Prevent rapid-fire opens during cooldown period
        if (timeSinceLastOpen < OPEN_COOLDOWN) {
            if (PERFORMANCE_LOGGING) {
                log(`⏱️ Click ignored - cooldown active (${timeSinceLastOpen}ms < ${OPEN_COOLDOWN}ms)`);
            }
            return;
        }
        
        clickCountRef.current++;
        
        // Instant mode bypasses double-click detection
        if (INSTANT_MODE) {
            handleSingleClick();
            return;
        }
        
        // Clear any existing timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
        }
        
        // Set timeout for single-click action
        clickTimeoutRef.current = setTimeout(() => {
            if (clickCountRef.current === 1) {
                handleSingleClick();
            }
            clickCountRef.current = 0;
        }, DOUBLE_CLICK_DELAY);
        
    }, [onSelect, fileIndex, isInspectMode]);

    const handleSingleClick = useCallback(() => {
        if (PERFORMANCE_LOGGING) {
            log(`👆 Single click detected on: ${file.name}`);
        }
        onSelect(fileIndex);
    }, [onSelect, fileIndex, file.name]);

    // Double-click handler for file opening
    const handleDoubleClick = useCallback((e) => {
        if (isInspectMode) {
            return; // Let parent handle inspect mode clicks
        }
        
        e.stopPropagation();
        
        const now = Date.now();
        const timeSinceLastOpen = now - lastOpenTimeRef.current;
        
        // Prevent rapid-fire opens
        if (timeSinceLastOpen < OPEN_COOLDOWN) {
            if (PERFORMANCE_LOGGING) {
                log(`⏱️ Double-click ignored - cooldown active (${timeSinceLastOpen}ms < ${OPEN_COOLDOWN}ms)`);
            }
            return;
        }
        
        // Clear single-click timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
        }
        
        clickCountRef.current = 0;
        lastOpenTimeRef.current = now;
        
        if (PERFORMANCE_LOGGING) {
            log(`👆👆 Double click detected on: ${file.name}`);
        }
        
        onOpen(file);
    }, [onOpen, file, isInspectMode]);

    // Context menu handler
    const handleContextMenu = useCallback((e) => {
        if (isInspectMode) {
            return; // Let parent handle inspect mode
        }
        
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e, file, fileIndex);
    }, [onContextMenu, file, fileIndex, isInspectMode]);

    // Drag handlers
    const handleDragStart = useCallback((e) => {
        if (isInspectMode) {
            e.preventDefault();
            return;
        }
        
        onDragStart && onDragStart(e, file, fileIndex);
    }, [onDragStart, file, fileIndex, isInspectMode]);

    const handleDragOver = useCallback((e) => {
        if (!file.isDir || isInspectMode) return;
        onDragOver && onDragOver(e, file);
    }, [onDragOver, file, isInspectMode]);

    const handleDragEnter = useCallback((e) => {
        if (!file.isDir || isInspectMode) return;
        onDragEnter && onDragEnter(e, file);
    }, [onDragEnter, file, isInspectMode]);

    const handleDragLeave = useCallback((e) => {
        if (!file.isDir || isInspectMode) return;
        onDragLeave && onDragLeave(e, file);
    }, [onDragLeave, file, isInspectMode]);

    const handleDrop = useCallback((e) => {
        if (!file.isDir || isInspectMode) return;
        onDrop && onDrop(e, file);
    }, [onDrop, file, isInspectMode]);

    // Compute CSS classes
    const itemClasses = `file-item ${isSelected ? 'selected' : ''} ${isCut ? 'cut' : ''} ${isDragOver ? 'drag-over' : ''}`;

    if (isLoading) {
        return (
            <div className="file-item loading">
                <div className="file-icon skeleton"></div>
                <div className="file-details">
                    <div className="file-name skeleton"></div>
                    <div className="file-meta skeleton"></div>
                </div>
            </div>
        );
    }

    return (
        <div 
            className={itemClasses}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            draggable={!isInspectMode}
            data-file-index={fileIndex}
            data-file-name={file.name}
            data-file-type={type}
        >
            <div className={`file-icon ${iconType}`}>
                <IconComponent 
                    size={20}
                    weight="regular"
                    className="phosphor-icon"
                />
            </div>
            <div className="file-details">
                <div className="file-name" title={file.name}>
                    {file.name}
                </div>
                <div className="file-meta">
                    {file.isDir ? 'Folder' : `${formattedSize} • ${formattedDate}`}
                </div>
            </div>
        </div>
    );
});

FileItem.displayName = 'FileItem';

export { FileItem }; 