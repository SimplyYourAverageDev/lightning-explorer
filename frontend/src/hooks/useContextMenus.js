import { useState, useCallback } from "preact/hooks";

export function useContextMenus(selectedFiles, allFiles, handleCopy, handleCut, showDialog, fileOperations, currentPath, onCreateFolder, isInspectMode = false) {
    // Context menu states
    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, files: [] });
    const [emptySpaceContextMenu, setEmptySpaceContextMenu] = useState({ visible: false, x: 0, y: 0 });

    // Context menu handlers
    const handleContextMenu = useCallback((event, file) => {
        // In inspect mode, don't show custom context menus
        if (isInspectMode) {
            return false;
        }
        
        const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
        
        const contextFiles = selectedFiles.size > 0 && selectedFileObjects.some(f => f.path === file.path) 
            ? selectedFileObjects 
            : [file];
        
        setContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            files: contextFiles
        });
        
        return true;
    }, [selectedFiles, allFiles, isInspectMode]);

    const closeContextMenu = useCallback(() => {
        setContextMenu({ visible: false, x: 0, y: 0, files: [] });
    }, []);

    const handleEmptySpaceContextMenu = useCallback((event) => {
        // In inspect mode, don't show custom context menus
        if (isInspectMode) {
            return false;
        }
        
        event.preventDefault();
        setEmptySpaceContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY
        });
        
        return true;
    }, [isInspectMode]);

    const closeEmptySpaceContextMenu = useCallback(() => {
        setEmptySpaceContextMenu({ visible: false, x: 0, y: 0 });
    }, []);

    // Context menu actions
    const handleContextCopy = useCallback(() => {
        const filePaths = contextMenu.files.map(file => file.path);
        handleCopy(filePaths);
        closeContextMenu();
    }, [contextMenu.files, handleCopy, closeContextMenu]);

    const handleContextCut = useCallback(() => {
        const filePaths = contextMenu.files.map(file => file.path);
        handleCut(filePaths);
        closeContextMenu();
    }, [contextMenu.files, handleCut, closeContextMenu]);

    const handleContextRename = useCallback(() => {
        if (contextMenu.files.length !== 1) {
            closeContextMenu();
            return;
        }
        
        const file = contextMenu.files[0];
        closeContextMenu();
        
        showDialog(
            'prompt',
            'RENAME FILE',
            `RENAME "${file.name}" TO:`,
            file.name,
            (newName) => {
                if (newName && newName !== file.name && newName.trim() !== '') {
                    fileOperations.handleRename(file.path, newName.trim());
                }
            }
        );
    }, [contextMenu.files, closeContextMenu, showDialog, fileOperations]);

    const handleContextHide = useCallback(() => {
        const filePaths = contextMenu.files.map(file => file.path);
        closeContextMenu();
        
        showDialog(
            'confirm',
            'HIDE FILES',
            `HIDE ${filePaths.length} ITEM${filePaths.length === 1 ? '' : 'S'}?\n\nHidden files will not be visible unless "Show Hidden Files" is enabled.`,
            '',
            () => {
                fileOperations.handleHideFiles(filePaths);
            }
        );
    }, [contextMenu.files, closeContextMenu, showDialog, fileOperations]);

    const handlePermanentDelete = useCallback(() => {
        const filePaths = contextMenu.files.map(file => file.path);
        closeContextMenu();
        showDialog('delete', '⚠️ PERMANENT DELETE WARNING', `Permanently delete ${filePaths.length} items? This cannot be undone!`, '', 
            () => {
                fileOperations.handlePermanentDelete(filePaths);
            });
    }, [contextMenu.files, closeContextMenu, showDialog, fileOperations]);

    const handleOpenPowerShell = useCallback(() => {
        closeEmptySpaceContextMenu();
        fileOperations.handleOpenPowerShell();
    }, [closeEmptySpaceContextMenu, fileOperations]);

    const handleCreateFolder = useCallback(() => {
        closeEmptySpaceContextMenu();
        if (onCreateFolder) {
            onCreateFolder();
        }
    }, [closeEmptySpaceContextMenu, onCreateFolder]);

    return {
        contextMenu,
        emptySpaceContextMenu,
        handleContextMenu,
        closeContextMenu,
        handleEmptySpaceContextMenu,
        closeEmptySpaceContextMenu,
        handleContextCopy,
        handleContextCut,
        handleContextRename,
        handleContextHide,
        handlePermanentDelete,
        handleOpenPowerShell,
        handleCreateFolder
    };
} 