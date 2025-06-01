import { useMemo, useCallback } from "preact/hooks";
import { memo } from "preact/compat";
import { getFileIcon, getFileType } from "../utils/fileUtils.js";
import { formatDate, formatFileSize } from "../utils/formatUtils.js";

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
    isDragOver 
}) => {
    const icon = useMemo(() => getFileIcon(file.name, file.isDir), [file.name, file.isDir]);
    const type = useMemo(() => getFileType(file.name, file.isDir), [file.name, file.isDir]);
    
    const handleClick = useCallback((event) => {
        console.log('📋 File clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir, 'IsSelected:', isSelected);
        
        if (!isLoading) {
            // If the file is already selected and this is a single click (no modifier keys), open it
            if (isSelected && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
                console.log('🚀 File already selected, opening:', file.name);
                onOpen(file);
            } else {
                // Otherwise, handle selection
                console.log('🖱️ Processing selection for:', file.name);
                onSelect(fileIndex, event.shiftKey, event.ctrlKey || event.metaKey);
            }
        }
    }, [file, isLoading, isSelected, fileIndex, onOpen, onSelect]);
    
    const handleDoubleClick = useCallback((event) => {
        console.log('🔍 File double-clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir);
        
        if (!isLoading) {
            // Double click always opens, regardless of selection state
            console.log('🚀 Double-click detected, opening:', file.name);
            onOpen(file);
        }
    }, [file, isLoading, onOpen]);
    
    const handleRightClick = useCallback((event) => {
        event.preventDefault();
        console.log('🖱️ Right-click on:', file.name, 'IsSelected:', isSelected);
        
        if (!isLoading) {
            // If file is not selected, select it first
            if (!isSelected) {
                onSelect(fileIndex, false, false);
            }
            
            // Show context menu
            onContextMenu(event, file);
        }
    }, [file, isLoading, isSelected, fileIndex, onSelect, onContextMenu]);
    
    const handleDragStart = useCallback((event) => {
        if (isLoading) {
            event.preventDefault();
            return;
        }
        
        // If the dragged item is not selected, select it first
        if (!isSelected) {
            onSelect(fileIndex, false, false);
        }
        
        if (onDragStart) {
            onDragStart(event, file);
        }
    }, [isLoading, isSelected, fileIndex, file, onSelect, onDragStart]);
    
    const handleDragOver = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        event.preventDefault();
        event.dataTransfer.dropEffect = event.ctrlKey ? 'copy' : 'move';
        
        if (onDragOver) {
            onDragOver(event, file);
        }
    }, [file.isDir, isLoading, onDragOver, file]);
    
    const handleDragEnter = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        event.preventDefault();
        if (onDragEnter) {
            onDragEnter(event, file);
        }
    }, [file.isDir, isLoading, onDragEnter, file]);
    
    const handleDragLeave = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        if (onDragLeave) {
            onDragLeave(event, file);
        }
    }, [file.isDir, isLoading, onDragLeave, file]);
    
    const handleDrop = useCallback((event) => {
        if (!file.isDir || isLoading) return;
        
        event.preventDefault();
        
        try {
            const dragData = JSON.parse(event.dataTransfer.getData('application/json'));
            console.log('📂 Drop on folder:', file.name, 'Items:', dragData.files?.length, 'Operation:', dragData.operation);
            
            if (onDrop) {
                onDrop(event, file, dragData);
            }
        } catch (err) {
            console.error('❌ Error parsing drag data:', err);
        }
    }, [file, isLoading, onDrop]);
    
    return (
        <div 
            className={`file-item ${isSelected ? 'selected' : ''} ${isLoading ? 'disabled' : ''} ${isCut ? 'cut' : ''} ${isDragOver ? 'drag-over' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleRightClick}
            draggable={!isLoading}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{ 
                cursor: isLoading ? 'wait' : 'pointer',
                opacity: isLoading ? 0.7 : (isCut ? 0.5 : 1) 
            }}
        >
            <div className={`file-icon ${type}`}>
                {icon}
            </div>
            <div className="file-details">
                <div className="file-name">{file.name}</div>
                <div className="file-meta">
                    {file.isDir ? (
                        <span>DIR</span>
                    ) : (
                        <>
                            <span>{formatFileSize(file.size)}</span>
                            <span>{formatDate(file.modTime)}</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
});

export default FileItem; 