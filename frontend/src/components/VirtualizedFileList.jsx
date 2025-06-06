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

// Virtual scrolling configuration - Fixed height calculations
const ITEM_HEIGHT = 88; // Updated: 3.5rem min-height (56px) + 2rem padding (32px) = 88px total
const BUFFER_SIZE = 10; // Restored buffer for smoother scrolling
const CONTAINER_HEIGHT = 400; // Default container height

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
    onEmptySpaceContextMenu,
    // Inspect mode
    isInspectMode = false
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const [containerRect, setContainerRect] = useState({ height: CONTAINER_HEIGHT });
    const containerRef = useRef(null);
    
    // Measure container on mount and resize
    useLayoutEffect(() => {
        const measureContainer = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setContainerRect({ height: rect.height });
            }
        };
        
        measureContainer();
        
        // Add resize observer for container changes
        const resizeObserver = new ResizeObserver(measureContainer);
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }
        
        return () => resizeObserver.disconnect();
    }, []);
    
    // Calculate visible range based on scroll position
    const visibleRange = useMemo(() => {
        if (!files.length) return { startIndex: 0, endIndex: 0, visibleCount: 0 };
        
        const effectiveHeight = containerHeight || containerRect.height;
        const visibleCount = Math.ceil(effectiveHeight / ITEM_HEIGHT) + BUFFER_SIZE * 2;
        const startIndex = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
        const endIndex = Math.min(files.length - 1, startIndex + visibleCount);
        
        return { startIndex, endIndex, visibleCount };
    }, [scrollTop, containerHeight, containerRect.height, files.length]);
    
    // Get visible items with their absolute positions - Fixed positioning
    const visibleItems = useMemo(() => {
        const { startIndex, endIndex } = visibleRange;
        const items = [];
        
        for (let i = startIndex; i <= endIndex; i++) {
            if (i < files.length) {
                items.push({
                    file: files[i],
                    index: i,
                    top: (i * ITEM_HEIGHT) + (creatingFolder ? ITEM_HEIGHT : 0)
                });
            }
        }
        
        return items;
    }, [files, visibleRange, creatingFolder]);
    
    // Calculate total height for scrollbar
    const totalHeight = (files.length + (creatingFolder ? 1 : 0)) * ITEM_HEIGHT;
    
    // Simple and reliable scroll handler
    const handleScroll = useCallback(rafThrottle((event) => {
        setScrollTop(event.target.scrollTop);
    }), []);
    
    // File operation handlers
    const handleFileClick = useCallback((fileIndex, event) => {
        onFileSelect(fileIndex, event.shiftKey, event.ctrlKey);
    }, [onFileSelect]);

    const handleFileDoubleClick = useCallback((file) => {
        onFileOpen(file);
    }, [onFileOpen]);
    
    const handleFileContextMenu = useCallback((event, file) => {
        onContextMenu(event, file);
    }, [onContextMenu]);

    return (
        <div 
            ref={containerRef}
            className="file-list custom-scrollbar"
            style={{
                height: '100%',
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative',
                padding: '1.5rem',
                boxSizing: 'border-box'
            }}
            onScroll={handleScroll}
            onContextMenu={(e) => {
                if (e.target === e.currentTarget || !e.target.closest('.file-item')) {
                    e.preventDefault();
                    if (onEmptySpaceContextMenu) {
                        onEmptySpaceContextMenu(e);
                    }
                }
            }}
        >
            {/* Virtual container with total height for proper scrollbar */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Inline folder editor */}
                {creatingFolder && (
                    <div style={{ 
                        position: 'absolute', 
                        top: 0, 
                        left: 0, 
                        right: 0, 
                        height: ITEM_HEIGHT,
                        zIndex: 10
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
                
                {/* Render visible items - Fixed positioning to prevent overlap */}
                {visibleItems.map(({ file, index, top }) => (
                    <div 
                        key={`${file.path}-${index}`}
                        style={{
                            position: 'absolute',
                            top: top,
                            left: 0,
                            right: 0,
                            height: ITEM_HEIGHT,
                            boxSizing: 'border-box',
                            overflow: 'hidden'
                        }}
                    >
                        <FileItem
                            file={file}
                            fileIndex={index}
                            onSelect={handleFileClick}
                            onOpen={handleFileDoubleClick}
                            onContextMenu={handleFileContextMenu}
                            isLoading={false}
                            isSelected={selectedFiles.has(index)}
                            isCut={clipboardOperation === 'cut' && clipboardFiles.includes(file.path)}
                            isDragOver={dragState?.dragOverFolder === file.path}
                            onDragStart={onDragStart}
                            onDragOver={onDragOver}
                            onDragEnter={onDragEnter}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            isInspectMode={isInspectMode}
                        />
                    </div>
                ))}
                
                {/* Empty state */}
                {files.length === 0 && !creatingFolder && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--zen-text-tertiary)'
                    }}>
                        <div style={LARGE_ICON_STYLE}>📁</div>
                        <div className="text-technical">Directory is empty</div>
                    </div>
                )}
            </div>
        </div>
    );
});

export { VirtualizedFileList }; 