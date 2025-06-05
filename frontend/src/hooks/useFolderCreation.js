import { useState, useCallback, useRef } from "preact/hooks";
import { log, error } from "../utils/logger";
import { serializationUtils, EnhancedAPI } from "../utils/serialization";

export function useFolderCreation(currentPath, onRefresh, setError) {
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [tempFolderName, setTempFolderName] = useState("New folder");
    const editInputRef = useRef(null);
    const isProcessingRef = useRef(false);

    const startFolderCreation = useCallback(() => {
        if (!currentPath) return;
        
        setCreatingFolder(true);
        setTempFolderName("New folder");
        isProcessingRef.current = false;
        
        // Focus the input in the next tick
        setTimeout(() => {
            if (editInputRef.current) {
                editInputRef.current.focus();
                editInputRef.current.select();
            }
        }, 100);
    }, [currentPath]);

    const cancelFolderCreation = useCallback(() => {
        setCreatingFolder(false);
        setTempFolderName("New folder");
        isProcessingRef.current = false;
    }, []);

    const confirmFolderCreation = useCallback(async () => {
        // Prevent double execution
        if (isProcessingRef.current) {
            return;
        }
        
        if (!currentPath || !tempFolderName.trim()) {
            cancelFolderCreation();
            return;
        }

        const folderName = tempFolderName.trim();
        
        try {
            isProcessingRef.current = true;
            log(`📁 Creating folder: "${folderName}" in ${currentPath}`);
            
            // Try to use MessagePack optimized API first, fallback to regular API
            let response;
            try {
                const wailsAPI = await import("../../wailsjs/go/backend/App");
                const enhancedAPI = new EnhancedAPI(wailsAPI, serializationUtils);
                response = await enhancedAPI.createDirectory(currentPath, folderName);
            } catch (enhancedErr) {
                // Fallback to regular API
                const { CreateDirectory } = await import("../../wailsjs/go/backend/App");
                response = await CreateDirectory(currentPath, folderName);
            }
            
            if (response && response.success) {
                log(`✅ Folder created successfully: ${folderName}`);
                
                // Refresh directory to show the new folder
                onRefresh();
                
                setCreatingFolder(false);
                setTempFolderName("New folder");
                isProcessingRef.current = false;
            } else {
                const errorMsg = response?.message || 'Failed to create folder';
                error('❌ Folder creation failed:', errorMsg);
                setError(`Failed to create folder: ${errorMsg}`);
                cancelFolderCreation();
            }
        } catch (err) {
            error('❌ Error creating folder:', err);
            setError(`Error creating folder: ${err.message}`);
            cancelFolderCreation();
        }
    }, [currentPath, tempFolderName, onRefresh, setError, cancelFolderCreation]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            confirmFolderCreation();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelFolderCreation();
        }
    }, [confirmFolderCreation, cancelFolderCreation]);

    const handleInputChange = useCallback((e) => {
        setTempFolderName(e.target.value);
    }, []);

    const handleInputBlur = useCallback(() => {
        // Delay to allow for clicks on other elements
        setTimeout(() => {
            // Only confirm if still creating folder, not already processing, and the input still exists
            // This prevents double confirmation when Enter is pressed
            if (creatingFolder && !isProcessingRef.current && editInputRef.current) {
                confirmFolderCreation();
            }
        }, 100);
    }, [creatingFolder, confirmFolderCreation]);

    return {
        creatingFolder,
        tempFolderName,
        editInputRef,
        startFolderCreation,
        cancelFolderCreation,
        confirmFolderCreation,
        handleKeyDown,
        handleInputChange,
        handleInputBlur
    };
} 