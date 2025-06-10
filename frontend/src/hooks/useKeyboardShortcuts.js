import { useEffect, useMemo } from "preact/hooks";
import { throttle } from "../utils/debounce";

export function useKeyboardShortcuts({
    handleRefresh,
    handleNavigateUp,
    selectedFiles,
    allFiles,
    handleFileOpen,
    selectAll,
    handleCopySelected,
    handleCutSelected,
    handlePaste,
    isPasteAvailable,
    handleArrowNavigation,
    clearSelection,
    closeContextMenu,
    closeEmptySpaceContextMenu,
    handleRename,
    handleDeleteToTrash,
    handlePermanentDelete,
    isDialogOpen
}) {
    // Optimized keyboard shortcuts
    const keyboardHandler = useMemo(
        () => throttle((event) => {
            // Don't process shortcuts if a dialog is open
            if (isDialogOpen) {
                return;
            }
            
            // Don't process shortcuts if event originated from a dialog
            if (event.target.closest('.retro-dialog') || event.target.closest('.context-menu')) {
                return;
            }
            
            if (event.key === 'F5') {
                event.preventDefault();
                handleRefresh();
            } else if (event.key === 'F2' && selectedFiles.size === 1 && !event.target.matches('input, textarea')) {
                event.preventDefault();
                // Trigger rename for the selected file
                if (handleRename) {
                    handleRename();
                }
            } else if (event.key === 'Backspace' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                handleNavigateUp();
            } else if (event.key === 'Delete' && selectedFiles.size > 0 && !event.target.matches('input, textarea')) {
                event.preventDefault();
                if (event.shiftKey) {
                    // Shift+Delete: Permanently delete
                    if (handlePermanentDelete) {
                        handlePermanentDelete();
                    }
                } else {
                    // Delete: Move to trash
                    if (handleDeleteToTrash) {
                        handleDeleteToTrash();
                    }
                }
            } else if (event.key === 'Enter' && selectedFiles.size > 0 && !event.target.matches('input, textarea')) {
                event.preventDefault();
                const selectedFileObjects = Array.from(selectedFiles).map(index => allFiles[index]);
                selectedFileObjects.forEach(file => handleFileOpen(file));
            } else if (event.ctrlKey && event.key === 'a' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                selectAll(allFiles.length);
            } else if (event.ctrlKey && event.key === 'c' && selectedFiles.size > 0) {
                event.preventDefault();
                handleCopySelected();
            } else if (event.ctrlKey && event.key === 'x' && selectedFiles.size > 0) {
                event.preventDefault();
                handleCutSelected();
            } else if (event.ctrlKey && event.key === 'v' && isPasteAvailable()) {
                event.preventDefault();
                handlePaste();
            } else if (event.key === 'ArrowUp' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                handleArrowNavigation('up', allFiles);
            } else if (event.key === 'ArrowDown' && !event.target.matches('input, textarea')) {
                event.preventDefault();
                handleArrowNavigation('down', allFiles);
            } else if (event.key === 'Escape') {
                clearSelection();
                closeContextMenu();
                closeEmptySpaceContextMenu();
            }
        }, 50), // Faster response for keyboard
        [
            handleRefresh, 
            handleNavigateUp, 
            selectedFiles, 
            allFiles, 
            handleFileOpen, 
            selectAll, 
            handleCopySelected, 
            handleCutSelected, 
            handlePaste, 
            isPasteAvailable, 
            handleArrowNavigation, 
            clearSelection, 
            closeContextMenu, 
            closeEmptySpaceContextMenu,
            handleRename,
            handleDeleteToTrash,
            handlePermanentDelete,
            isDialogOpen
        ]
    );

    // Keyboard shortcuts
    useEffect(() => {
        window.addEventListener('keydown', keyboardHandler);
        return () => window.removeEventListener('keydown', keyboardHandler);
    }, [keyboardHandler]);
} 