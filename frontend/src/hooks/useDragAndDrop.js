import { useState, useCallback, useRef } from "preact/hooks";
import { CopyFiles, MoveFiles } from "../../wailsjs/go/backend/App";

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

    // Start drag operation
    const handleDragStart = useCallback((event, file) => {
        console.log('🎯 Drag started for:', file.name);

        // Get all selected files or just the dragged file
        let draggedFiles = [];
        let draggedPaths = [];

        if (selectedFiles.has(allFiles.findIndex(f => f.path === file.path))) {
            // Dragging selected files
            draggedFiles = Array.from(selectedFiles).map(index => allFiles[index]);
        } else {
            // Dragging unselected file
            draggedFiles = [file];
        }

        draggedPaths = draggedFiles.map(f => f.path);

        // Set drag operation based on modifier keys
        const operation = event.ctrlKey ? 'copy' : 'move';

        // Create drag data
        const dragData = {
            files: draggedPaths,
            operation: operation,
            source: currentPath,
            fileNames: draggedFiles.map(f => f.name)
        };

        // Set drag effect
        event.dataTransfer.effectAllowed = event.ctrlKey ? 'copy' : 'move';
        event.dataTransfer.setData('application/json', JSON.stringify(dragData));
        event.dataTransfer.setData('text/plain', draggedFiles.map(f => f.name).join(', '));

        // Create custom drag preview
        const dragPreview = createDragPreview(draggedFiles, operation);
        if (dragPreview) {
            document.body.appendChild(dragPreview);
            event.dataTransfer.setDragImage(dragPreview, 20, 20);
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

        console.log(`🎯 Dragging ${draggedFiles.length} items with operation: ${operation}`);
    }, [currentPath, selectedFiles, allFiles]);

    // Handle drag over folder
    const handleDragOver = useCallback((event, targetFolder) => {
        if (!dragState.isDragging || !targetFolder.isDir) return;

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
        if (!targetFolder.isDir) return;
        
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
        if (!targetFolder.isDir) return;

        // Add small delay to prevent flicker when moving between child elements
        dragTimeoutRef.current = setTimeout(() => {
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
        }, 100);
    }, []);

    // Handle drop operation
    const handleDrop = useCallback(async (event, targetFolder, dragData) => {
        event.preventDefault();
        
        if (!targetFolder.isDir) {
            console.warn('⚠️ Cannot drop on non-directory:', targetFolder.name);
            return;
        }

        const { files: sourcePaths, operation, source } = dragData;
        
        // Prevent dropping on itself or into same directory
        if (source === targetFolder.path) {
            console.log('ℹ️ Dropping in same directory, ignoring');
            return;
        }

        // Prevent dropping a folder into itself or its subdirectories
        const isInvalidDrop = sourcePaths.some(srcPath => {
            return targetFolder.path.startsWith(srcPath + '/') || targetFolder.path.startsWith(srcPath + '\\') || targetFolder.path === srcPath;
        });

        if (isInvalidDrop) {
            setError('Cannot move or copy a folder into itself or its subdirectories');
            return;
        }

        try {
            console.log(`🎯 Dropping ${sourcePaths.length} items into:`, targetFolder.path);
            console.log(`📋 Operation: ${operation}`);

            let success = false;

            if (operation === 'copy') {
                success = await CopyFiles(sourcePaths, targetFolder.path);
            } else {
                success = await MoveFiles(sourcePaths, targetFolder.path);
            }

            if (success) {
                console.log(`✅ ${operation} operation successful`);
                
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
            console.error(`❌ Error during ${operation} operation:`, err);
            setError(`Failed to ${operation} files: ${err.message}`);
        }
    }, [setError, clearSelection, handleRefresh]);

    // Handle drag end
    const handleDragEnd = useCallback(() => {
        console.log('🎯 Drag operation ended');

        // Clean up drag preview
        if (dragPreviewRef.current) {
            document.body.removeChild(dragPreviewRef.current);
            dragPreviewRef.current = null;
        }

        // Clear timeout
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

    // Create custom drag preview
    const createDragPreview = (files, operation) => {
        const preview = document.createElement('div');
        preview.style.cssText = `
            position: absolute;
            top: -1000px;
            left: -1000px;
            background: var(--blueprint-surface);
            border: 1px solid var(--blueprint-border);
            border-radius: 4px;
            padding: 8px 12px;
            font-size: 12px;
            font-family: 'JetBrains Mono', monospace;
            color: var(--blueprint-text);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            z-index: 1000;
            pointer-events: none;
            display: flex;
            align-items: center;
            gap: 8px;
            max-width: 300px;
        `;

        const icon = operation === 'copy' ? '📄' : '🔄';
        const action = operation === 'copy' ? 'Copy' : 'Move';
        
        if (files.length === 1) {
            preview.innerHTML = `${icon} ${action} "${files[0].name}"`;
        } else {
            preview.innerHTML = `${icon} ${action} ${files.length} items`;
        }

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