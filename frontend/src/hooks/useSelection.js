import { useState, useCallback, useRef } from "preact/hooks";
import { log } from "../utils/logger";

export const useSelection = (scrollToItem) => {
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);
    const scrollTimeoutRef = useRef(null);

    const handleFileSelect = useCallback((fileIndex, isShiftKey, isCtrlKey) => {
        log('📋 File selection:', fileIndex, 'Shift:', isShiftKey, 'Ctrl:', isCtrlKey);
        
        setSelectedFiles(prevSelected => {
            const newSelected = new Set(prevSelected);
            
            if (isShiftKey && lastSelectedIndex !== -1) {
                // Range selection
                const start = Math.min(lastSelectedIndex, fileIndex);
                const end = Math.max(lastSelectedIndex, fileIndex);
                
                for (let i = start; i <= end; i++) {
                    newSelected.add(i);
                }
            } else if (isCtrlKey) {
                // Toggle selection
                if (newSelected.has(fileIndex)) {
                    newSelected.delete(fileIndex);
                } else {
                    newSelected.add(fileIndex);
                }
            } else {
                // Single selection
                newSelected.clear();
                newSelected.add(fileIndex);
            }
            
            return newSelected;
        });
        
        setLastSelectedIndex(fileIndex);
    }, [lastSelectedIndex]);

    const clearSelection = useCallback(() => {
        setSelectedFiles(new Set());
        setLastSelectedIndex(-1);
        log('📋 Cleared selection');
    }, []);

    const selectAll = useCallback((totalFiles) => {
        const allIndices = new Set();
        for (let i = 0; i < totalFiles; i++) {
            allIndices.add(i);
        }
        setSelectedFiles(allIndices);
        log('📋 Selected all files:', allIndices.size);
    }, []);

    const handleArrowNavigation = useCallback((direction, allFiles) => {
        if (allFiles.length === 0) return;
        
        let targetIndex;
        
        if (selectedFiles.size === 1) {
            // Move from current selection
            const currentIndex = Array.from(selectedFiles)[0];
            
            if (direction === 'up') {
                targetIndex = currentIndex > 0 ? currentIndex - 1 : allFiles.length - 1; // Wrap to bottom
            } else {
                targetIndex = currentIndex < allFiles.length - 1 ? currentIndex + 1 : 0; // Wrap to top
            }
        } else {
            // No selection or multiple selections - select first/last item
            if (direction === 'up') {
                targetIndex = allFiles.length - 1; // Select last item
            } else {
                targetIndex = 0; // Select first item
            }
        }
        
        log(`⬆️⬇️ Arrow navigation ${direction}: moving to index ${targetIndex} (${allFiles[targetIndex]?.name})`);
        
        // Select the target file
        setSelectedFiles(new Set([targetIndex]));
        setLastSelectedIndex(targetIndex);
        
        // Scroll to the target item to ensure it's visible
        if (scrollToItem && typeof scrollToItem === 'function') {
            // Clear any existing scroll timeout to prevent queueing up scroll operations
            if (scrollTimeoutRef.current) {
                clearTimeout(scrollTimeoutRef.current);
            }
            
            // Use a short timeout to debounce rapid arrow key presses
            scrollTimeoutRef.current = setTimeout(() => {
                scrollToItem(targetIndex);
                scrollTimeoutRef.current = null;
            }, 16); // ~60fps to feel responsive but not overwhelming
        }
        
        return targetIndex;
    }, [selectedFiles, scrollToItem]);

    return {
        selectedFiles,
        lastSelectedIndex,
        handleFileSelect,
        clearSelection,
        selectAll,
        handleArrowNavigation
    };
}; 