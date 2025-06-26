import { memo, forwardRef, useImperativeHandle } from "preact/compat";
import { useRef, useState, useCallback, useMemo, useEffect, useLayoutEffect } from "preact/hooks";
import { rafThrottle } from "../utils/debounce";
import { FileItem } from "./FileItem";

// Dynamic item height based on CSS custom property
const getItemHeight = () => {
    const root = document.documentElement;
    const computedStyle = getComputedStyle(root);
    const fileItemHeight = computedStyle.getPropertyValue('--file-item-height');
    return parseFloat(fileItemHeight) * 16; // Convert rem to px (assuming 1rem = 16px)
};

// Cache the item height to avoid repeated DOM queries
let cachedItemHeight = null;
const ITEM_HEIGHT = () => {
    if (cachedItemHeight === null) {
        cachedItemHeight = getItemHeight() || 80;
    }
    return cachedItemHeight;
};

// Dynamic buffer calculation
const getBuffer = () => Math.max(4, Math.floor(ITEM_HEIGHT() / 8));

// Use passive event listeners for better scroll performance
const scrollOptions = { passive: true };

export const StreamingVirtualizedFileList = memo(forwardRef(function StreamingVirtualizedFileList({
    files, 
    selectedFiles,
    onFileSelect,
    onFileOpen,
    onContextMenu,
    loading,
    clipboardFiles,
    clipboardOperation,
    dragState,
    onDragStart,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    creatingFolder,
    tempFolderName,
    editInputRef,
    onFolderKeyDown,
    onFolderInputChange,
    onFolderInputBlur,
    onEmptySpaceContextMenu,
    isInspectMode = false
}, forwardedRef) {
    const ref = useRef();
    const [scrollTop, setScrollTop] = useState(0);
    const [containerHeight, setContainerHeight] = useState(window.innerHeight);
    
    // Use layout effect to measure container size more accurately
    useLayoutEffect(() => {
        if (!ref.current) return;
        
        const updateHeight = () => {
            const height = ref.current.clientHeight;
            if (height !== containerHeight) {
                setContainerHeight(height);
            }
        };
        
        updateHeight();
        
        // Use ResizeObserver for more efficient size tracking
        const resizeObserver = new ResizeObserver(updateHeight);
        resizeObserver.observe(ref.current);
        
        return () => resizeObserver.disconnect();
    }, [containerHeight]);
    
    // Memoize calculations
    const calculations = useMemo(() => {
        const itemHeight = ITEM_HEIGHT();
        const buffer = getBuffer();
        const totalHeight = (files.length + (creatingFolder ? 1 : 0)) * itemHeight;
        
        const rawStart = Math.floor(scrollTop / itemHeight) - buffer;
        const visibleStart = Math.max(0, Math.min(files.length - 1, rawStart));
        
        const rawEnd = visibleStart + Math.ceil(containerHeight / itemHeight) + buffer * 2;
        const visibleEnd = Math.max(visibleStart, Math.min(files.length - 1, rawEnd));
        
        return {
            itemHeight,
            totalHeight,
            visibleStart,
            visibleEnd,
            creatingFolderOffset: creatingFolder ? itemHeight : 0
        };
    }, [scrollTop, containerHeight, files.length, creatingFolder]);
    
    // Extract visible items with stable reference
    const visibleItems = useMemo(() => 
        files.slice(calculations.visibleStart, calculations.visibleEnd + 1),
        [files, calculations.visibleStart, calculations.visibleEnd]
    );

    // Optimized scroll handler
    const throttledSetScroll = useMemo(
        () => rafThrottle((value) => {
            setScrollTop(value);
        }),
        []
    );

    const onScroll = useCallback((e) => {
        const newScrollTop = e.currentTarget.scrollTop;
        throttledSetScroll(newScrollTop);
    }, [throttledSetScroll]);

    // Scroll to item function
    const scrollToItem = useCallback((index) => {
        if (!ref.current || index < 0 || index >= files.length) return;
        
        const container = ref.current;
        const itemTop = index * calculations.itemHeight + calculations.creatingFolderOffset;
        const itemBottom = itemTop + calculations.itemHeight;
        
        const visibleTop = container.scrollTop;
        const visibleBottom = container.scrollTop + containerHeight;
        
        let newScrollTop = container.scrollTop;
        
        if (itemTop < visibleTop) {
            newScrollTop = itemTop;
        } else if (itemBottom > visibleBottom) {
            newScrollTop = itemBottom - containerHeight;
        }
        
        if (newScrollTop !== container.scrollTop) {
            container.scrollTo({
                top: newScrollTop,
                behavior: 'smooth'
            });
        }
    }, [files.length, calculations.itemHeight, calculations.creatingFolderOffset, containerHeight]);

    // Expose scrollToItem via imperative handle
    useImperativeHandle(forwardedRef, () => ({
        scrollToItem
    }), [scrollToItem]);

    // Memoized event handlers
    const handleFileClick = useCallback((fileIndex, event) => {
        onFileSelect(fileIndex, event.shiftKey, event.ctrlKey);
    }, [onFileSelect]);

    const handleFileContextMenu = useCallback((event, file) => {
        onContextMenu(event, file);
    }, [onContextMenu]);

    const handleEmptySpaceContextMenu = useCallback((e) => {
        if (isInspectMode) return;
        if (e.target === e.currentTarget || !e.target.closest('.file-item')) {
            e.preventDefault();
            if (onEmptySpaceContextMenu) {
                onEmptySpaceContextMenu(e);
            }
        }
    }, [isInspectMode, onEmptySpaceContextMenu]);

    // Render optimization: batch DOM updates
    const fileItems = useMemo(() => {
        return visibleItems.map((file, idx) => {
            const actualIndex = calculations.visibleStart + idx;
            const top = (actualIndex * calculations.itemHeight) + calculations.creatingFolderOffset;
            
            return (
                <div
                    key={file.path}
                    style={{
                        position: 'absolute',
                        top: 0, 
                        left: 0, 
                        right: 0,
                        height: calculations.itemHeight,
                        transform: `translateY(${top}px)`,
                        padding: 'var(--space-sm) 0',
                        willChange: 'transform' // Hint to browser for optimization
                    }}
                >
                    <FileItem
                        file={file}
                        fileIndex={actualIndex}
                        onSelect={handleFileClick}
                        onOpen={onFileOpen}
                        onContextMenu={handleFileContextMenu}
                        isLoading={false}
                        isSelected={selectedFiles.has(actualIndex)}
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
            );
        });
    }, [
        visibleItems,
        calculations,
        selectedFiles,
        clipboardOperation,
        clipboardFiles,
        dragState,
        handleFileClick,
        onFileOpen,
        handleFileContextMenu,
        onDragStart,
        onDragOver,
        onDragEnter,
        onDragLeave,
        onDrop,
        isInspectMode
    ]);

    return (
        <div
            ref={ref}
            className="file-list custom-scrollbar"
            onScroll={onScroll}
            onContextMenu={handleEmptySpaceContextMenu}
            style={{ 
                position: 'relative',
                overflow: 'auto',
                height: '100%',
                contain: 'strict' // Enable CSS containment for better performance
            }}
        >
            <div style={{ 
                height: calculations.totalHeight, 
                position: 'relative', 
                width: '100%',
                pointerEvents: 'none' // Improve scrolling performance
            }}>
                {/* Folder creation editor */}
                {creatingFolder && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: calculations.itemHeight,
                        zIndex: 10,
                        background: 'var(--brut-surface)',
                        border: 'var(--brut-border-width) solid var(--brut-border-color)',
                        borderRadius: 'var(--brut-radius)',
                        padding: 'var(--space-md)',
                        display: 'flex',
                        alignItems: 'center',
                        pointerEvents: 'auto'
                    }}>
                        <span style={{ marginRight: 'var(--space-md)' }}>📁</span>
                        <input
                            ref={editInputRef}
                            type="text"
                            value={tempFolderName}
                            onChange={onFolderInputChange}
                            onKeyDown={onFolderKeyDown}
                            onBlur={onFolderInputBlur}
                            style={{
                                background: 'transparent',
                                border: '0',
                                color: 'var(--brut-text-primary)',
                                outline: 'none',
                                fontSize: 'var(--font-base)',
                                width: '100%'
                            }}
                            placeholder="New folder name"
                            autoFocus
                        />
                    </div>
                )}

                {/* Render visible items */}
                <div style={{ pointerEvents: 'auto' }}>
                    {fileItems}
                </div>

                {/* Empty state */}
                {files.length === 0 && !creatingFolder && !loading && (
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
                        color: 'var(--brut-text-tertiary)',
                        pointerEvents: 'auto'
                    }}>
                        <div className="text-technical" style={{fontSize: 'var(--font-base)'}}>
                            Directory is empty
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
})); 