import { memo } from "preact/compat";
import { useRef, useState, useCallback, useMemo } from "preact/hooks";
import { rafThrottle } from "../utils/debounce";
import { FileItem } from "./FileItem";

const ITEM_HEIGHT = 88;
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
    const totalHeight = files.length * ITEM_HEIGHT;

    const visibleStart = Math.max(0, Math.floor(scroll / ITEM_HEIGHT) - BUFFER);
    const visibleEnd = Math.min(
        files.length - 1,
        visibleStart + Math.ceil(height / ITEM_HEIGHT) + BUFFER * 2
    );
    // Memoize the visible slice to prevent unnecessary allocations
    const items = useMemo(() => files.slice(visibleStart, visibleEnd + 1), [files, visibleStart, visibleEnd]);

    // Throttle scroll updates to the next animation frame to avoid excessive re-renders
    const onScroll = useCallback(
        rafThrottle((e) => {
            setScroll(e.currentTarget.scrollTop);
        }),
        []
    );

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
            ref={ref}
            className="file-list custom-scrollbar"
            onScroll={onScroll}
            style={{ 
                overflowY: 'auto', 
                position: 'relative', 
                height: '100%',
                padding: '1.5rem'
            }}
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
            <div style={{ height: totalHeight, position: 'relative' }}>
                {/* Folder creation editor */}
                {creatingFolder && (
                    <div style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: ITEM_HEIGHT,
                        zIndex: 10,
                        background: '#1a1a1a',
                        border: '1px solid #333',
                        borderRadius: '4px',
                        padding: '8px',
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
                                border: 'none',
                                color: 'white',
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
                                boxSizing: 'border-box'
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
                        color: 'var(--zen-text-tertiary)'
                    }}>
                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📁</div>
                        <div className="text-technical">Directory is empty</div>
                    </div>
                )}
            </div>
        </div>
    );
}); 