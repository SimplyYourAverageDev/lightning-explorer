import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from "preact/hooks";
import { memo } from "preact/compat";
import { FileItem } from "./FileItem";
import { InlineFolderEditor } from "./InlineFolderEditor";
import { rafThrottle } from "../utils/debounce";
import { log } from "../utils/logger";
import { 
    EMPTY_DIRECTORY_STYLE, 
    LARGE_ICON_STYLE,
    FLEX_COLUMN_STYLE,
    FLEX_CENTER_STYLE
} from "../utils/styleConstants";

// Virtual scrolling configuration
const ITEM_HEIGHT = 48; // Height of each file item in pixels
const BUFFER_SIZE = 5; // Number of items to render outside visible area
const CONTAINER_HEIGHT = 400; // Default container height

// Pre-compiled styles for optimal performance
const CONTAINER_STYLE = {
    overflowY: 'auto',
    overflowX: 'hidden',
    position: 'relative'
};

const VIRTUAL_CONTAINER_STYLE = {
    position: 'relative'
};

const VIRTUAL_ITEM_STYLE_BASE = {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ITEM_HEIGHT
};

const EMPTY_STATE_CONTAINER_STYLE = {
    ...FLEX_COLUMN_STYLE,
    ...FLEX_CENTER_STYLE,
    height: '100%',
    color: 'var(--blueprint-text-muted)'
};

const VirtualizedFileList = memo(({ 
    files, 
    selectedFiles,
    onFileSelect,
    onFileOpen,
    onContextMenu,
    isLoading,
    clipboardFiles,
    clipboardOperation,
    containerHeight,
    dragState,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    // Folder creation props
    creatingFolder,
    tempFolderName,
    editInputRef,
    onFolderKeyDown,
    onFolderInputChange,
    onFolderInputBlur,
    // Empty space context menu props
    onEmptySpaceContextMenu
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [measuredHeight, setMeasuredHeight] = useState(CONTAINER_HEIGHT);
    const containerRef = useRef(null);
    
    // Measure container height once with useLayoutEffect
    useLayoutEffect(() => {
        if (containerRef.current) {
            const height = containerRef.current.clientHeight;
            if (height !== measuredHeight) {
                setMeasuredHeight(height);
                log('📏 VirtualizedFileList: Measured container height:', height);
            }
        }
    }, [measuredHeight]);
    
    // Calculate visible range - memoized for performance
    const visibleRange = useMemo(() => {
        const effectiveHeight = containerHeight || measuredHeight;
        const visibleStart = Math.floor(scrollTop / ITEM_HEIGHT);
        const visibleEnd = Math.min(
            files.length - 1,
            Math.ceil((scrollTop + effectiveHeight) / ITEM_HEIGHT)
        );
        
        // Add buffer for smooth scrolling
        const startIndex = Math.max(0, visibleStart - BUFFER_SIZE);
        const endIndex = Math.min(files.length - 1, visibleEnd + BUFFER_SIZE);
        
        return { startIndex, endIndex, visibleStart, visibleEnd };
    }, [scrollTop, containerHeight, measuredHeight, files.length]);
    
    // Get visible items
    const visibleItems = useMemo(() => {
        const { startIndex, endIndex } = visibleRange;
        return files.slice(startIndex, endIndex + 1).map((file, index) => ({
            file,
            index: startIndex + index,
            offsetTop: (startIndex + index) * ITEM_HEIGHT
        }));
    }, [files, visibleRange]);
    
    // RAF-throttled scroll handler for smooth performance
    const handleScroll = useCallback(rafThrottle((event) => {
        // Use requestAnimationFrame to batch layout reads
        requestAnimationFrame(() => {
            const newScrollTop = event.target.scrollTop;
            setScrollTop(newScrollTop);
        });
    }), []);
    
    // Scroll to item (for keyboard navigation) - optimized with measured height
    const scrollToItem = useCallback((index) => {
        if (containerRef.current) {
            const effectiveHeight = containerHeight || measuredHeight;
            const targetScrollTop = index * ITEM_HEIGHT;
            const containerScrollTop = containerRef.current.scrollTop;
            const containerBottom = containerScrollTop + effectiveHeight;
            
            // Only scroll if item is not visible
            if (targetScrollTop < containerScrollTop) {
                containerRef.current.scrollTop = targetScrollTop;
            } else if (targetScrollTop + ITEM_HEIGHT > containerBottom) {
                containerRef.current.scrollTop = targetScrollTop - effectiveHeight + ITEM_HEIGHT;
            }
        }
    }, [containerHeight, measuredHeight]);
    
    // Total height for scrollbar (including inline folder editor if creating)
    const totalHeight = (files.length + (creatingFolder ? 1 : 0)) * ITEM_HEIGHT;
    
        // Optimize file item click handlers - Fixed to prevent double-opens
    const handleFileClick = useCallback((fileIndex, event) => {
        // Always handle selection for virtualized list - FileItem will handle opening logic
        onFileSelect(fileIndex, event.shiftKey, event.ctrlKey || event.metaKey);
        
        // Scroll to item if needed
        if (event.shiftKey || event.ctrlKey || event.metaKey) {
            scrollToItem(fileIndex);
        }
    }, [onFileSelect, scrollToItem]);

    const handleFileDoubleClick = useCallback((file) => {
        onFileOpen(file);
    }, [onFileOpen]);
    
    const handleFileContextMenu = useCallback((event, file) => {
        onContextMenu(event, file);
    }, [onContextMenu]);
    
    // Compute container style once
    const containerStyle = useMemo(() => ({
        ...CONTAINER_STYLE,
        height: containerHeight || '100%'
    }), [containerHeight]);
    
    // Compute virtual container style once
    const virtualContainerStyle = useMemo(() => ({
        ...VIRTUAL_CONTAINER_STYLE,
        height: totalHeight
    }), [totalHeight]);

    return (
        <div 
            ref={containerRef}
            className="virtualized-file-list custom-scrollbar"
            style={containerStyle}
            onScroll={handleScroll}
            onContextMenu={(e) => {
                // Check if right-clicking on empty space in virtual list
                if (e.target === e.currentTarget || !e.target.closest('.file-item')) {
                    e.preventDefault();
                    if (onEmptySpaceContextMenu) {
                        onEmptySpaceContextMenu(e);
                    }
                }
            }}
        >
            {/* Virtual container with total height */}
            <div style={virtualContainerStyle}>
                {/* Show inline folder editor if creating folder */}
                {creatingFolder && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: ITEM_HEIGHT
                    }}>
                        <InlineFolderEditor
                            tempFolderName={tempFolderName}
                            editInputRef={editInputRef}
                            onKeyDown={onFolderKeyDown}
                            onChange={onFolderInputChange}
                            onBlur={onFolderInputBlur}
                        />
                    </div>
                )}
                
                {/* Render only visible items */}
                {visibleItems.map(({ file, index, offsetTop }) => {
                    // Compute item style once per item (offset by folder editor if creating)
                    const itemStyle = useMemo(() => ({
                        ...VIRTUAL_ITEM_STYLE_BASE,
                        top: offsetTop + (creatingFolder ? ITEM_HEIGHT : 0)
                    }), [offsetTop, creatingFolder]);
                    
                    return (
                        <div
                            key={`${file.path}-${index}`}
                            style={itemStyle}
                        >
                            <FileItem
                                file={file}
                                fileIndex={index}
                                onSelect={handleFileClick}
                                onOpen={handleFileDoubleClick}
                                onContextMenu={handleFileContextMenu}
                                isLoading={isLoading}
                                isSelected={selectedFiles.has(index)}
                                isCut={clipboardOperation === 'cut' && clipboardFiles.includes(file.path)}
                                isDragOver={dragState?.dragOverFolder === file.path}
                                onDragStart={onDragStart}
                                onDragOver={onDragOver}
                                onDragEnter={onDragEnter}
                                onDragLeave={onDragLeave}
                                onDrop={onDrop}
                            />
                        </div>
                    );
                })}
            </div>
            
            {/* Empty state */}
            {files.length === 0 && !creatingFolder && (
                <div style={EMPTY_STATE_CONTAINER_STYLE}>
                    <div style={LARGE_ICON_STYLE}>📁</div>
                    <div className="text-technical">Directory is empty</div>
                </div>
            )}
        </div>
    );
});

export { VirtualizedFileList }; 