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
    
    // Configuration for performance logging
    const PERFORMANCE_LOGGING = false; // Set to true to enable performance logs

    // Optimized click handler - simplified to only handle single clicks
    const handleClick = useCallback((e) => {
        if (isInspectMode) {
            return; // Let parent handle inspect mode clicks
        }
        
        e.stopPropagation();
        
        if (PERFORMANCE_LOGGING) {
            log(`👆 Click detected on: ${file.name}`);
        }
        onSelect(fileIndex, e.shiftKey, e.ctrlKey);
        
    }, [onSelect, fileIndex, isInspectMode, file.name]);

    // New: handle double-click (or double-tap) to open immediately
    const handleDoubleClick = useCallback((e) => {
        if (isInspectMode) return;
        e.stopPropagation();
        onOpen(file, fileIndex);
    }, [onOpen, file, fileIndex, isInspectMode]);

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