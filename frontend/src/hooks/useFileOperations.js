import { useCallback } from "preact/hooks";
import { log, warn, error } from "../utils/logger";
import { 
    CopyFiles,
    MoveFiles,
    DeleteFiles,
    MoveFilesToRecycleBin,
    RenameFile,
    OpenFile,
    OpenInSystemExplorer,
    OpenPowerShellHere,
    HideFiles
} from "../../wailsjs/go/backend/App";

export const useFileOperations = (currentPath, setError, clearSelection, handleRefresh, showDialog) => {
    const handleFileOpen = useCallback((file) => {
        log('🔍 Opening file/folder:', file);
        log('📊 File properties - Name:', file.name, 'IsDir:', file.isDir, 'Path:', file.path);
        
        try {
            if (file.isDir) {
                log('📁 Navigating to folder:', file.path);
                // This will be handled by the parent component
                return { type: 'navigate', path: file.path };
            } else {
                log('📄 Opening file with default application:', file.path);
                const success = OpenFile(file.path);
                if (!success) {
                    warn('⚠️ Failed to open file with default application, falling back to explorer');
                    OpenInSystemExplorer(file.path);
                }
            }
        } catch (err) {
            error('❌ Error opening file:', err);
            setError('Failed to open file: ' + err.message);
        }
    }, [setError]);

    const handleCopyFiles = useCallback(async (filePaths) => {
        if (filePaths.length === 0 || !currentPath) return false;

        try {
            log(`📥 Copying ${filePaths.length} items to:`, currentPath);
            
            const success = await CopyFiles(filePaths, currentPath);
            
            if (success) {
                log('✅ Copy operation successful');
                clearSelection();
                setTimeout(() => {
                    log('🔄 Refreshing directory after copy operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                error('❌ Copy operation failed');
                setError(`Failed to copy files to "${currentPath}". This may be due to:
• Insufficient permissions (try running as administrator)
• Destination folder is read-only
• Not enough disk space
• Files are in use by another application`);
                return false;
            }
        } catch (err) {
            error('❌ Error during copy operation:', err);
            setError('Failed to copy files: ' + err.message);
            return false;
        }
    }, [currentPath, setError, clearSelection, handleRefresh]);

    const handleMoveFiles = useCallback(async (filePaths) => {
        if (filePaths.length === 0 || !currentPath) return false;

        try {
            log(`📥 Moving ${filePaths.length} items to:`, currentPath);
            
            const success = await MoveFiles(filePaths, currentPath);
            
            if (success) {
                log('✅ Move operation successful');
                clearSelection();
                setTimeout(() => {
                    log('🔄 Refreshing directory after move operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                error('❌ Move operation failed');
                setError(`Failed to move files to "${currentPath}". This may be due to:
• Insufficient permissions (try running as administrator)
• Destination folder is read-only
• Files are in use by another application
• Cannot move across different drive types`);
                return false;
            }
        } catch (err) {
            error('❌ Error during move operation:', err);
            setError('Failed to move files: ' + err.message);
            return false;
        }
    }, [currentPath, setError, clearSelection, handleRefresh]);

    const handleRecycleBinDelete = useCallback(async (filePaths) => {
        try {
            log('🗑️ Moving files to recycle bin:', filePaths);
            console.log('🗑️ Attempting to move files to recycle bin:', filePaths);
            
            const success = await MoveFilesToRecycleBin(filePaths);
            
            if (success) {
                log('✅ Move to recycle bin successful');
                console.log('✅ Successfully moved files to recycle bin');
                clearSelection();
                setTimeout(() => {
                    log('🔄 Refreshing directory after recycle bin operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                error('❌ Move to recycle bin failed - Backend returned false');
                console.error('❌ Move to recycle bin failed - Backend returned false');
                console.error('Failed file paths:', filePaths);
                setError(`Failed to move files to recycle bin. This may be due to:
• File paths contain invalid characters
• Insufficient permissions (try running as administrator)
• Files are currently in use by another application
• Windows Recycle Bin is full or corrupted
• Files are on a network drive or external storage`);
                return false;
            }
        } catch (err) {
            error('❌ Error during recycle bin operation:', err);
            console.error('❌ Exception during recycle bin operation:', err);
            console.error('Failed file paths:', filePaths);
            setError('Failed to move files to recycle bin: ' + err.message);
            return false;
        }
    }, [setError, clearSelection, handleRefresh]);

    const handlePermanentDelete = useCallback(async (filePaths) => {
        try {
            log('🗑️ Permanently deleting files:', filePaths);
            
            const success = await DeleteFiles(filePaths);
            
            if (success) {
                log('✅ Permanent delete operation successful');
                clearSelection();
                setTimeout(() => {
                    log('🔄 Refreshing directory after permanent delete operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                error('❌ Permanent delete operation failed');
                setError('Failed to permanently delete files');
                return false;
            }
        } catch (err) {
            error('❌ Error during permanent delete operation:', err);
            setError('Failed to permanently delete files: ' + err.message);
            return false;
        }
    }, [setError, clearSelection, handleRefresh]);

    const handleRename = useCallback(async (filePath, newName) => {
        try {
            log('✏️ Renaming file:', filePath, 'to:', newName);
            
            const success = await RenameFile(filePath, newName);
            
            if (success) {
                log('✅ Rename operation successful');
                clearSelection();
                // Immediately refresh to ensure UI shows updated file paths
                // This prevents the issue where old paths are cached in file objects
                log('🔄 Refreshing directory immediately after rename operation');
                handleRefresh();
                return true;
            } else {
                error('❌ Rename operation failed');
                setError(`Failed to rename "${filePath}". This may be due to:
• A file with that name already exists
• Insufficient permissions
• Invalid characters in the new name
• File is in use by another application`);
                return false;
            }
        } catch (err) {
            error('❌ Error during rename operation:', err);
            setError('Failed to rename file: ' + err.message);
            return false;
        }
    }, [setError, clearSelection, handleRefresh]);

    const handleOpenPowerShell = useCallback(async () => {
        if (!currentPath) {
            warn('⚠️ No current path available for PowerShell');
            return;
        }
        
        try {
            log('🔧 Opening PowerShell 7 in:', currentPath);
            
            const success = await OpenPowerShellHere(currentPath);
            
            if (!success) {
                warn('⚠️ Failed to open PowerShell 7');
                setError('Failed to open PowerShell 7. Please ensure PowerShell 7 is installed at the default location.');
            } else {
                log('✅ PowerShell 7 opened successfully in:', currentPath);
            }
        } catch (err) {
            error('❌ Error opening PowerShell 7:', err);
            setError('Failed to open PowerShell 7: ' + err.message);
        }
    }, [currentPath, setError]);

    const handleHideFiles = useCallback(async (filePaths) => {
        try {
            log('👁️ Hiding files:', filePaths);
            
            const success = await HideFiles(filePaths);
            
            if (success) {
                log('✅ Hide files operation successful');
                clearSelection();
                setTimeout(() => {
                    log('🔄 Refreshing directory after hide operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                error('❌ Hide files operation failed');
                setError(`Failed to hide files. This may be due to:
• Insufficient permissions (try running as administrator)
• Files are in use by another application
• Files are on a network drive or external storage`);
                return false;
            }
        } catch (err) {
            error('❌ Error during hide files operation:', err);
            setError('Failed to hide files: ' + err.message);
            return false;
        }
    }, [setError, clearSelection, handleRefresh]);

    return {
        handleFileOpen,
        handleCopyFiles,
        handleMoveFiles,
        handleRecycleBinDelete,
        handlePermanentDelete,
        handleRename,
        handleOpenPowerShell,
        handleHideFiles
    };
}; 
