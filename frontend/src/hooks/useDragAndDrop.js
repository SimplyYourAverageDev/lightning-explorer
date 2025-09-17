import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { CopyFiles, MoveFiles } from "../../wailsjs/go/backend/App";
import { serializationUtils } from "../utils/serialization";
import { log, warn, error } from "../utils/logger";

export const useDragAndDrop = (currentPath, selectedFiles, allFiles, setError, clearSelection, handleRefresh) => {
    const [dragState, setDragState] = useState({
        isDragging: false,
        draggedFiles: [],
        draggedPaths: [],
        dragOperation: 'move', // 'move' or 'copy'
        dragOverFolder: null,
        dragStartPosition: { x: 0, y: 0 }
    });

    const dragPreviewRef = useRef(null);
    const dragTimeoutRef = useRef(null);

    // Simplified drag start for internal-only operations
    const handleDragStart = useCallback((event, file, fileIndex) => {
        log('🎯 Internal drag started for:', file.name);

        // Get all selected files or just the dragged file
        let draggedFiles = [];
        let draggedPaths = [];

        if (selectedFiles.has(fileIndex)) {
            // Dragging selected files
            draggedFiles = Array.from(selectedFiles).map(index => allFiles[index]);
        } else {
            // Dragging unselected file
            draggedFiles = [file];
        }

        draggedPaths = draggedFiles.map(f => f.path);

        // Set drag operation based on modifier keys
        const operation = event.ctrlKey ? 'copy' : 'move';

        // Set up data transfer for internal Lightning Explorer operations only
        const dataTransfer = event.dataTransfer;
        
        // Set drag effects for internal operations only
        dataTransfer.effectAllowed = 'copyMove';
        
        // Lightning Explorer internal format (MessagePack)
        const internalDragData = {
            files: draggedPaths,
            operation: operation,
            source: currentPath,
            fileNames: draggedFiles.map(f => f.name),
            isInternal: true
        };
        
        const serializedData = serializationUtils.serialize(internalDragData);
        dataTransfer.setData('application/msgpack-base64', serializedData);

        // Create simple drag preview
        const dragPreview = createDragPreview(draggedFiles, operation);
        if (dragPreview) {
            document.body.appendChild(dragPreview);
            dataTransfer.setDragImage(dragPreview, 20, 20);
            dragPreviewRef.current = dragPreview;
        }

        // Update drag state
        setDragState({
            isDragging: true,
            draggedFiles,
            draggedPaths,
            dragOperation: operation,
            dragOverFolder: null,
            dragStartPosition: { x: event.clientX, y: event.clientY }
        });

        log(`🎯 Internal drag: ${draggedFiles.length} items, operation: ${operation}`);
    }, [currentPath, selectedFiles, allFiles]);

    // Simplified drag over for internal operations only
    const handleDragOver = useCallback((event, targetFolder) => {
        if (!dragState.isDragging) return;

        if (!targetFolder?.isDir) {
            // Not over a folder, prevent drop
            event.preventDefault();
            event.dataTransfer.dropEffect = 'none';
            return;
        }

        event.preventDefault();
        
        // Update drop effect based on current modifier keys
        const operation = event.ctrlKey ? 'copy' : 'move';
        event.dataTransfer.dropEffect = operation;

        // Update drag operation if it changed
        if (operation !== dragState.dragOperation) {
            setDragState(prev => ({ ...prev, dragOperation: operation }));
        }

        // Set visual feedback for drop target
        if (dragState.dragOverFolder !== targetFolder.path) {
            setDragState(prev => ({ ...prev, dragOverFolder: targetFolder.path }));
        }
    }, [dragState.isDragging, dragState.dragOperation, dragState.dragOverFolder]);

    // Handle drag enter
    const handleDragEnter = useCallback((event, targetFolder) => {
        if (!targetFolder?.isDir) return;
        
        event.preventDefault();
        
        // Clear any existing timeout
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
            dragTimeoutRef.current = null;
        }

        setDragState(prev => ({ ...prev, dragOverFolder: targetFolder.path }));
    }, []);

    // Handle drag leave
    const handleDragLeave = useCallback((event, targetFolder) => {
        if (!targetFolder?.isDir) return;

        // Clear any existing timeout first
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
            dragTimeoutRef.current = null;
        }

        // Add small delay to prevent flicker when moving between child elements
        dragTimeoutRef.current = setTimeout(() => {
            try {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX;
                const y = event.clientY;

                // Only clear if we're actually outside the element
                if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
                    setDragState(prev => ({ 
                        ...prev, 
                        dragOverFolder: prev.dragOverFolder === targetFolder.path ? null : prev.dragOverFolder 
                    }));
                }
            } catch (e) {
                // Handle any errors in rect calculation
                warn('Drag leave calculation error:', e);
            }
            
            // Clear timeout reference after execution
            dragTimeoutRef.current = null;
        }, 100);
    }, []);

    // Simplified drop handler for internal operations only
    const handleDrop = useCallback(async (event, targetFolder, dragData) => {
        event.preventDefault();
        
        // Clear any pending timeouts
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
            dragTimeoutRef.current = null;
        }
        
        if (!targetFolder?.isDir) {
            warn('⚠️ Cannot drop on non-directory:', targetFolder?.name);
            return;
        }

        // Only process internal Lightning Explorer drag data
        let internalData = null;
        try {
            const msgpackData = event.dataTransfer.getData('application/msgpack-base64');
            if (msgpackData) {
                internalData = serializationUtils.deserialize(msgpackData);
                log('📦 Using internal MessagePack drag data');
            }
        } catch (err) {
            log('📦 No internal drag data found');
        }

        // Only proceed if we have internal Lightning Explorer data
        if (!internalData || !internalData.isInternal) {
            log('⚠️ Only internal Lightning Explorer drag operations are supported');
            return;
        }

        const sourcePaths = internalData.files;
        const operation = internalData.operation;
        const source = internalData.source;
        
        // Input validation
        if (!sourcePaths || !Array.isArray(sourcePaths) || sourcePaths.length === 0) {
            error('⚠️ No valid source paths found in drop data');
            setError('No valid files found in drop data');
            return;
        }
        
        if (!targetFolder.path || typeof targetFolder.path !== 'string') {
            error('⚠️ Invalid target folder path');
            setError('Invalid drop target');
            return;
        }
        
        // Prevent dropping on itself or into same directory
        if (source === targetFolder.path) {
            log('ℹ️ Dropping in same directory, ignoring');
            return;
        }

        // Security validation to prevent dangerous drops
        const isInvalidDrop = sourcePaths.some(srcPath => {
            if (!srcPath || typeof srcPath !== 'string') return true;
            
            // Normalize paths for comparison
            const normalizedSrc = srcPath.replace(/[\\\/]+/g, '/').toLowerCase();
            const normalizedTarget = targetFolder.path.replace(/[\\\/]+/g, '/').toLowerCase();
            
            // Prevent dropping folder into itself or subdirectories
            return normalizedTarget.startsWith(normalizedSrc + '/') || 
                   normalizedTarget === normalizedSrc ||
                   // Prevent dropping into system folders
                   normalizedTarget.includes('/windows/system32') ||
                   normalizedTarget.includes('/program files') ||
                   normalizedSrc.includes('/windows/system32') ||
                   normalizedSrc.includes('/program files');
        });

        if (isInvalidDrop) {
            setError('Cannot move or copy files: Invalid or dangerous operation detected');
            return;
        }

        try {
            log(`🎯 Processing internal drop: ${sourcePaths.length} items into:`, targetFolder.path);
            log(`📋 Operation: ${operation}`);

            let success = false;

            if (operation === 'copy') {
                success = await CopyFiles(sourcePaths, targetFolder.path);
            } else {
                success = await MoveFiles(sourcePaths, targetFolder.path);
            }

            if (success) {
                log(`✅ ${operation} operation successful`);
                
                // If we moved files, clear selection
                if (operation === 'move') {
                    clearSelection();
                }
                
                // Refresh current directory
                setTimeout(() => {
                    handleRefresh();
                }, 100);
                
            } else {
                setError(`Failed to ${operation} files to "${targetFolder.name}"`);
            }

        } catch (err) {
            error(`❌ Error during ${operation} operation:`, err);
            setError(`Failed to ${operation} files: ${err.message}`);
        }
    }, [setError, clearSelection, handleRefresh]);

    // Drag end with cleanup
    const handleDragEnd = useCallback(() => {
        log('🎯 Internal drag operation ended');

        // Clean up drag preview
        if (dragPreviewRef.current) {
            try {
                document.body.removeChild(dragPreviewRef.current);
            } catch (e) {
                // Preview might have already been removed
                warn('Drag preview cleanup warning:', e);
            }
            dragPreviewRef.current = null;
        }

        // Clear timeout to prevent memory leaks
        if (dragTimeoutRef.current) {
            clearTimeout(dragTimeoutRef.current);
            dragTimeoutRef.current = null;
        }

        // Reset drag state
        setDragState({
            isDragging: false,
            draggedFiles: [],
            draggedPaths: [],
            dragOperation: 'move',
            dragOverFolder: null,
            dragStartPosition: { x: 0, y: 0 }
        });
    }, []);

    // Cleanup effect for component unmount
    useEffect(() => {
        return () => {
            // Cleanup on unmount
            if (dragPreviewRef.current) {
                try {
                    document.body.removeChild(dragPreviewRef.current);
                } catch (e) {
                    // Preview might have already been removed
                }
                dragPreviewRef.current = null;
            }
            
            if (dragTimeoutRef.current) {
                clearTimeout(dragTimeoutRef.current);
                dragTimeoutRef.current = null;
            }
        };
    }, []);

    // Create simple drag preview for internal operations only
    const createDragPreview = (files, operation) => {
        const preview = document.createElement('div');
        
        // Get dynamic values from CSS custom properties
        const root = document.documentElement;
        const computedStyle = getComputedStyle(root);
        const baseFontSize = computedStyle.getPropertyValue('--font-base') || '14px';
        const baseSpacing = computedStyle.getPropertyValue('--space-md') || '8px';
        const borderWidth = computedStyle.getPropertyValue('--brut-border-width') || '2px';
        const borderRadius = computedStyle.getPropertyValue('--brut-radius') || '4px';
        
        preview.style.cssText = `
            position: absolute;
            top: -1000px;
            background: #ffff00;
            color: #000000;
            border: ${borderWidth} solid #000000;
            border-radius: ${borderRadius};
            padding: ${baseSpacing} calc(${baseSpacing} * 2);
            font-size: ${baseFontSize};
            font-family: 'JetBrains Mono', monospace;
            font-weight: bold;
            z-index: 1000;
            pointer-events: none;
        `;

        const iconText = operation === 'copy' ? 'Copy' : 'Move';
        const action = operation === 'copy' ? 'Copy' : 'Move';
        
        let content = '';
        if (files.length === 1) {
            content = `${iconText} "${files[0].name}"`;
        } else {
            content = `${iconText} ${files.length} items`;
        }
        
        preview.innerHTML = content;

        return preview;
    };

    return {
        dragState,
        handleDragStart,
        handleDragOver,
        handleDragEnter,
        handleDragLeave,
        handleDrop,
        handleDragEnd
    };
};

export default useDragAndDrop; 
