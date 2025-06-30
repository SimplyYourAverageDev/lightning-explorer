import { useMemo, useCallback, useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";
import { getFileIcon, getFileType, getFileIconType } from "../utils/fileUtils.js";
import { log, error } from "../utils/logger";
import { serializationUtils } from "../utils/serialization";
import { schedulePrefetch } from "../utils/prefetch.js";

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

// Cache for formatted dates and sizes to avoid repeated calculations
const formatCache = new Map();
const MAX_CACHE_SIZE = 1000;

const getCachedFormat = (key, value, formatter) => {
    const cacheKey = `${key}:${value}`;
    if (formatCache.has(cacheKey)) {
        return formatCache.get(cacheKey);
    }
    
    const formatted = formatter(value);
    
    // Limit cache size
    if (formatCache.size >= MAX_CACHE_SIZE) {
        const firstKey = formatCache.keys().next().value;
        formatCache.delete(firstKey);
    }
    
    formatCache.set(cacheKey, formatted);
    return formatted;
};

// Optimized comparison function for memo
const areEqual = (prevProps, nextProps) => {
    // Fast path: if references are the same, props haven't changed
    if (prevProps === nextProps) return true;
    
    // Check only the props that would cause a visual change
    return (
        prevProps.file.path === nextProps.file.path &&
        prevProps.file.name === nextProps.file.name &&
        prevProps.file.isDir === nextProps.file.isDir &&
        prevProps.file.size === nextProps.file.size &&
        prevProps.file.modTime === nextProps.file.modTime &&
        prevProps.isSelected === nextProps.isSelected &&
        prevProps.isCut === nextProps.isCut &&
        prevProps.isDragOver === nextProps.isDragOver &&
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.fileIndex === nextProps.fileIndex &&
        prevProps.isInspectMode === nextProps.isInspectMode
    );
};

// Memoized File item component with custom comparison
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
    
    // Use cached formatting for better performance
    const formattedDate = useMemo(() => 
        getCachedFormat('date', file.modTime, formatDate), 
        [file.modTime]
    );
    const formattedSize = useMemo(() => 
        getCachedFormat('size', file.size, formatFileSize), 
        [file.size]
    );
    
    // Configuration for performance logging
    const PERFORMANCE_LOGGING = false; // Set to true to enable performance logs

    // Create stable event handler references
    const handlers = useMemo(() => {
        const handleClick = (e) => {
            if (isInspectMode) return;
            e.stopPropagation();
            
            if (PERFORMANCE_LOGGING) {
                log(`👆 Click detected on: ${file.name}`);
            }
            onSelect(fileIndex, e.shiftKey, e.ctrlKey);
        };

        const handleDoubleClick = (e) => {
            if (isInspectMode) return;
            e.stopPropagation();
            onOpen(file, fileIndex);
        };

        const handleContextMenu = (e) => {
            if (isInspectMode) return;
            e.preventDefault();
            e.stopPropagation();
            onContextMenu(e, file, fileIndex);
        };

        const handleDragStart = (e) => {
            if (isInspectMode) {
                e.preventDefault();
                return;
            }
            onDragStart && onDragStart(e, file, fileIndex);
        };

        const handleDragOver = (e) => {
            if (!file.isDir || isInspectMode) return;
            onDragOver && onDragOver(e, file);
        };

        const handleDragEnter = (e) => {
            if (!file.isDir || isInspectMode) return;
            onDragEnter && onDragEnter(e, file);
        };

        const handleDragLeave = (e) => {
            if (!file.isDir || isInspectMode) return;
            onDragLeave && onDragLeave(e, file);
        };

        const handleDrop = (e) => {
            if (!file.isDir || isInspectMode) return;
            onDrop && onDrop(e, file);
        };

        const handleMouseEnter = () => {
            // Only prefetch directories – files cannot be navigated into
            if (file.isDir) {
                schedulePrefetch(file.path);
            }
        };

        return {
            handleClick,
            handleDoubleClick,
            handleContextMenu,
            handleDragStart,
            handleDragOver,
            handleDragEnter,
            handleDragLeave,
            handleDrop,
            handleMouseEnter
        };
    }, [
        file, 
        fileIndex, 
        isInspectMode, 
        onSelect, 
        onOpen, 
        onContextMenu,
        onDragStart,
        onDragOver,
        onDragEnter,
        onDragLeave,
        onDrop,
        schedulePrefetch
    ]);

    // Compute CSS classes once
    const itemClasses = useMemo(() => {
        const classes = ['file-item'];
        if (isSelected) classes.push('selected');
        if (isCut) classes.push('cut');
        if (isDragOver) classes.push('drag-over');
        return classes.join(' ');
    }, [isSelected, isCut, isDragOver]);

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

    // Memoize the file meta text
    const metaText = useMemo(() => 
        file.isDir ? 'Folder' : `${formattedSize} • ${formattedDate}`,
        [file.isDir, formattedSize, formattedDate]
    );

    return (
        <div 
            className={itemClasses}
            onClick={handlers.handleClick}
            onDoubleClick={handlers.handleDoubleClick}
            onContextMenu={handlers.handleContextMenu}
            onDragStart={handlers.handleDragStart}
            onDragOver={handlers.handleDragOver}
            onDragEnter={handlers.handleDragEnter}
            onDragLeave={handlers.handleDragLeave}
            onDrop={handlers.handleDrop}
            onMouseEnter={handlers.handleMouseEnter}
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
                    {metaText}
                </div>
            </div>
        </div>
    );
}, areEqual);

FileItem.displayName = 'FileItem';

export { FileItem }; 