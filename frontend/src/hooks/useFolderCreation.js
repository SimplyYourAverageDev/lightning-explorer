import { useState, useCallback, useRef } from "preact/hooks";
import { CreateDirectory } from "../../wailsjs/go/backend/App";
import { log, error } from "../utils/logger";

export function useFolderCreation(currentPath, onRefresh, setError) {
    const [creatingFolder, setCreatingFolder] = useState(false);
    const [tempFolderName, setTempFolderName] = useState("New folder");
    const editInputRef = useRef(null);

    const startFolderCreation = useCallback(() => {
        if (!currentPath) return;
        
        setCreatingFolder(true);
        setTempFolderName("New folder");
        
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
    }, []);

    const confirmFolderCreation = useCallback(async () => {
        if (!currentPath || !tempFolderName.trim()) {
            cancelFolderCreation();
            return;
        }

        const folderName = tempFolderName.trim();
        
        try {
            log(`📁 Creating folder: "${folderName}" in ${currentPath}`);
            
            const response = await CreateDirectory(currentPath, folderName);
            
            if (response && response.success) {
                log(`✅ Folder created successfully: ${folderName}`);
                
                // Refresh directory to show the new folder
                onRefresh();
                
                setCreatingFolder(false);
                setTempFolderName("New folder");
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
            if (creatingFolder) {
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