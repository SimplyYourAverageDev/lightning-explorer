import { useState, useCallback, useMemo } from "preact/hooks";

// Optimized state hook that combines related states to reduce re-renders
export const useOptimizedState = () => {
    // Consolidated navigation state
    const [navigationState, setNavigationState] = useState({
        currentPath: '',
        directoryContents: null,
        isLoading: true,
        error: '',
        drives: []
    });

    // Consolidated UI state
    const [uiState, setUiState] = useState({
        showHiddenFiles: false,
        selectedFiles: new Set(),
        lastSelectedIndex: -1,
        isDragging: false,
        dragOverFolder: null
    });

    // Consolidated context menu state
    const [contextMenuState, setContextMenuState] = useState({
        main: { visible: false, x: 0, y: 0, files: [] },
        emptySpace: { visible: false, x: 0, y: 0 }
    });

    // Consolidated dialog state
    const [dialogState, setDialogState] = useState({
        isOpen: false,
        type: 'alert',
        title: '',
        message: '',
        defaultValue: '',
        onConfirm: () => {},
        onCancel: () => {}
    });

    // Memoized update functions to prevent unnecessary re-renders
    const updateNavigation = useCallback((updates) => {
        setNavigationState(prev => ({ ...prev, ...updates }));
    }, []);

    const updateUI = useCallback((updates) => {
        setUiState(prev => ({ ...prev, ...updates }));
    }, []);

    const updateContextMenu = useCallback((updates) => {
        setContextMenuState(prev => ({ ...prev, ...updates }));
    }, []);

    const updateDialog = useCallback((updates) => {
        setDialogState(prev => ({ ...prev, ...updates }));
    }, []);

    // Optimized clear selection
    const clearSelection = useCallback(() => {
        updateUI({
            selectedFiles: new Set(),
            lastSelectedIndex: -1
        });
    }, [updateUI]);

    // Optimized close context menus
    const closeContextMenus = useCallback(() => {
        setContextMenuState({
            main: { visible: false, x: 0, y: 0, files: [] },
            emptySpace: { visible: false, x: 0, y: 0 }
        });
    }, []);

    return {
        // States
        navigationState,
        uiState,
        contextMenuState,
        dialogState,
        
        // Update functions
        updateNavigation,
        updateUI,
        updateContextMenu,
        updateDialog,
        
        // Helper functions
        clearSelection,
        closeContextMenus
    };
}; 