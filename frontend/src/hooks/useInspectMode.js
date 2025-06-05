import { useState, useEffect, useCallback } from "preact/hooks";
import { log } from "../utils/logger";

export function useInspectMode() {
    const [isInspectMode, setIsInspectMode] = useState(false);
    const [inspectMenu, setInspectMenu] = useState({
        visible: false,
        x: 0,
        y: 0,
        element: null
    });

    // Toggle inspect mode with F7
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'F7') {
                event.preventDefault();
                setIsInspectMode(prev => {
                    const newMode = !prev;
                    log(`🔍 Inspect mode ${newMode ? 'enabled' : 'disabled'}`);
                    
                    // Close any open inspect menu when toggling mode
                    if (!newMode) {
                        setInspectMenu({ visible: false, x: 0, y: 0, element: null });
                    }
                    
                    return newMode;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Handle inspect clicks
    const handleInspectClick = useCallback((event) => {
        if (!isInspectMode) return false;

        event.preventDefault();
        event.stopPropagation();

        const element = event.target;
        const rect = element.getBoundingClientRect();
        
        setInspectMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            element: element
        });

        log('🔍 Element selected for inspection:', element);
        return true;
    }, [isInspectMode]);

    // Handle inspect right-clicks (show native context menu)
    const handleInspectContextMenu = useCallback((event) => {
        if (!isInspectMode) return false;

        // Allow native context menu in inspect mode
        log('🔍 Showing native context menu for element:', event.target);
        return false; // Don't prevent default
    }, [isInspectMode]);

    const closeInspectMenu = useCallback(() => {
        setInspectMenu({ visible: false, x: 0, y: 0, element: null });
    }, []);

    // Close inspect menu when clicking outside
    useEffect(() => {
        if (!inspectMenu.visible) return;

        const handleClickOutside = (event) => {
            if (!event.target.closest('.inspect-menu')) {
                closeInspectMenu();
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [inspectMenu.visible, closeInspectMenu]);

    return {
        isInspectMode,
        inspectMenu,
        handleInspectClick,
        handleInspectContextMenu,
        closeInspectMenu,
        setIsInspectMode
    };
} 