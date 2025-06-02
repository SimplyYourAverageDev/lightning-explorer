import { useState, useEffect, useCallback, useMemo, useRef } from "preact/hooks";
import { memo } from "preact/compat";
import { FileItem } from "./FileItem";

// Virtual scrolling configuration
const ITEM_HEIGHT = 48; // Height of each file item in pixels
const BUFFER_SIZE = 5; // Number of items to render outside visible area
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
    containerHeight
}) => {
    const [scrollTop, setScrollTop] = useState(0);
    const containerRef = useRef(null);
    
    // Calculate visible range
    const visibleRange = useMemo(() => {
        const effectiveHeight = containerHeight || CONTAINER_HEIGHT;
        const visibleStart = Math.floor(scrollTop / ITEM_HEIGHT);
        const visibleEnd = Math.min(
            files.length - 1,
            Math.ceil((scrollTop + effectiveHeight) / ITEM_HEIGHT)
        );
        
        // Add buffer for smooth scrolling
        const startIndex = Math.max(0, visibleStart - BUFFER_SIZE);
        const endIndex = Math.min(files.length - 1, visibleEnd + BUFFER_SIZE);
        
        return { startIndex, endIndex, visibleStart, visibleEnd };
    }, [scrollTop, containerHeight, files.length]);
    
    // Get visible items
    const visibleItems = useMemo(() => {
        const { startIndex, endIndex } = visibleRange;
        return files.slice(startIndex, endIndex + 1).map((file, index) => ({
            file,
            index: startIndex + index,
            offsetTop: (startIndex + index) * ITEM_HEIGHT
        }));
    }, [files, visibleRange]);
    
    // Handle scroll
    const handleScroll = useCallback((event) => {
        const newScrollTop = event.target.scrollTop;
        setScrollTop(newScrollTop);
    }, []);
    
    // Scroll to item (for keyboard navigation)
    const scrollToItem = useCallback((index) => {
        if (containerRef.current) {
            const effectiveHeight = containerHeight || CONTAINER_HEIGHT;
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
    }, [containerHeight]);
    
    // Total height for scrollbar
    const totalHeight = files.length * ITEM_HEIGHT;
    
    // Optimize file item click handlers
    const handleFileClick = useCallback((fileIndex, event) => {
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
    
    return (
        <div 
            ref={containerRef}
            className="virtualized-file-list custom-scrollbar"
            style={{ 
                height: containerHeight || '100%', 
                overflowY: 'auto',
                overflowX: 'hidden',
                position: 'relative'
            }}
            onScroll={handleScroll}
        >
            {/* Virtual container with total height */}
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Render only visible items */}
                {visibleItems.map(({ file, index, offsetTop }) => (
                    <div
                        key={`${file.path}-${index}`}
                        style={{
                            position: 'absolute',
                            top: offsetTop,
                            left: 0,
                            right: 0,
                            height: ITEM_HEIGHT
                        }}
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
                        />
                    </div>
                ))}
            </div>
            
            {/* Empty state */}
            {files.length === 0 && (
                <div style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '100%',
                    color: 'var(--blueprint-text-muted)' 
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📁</div>
                    <div className="text-technical">Directory is empty</div>
                </div>
            )}
        </div>
    );
});

export { VirtualizedFileList }; 