import { memo } from "preact/compat";
import { useRef, useState, useCallback, useMemo, useEffect } from "preact/hooks";
import { rafThrottle } from "../utils/debounce";
import { FileItem } from "./FileItem";

const ITEM_HEIGHT = 64;
const BUFFER = 8;

export const StreamingVirtualizedFileList = memo(function StreamingVirtualizedFileList({
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
}) {
    const ref = useRef();
    const [scroll, setScroll] = useState(0);
    
    const height = ref.current?.clientHeight || window.innerHeight;
    const totalHeight = (files.length + (creatingFolder ? 1 : 0)) * ITEM_HEIGHT;

    const rawStart = Math.floor(scroll / ITEM_HEIGHT) - BUFFER;
    // Clamp to valid bounds to avoid negative or out-of-range indices
    const visibleStart = Math.max(0, Math.min(files.length - 1, rawStart));

    // Ensure at least one item is requested so the slice is never empty when files are available
    const rawEnd = visibleStart + Math.ceil(height / ITEM_HEIGHT) + BUFFER * 2;
    const visibleEnd = Math.max(visibleStart, Math.min(files.length - 1, rawEnd));
    // Memoize the visible slice to prevent unnecessary allocations
    const items = useMemo(() => files.slice(visibleStart, visibleEnd + 1), [files, visibleStart, visibleEnd]);

    // Create a RAF-throttled setter that takes a numeric scrollTop
    const throttledSetScroll = useMemo(
        () => rafThrottle((value) => {
            // Debug output – helps pinpoint virtualization issues when list appears blank
            console.debug('[VirtualList] Scroll event', {
                scrollTop: value,
                visibleStart: Math.max(0, Math.floor(value / ITEM_HEIGHT) - BUFFER),
                viewportHeight: ref.current?.clientHeight || window.innerHeight,
                filesLength: files.length
            });
            setScroll(value);
        }),
        [files.length]
    );

    // Scroll handler: capture scrollTop synchronously to avoid SyntheticEvent reuse issues
    const onScroll = useCallback((e) => {
        throttledSetScroll(e.currentTarget.scrollTop);
    }, [throttledSetScroll]);

    const handleFileClick = useCallback((fileIndex, event) => {
        onFileSelect(fileIndex, event.shiftKey, event.ctrlKey);
    }, [onFileSelect]);

    const handleFileDoubleClick = useCallback((file) => {
        onFileOpen(file);
    }, [onFileOpen]);
    
    const handleFileContextMenu = useCallback((event, file) => {
        onContextMenu(event, file);
    }, [onContextMenu]);

    // Warn if we somehow have files but nothing rendered (possible virtualization bug)
    useEffect(() => {
        if (files.length > 0 && items.length === 0) {
            console.warn('[VirtualList] Empty render detected despite having files', {
                scroll,
                visibleStart,
                visibleEnd,
                filesLength: files.length
            });
        }
    }, [files.length, items.length, scroll, visibleStart, visibleEnd]);

    return (
        <div
            ref={ref}
            className="file-list custom-scrollbar"
            onScroll={onScroll}
            onContextMenu={(e) => {
                if (isInspectMode) return;
                if (e.target === e.currentTarget || !e.target.closest('.file-item')) {
                    e.preventDefault();
                    if (onEmptySpaceContextMenu) {
                        onEmptySpaceContextMenu(e);
                    }
                }
            }}
        >
            <div style={{ height: totalHeight, position: 'relative', width: '100%' }}>
                {/* Folder creation editor */}
                {creatingFolder && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: ITEM_HEIGHT,
                        zIndex: 10,
                        background: 'var(--brut-surface)',
                        border: 'var(--brut-border-width) solid var(--brut-border-color)',
                        borderRadius: 'var(--brut-radius)',
                        padding: '12px',
                        display: 'flex',
                        alignItems: 'center'
                    }}>
                        <span style={{ marginRight: '8px' }}>📁</span>
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
                                fontSize: '14px',
                                width: '100%'
                            }}
                            placeholder="New folder name"
                            autoFocus
                        />
                    </div>
                )}

                {/* Render visible items */}
                {items.map((file, idx) => {
                    const actualIndex = visibleStart + idx;
                    const top = (actualIndex * ITEM_HEIGHT) + (creatingFolder ? ITEM_HEIGHT : 0);
                    
                    return (
                        <div
                            key={file.path}
                            style={{
                                position: 'absolute',
                                top: 0, 
                                left: 0, 
                                right: 0,
                                height: ITEM_HEIGHT,
                                transform: `translateY(${top}px)`,
                                padding: '4px 0'
                            }}
                        >
                            <FileItem
                                file={file}
                                fileIndex={actualIndex}
                                onSelect={handleFileClick}
                                onOpen={handleFileDoubleClick}
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
                })}

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
                        color: 'var(--brut-text-tertiary)'
                    }}>
                        <div className="text-technical" style={{fontSize: '1rem'}}>
                            Directory is empty
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}); 