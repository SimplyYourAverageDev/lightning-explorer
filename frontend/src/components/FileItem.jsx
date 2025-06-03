import { useMemo, useCallback, useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";
import { getFileIcon, getFileType } from "../utils/fileUtils.js";
import { formatDate, formatFileSize } from "../utils/formatUtils.js";
import { log, error } from "../utils/logger";

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

}) => {
    const icon = useMemo(() => getFileIcon(file.name, file.isDir), [file.name, file.isDir]);
    const type = useMemo(() => getFileType(file.name, file.isDir), [file.name, file.isDir]);
    
    // Refs for click timing and debouncing
    const clickTimeoutRef = useRef(null);
    const lastOpenTimeRef = useRef(0);
    const clickCountRef = useRef(0);
    
    // Configuration for click timing - Made configurable for performance tuning
    const INSTANT_MODE = false; // Set to true for zero-latency mode (disables double-click protection)
    const DOUBLE_CLICK_DELAY = INSTANT_MODE ? 0 : 300; // ms to wait for potential double-click (Windows standard)
    const OPEN_COOLDOWN = INSTANT_MODE ? 100 : 500; // ms cooldown between opens to prevent rapid-fire
    const PERFORMANCE_LOGGING = false; // Set to true to enable performance logs
    
    const handleClick = useCallback((event) => {
        const clickStartTime = PERFORMANCE_LOGGING ? performance.now() : 0;
        log('📋 File clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir, 'IsSelected:', isSelected);
        
        if (isLoading) return;
        
        const now = Date.now();
        clickCountRef.current += 1;
        
        // Clear any existing timeout
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
        }
        
        // Check if this is too soon after last open (cooldown protection)
        if (now - lastOpenTimeRef.current < OPEN_COOLDOWN) {
            log('🛡️ Open cooldown active, ignoring click');
            clickCountRef.current = 0;
            return;
        }
        
        // Handle immediate actions (with modifier keys or unselected files)
        if (event.shiftKey || event.ctrlKey || event.metaKey || !isSelected) {
            log('🖱️ Processing selection for:', file.name);
            if (PERFORMANCE_LOGGING) {
                log(`⚡ Immediate response: ${(performance.now() - clickStartTime).toFixed(2)}ms`);
            }
            onSelect(fileIndex, event.shiftKey, event.ctrlKey || event.metaKey);
            clickCountRef.current = 0;
            return;
        }
        
        // For selected files without modifier keys, wait to see if it's a double-click
        if (PERFORMANCE_LOGGING) {
            log(`⏱️ Delaying open by ${DOUBLE_CLICK_DELAY}ms to detect double-click`);
        }
        
        clickTimeoutRef.current = setTimeout(() => {
            if (clickCountRef.current === 1) {
                // Single click on selected file - open it
                log('🚀 Single click confirmed, opening:', file.name);
                if (PERFORMANCE_LOGGING) {
                    log(`⚡ Delayed open executed: ${(performance.now() - clickStartTime).toFixed(2)}ms total`);
                }
                lastOpenTimeRef.current = Date.now();
                onOpen(file);
            }
            clickCountRef.current = 0;
        }, DOUBLE_CLICK_DELAY);
    }, [file, isLoading, isSelected, fileIndex, onOpen, onSelect]);
    
    const handleDoubleClick = useCallback((event) => {
        log('🔍 File double-clicked:', file.name, 'Path:', file.path, 'IsDir:', file.isDir);
        
        if (isLoading) return;
        
        const now = Date.now();
        
        // Clear single-click timeout since this is a double-click
        if (clickTimeoutRef.current) {
            clearTimeout(clickTimeoutRef.current);
            clickTimeoutRef.current = null;
        }
        
        // Check cooldown
        if (now - lastOpenTimeRef.current < OPEN_COOLDOWN) {
            log('🛡️ Open cooldown active, ignoring double-click');
            clickCountRef.current = 0;
            return;
        }
        
        // Double click always opens, regardless of selection state
        log('🚀 Double-click confirmed, opening:', file.name);
        lastOpenTimeRef.current = now;
        clickCountRef.current = 0;
        onOpen(file);
    }, [file, isLoading, onOpen]);
    
    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
            }
        };
    }, []);
    
    const handleRightClick = useCallback((event) => {
        event.preventDefault();
        log('🖱️ Right-click on:', file.name, 'IsSelected:', isSelected);
        
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
            log('📂 Drop on folder:', file.name, 'Items:', dragData.files?.length, 'Operation:', dragData.operation);
            
            if (onDrop) {
                onDrop(event, file, dragData);
            }
        } catch (err) {
            error('❌ Error parsing drag data:', err);
        }
    }, [file, isLoading, onDrop]);
    

    
    return (
        <div 
            className={`file-item ${isSelected ? 'selected' : ''} ${isLoading ? 'disabled' : ''} ${isCut ? 'cut' : ''} ${isDragOver ? 'drag-over' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleRightClick}
            onSelectStart={(e) => e.preventDefault()}
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

export { FileItem };
export default FileItem; 