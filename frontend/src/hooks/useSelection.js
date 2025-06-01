import { useState, useCallback } from "preact/hooks";

export const useSelection = () => {
    const [selectedFiles, setSelectedFiles] = useState(new Set());
    const [lastSelectedIndex, setLastSelectedIndex] = useState(-1);

    const handleFileSelect = useCallback((fileIndex, isShiftKey, isCtrlKey) => {
        console.log('📋 File selection:', fileIndex, 'Shift:', isShiftKey, 'Ctrl:', isCtrlKey);
        
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
        console.log('📋 Cleared selection');
    }, []);

    const selectAll = useCallback((totalFiles) => {
        const allIndices = new Set();
        for (let i = 0; i < totalFiles; i++) {
            allIndices.add(i);
        }
        setSelectedFiles(allIndices);
        console.log('📋 Selected all files:', allIndices.size);
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
        
        console.log(`⬆️⬇️ Arrow navigation ${direction}: moving to index ${targetIndex} (${allFiles[targetIndex]?.name})`);
        
        // Select the target file
        setSelectedFiles(new Set([targetIndex]));
        setLastSelectedIndex(targetIndex);
        
        return targetIndex;
    }, [selectedFiles]);

    return {
        selectedFiles,
        lastSelectedIndex,
        handleFileSelect,
        clearSelection,
        selectAll,
        handleArrowNavigation
    };
}; 