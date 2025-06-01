import { useCallback } from "preact/hooks";
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
        console.log('🔍 Opening file/folder:', file);
        console.log('📊 File properties - Name:', file.name, 'IsDir:', file.isDir, 'Path:', file.path);
        
        try {
            if (file.isDir) {
                console.log('📁 Navigating to folder:', file.path);
                // This will be handled by the parent component
                return { type: 'navigate', path: file.path };
            } else {
                console.log('📄 Opening file with default application:', file.path);
                const success = OpenFile(file.path);
                if (!success) {
                    console.warn('⚠️ Failed to open file with default application, falling back to explorer');
                    OpenInSystemExplorer(file.path);
                }
            }
        } catch (err) {
            console.error('❌ Error opening file:', err);
            setError('Failed to open file: ' + err.message);
        }
    }, [setError]);

    const handleCopyFiles = useCallback(async (filePaths) => {
        if (filePaths.length === 0 || !currentPath) return false;

        try {
            console.log(`📥 Copying ${filePaths.length} items to:`, currentPath);
            
            const success = await CopyFiles(filePaths, currentPath);
            
            if (success) {
                console.log('✅ Copy operation successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after copy operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                console.error('❌ Copy operation failed');
                setError(`Failed to copy files to "${currentPath}". This may be due to:
• Insufficient permissions (try running as administrator)
• Destination folder is read-only
• Not enough disk space
• Files are in use by another application`);
                return false;
            }
        } catch (err) {
            console.error('❌ Error during copy operation:', err);
            setError('Failed to copy files: ' + err.message);
            return false;
        }
    }, [currentPath, setError, clearSelection, handleRefresh]);

    const handleMoveFiles = useCallback(async (filePaths) => {
        if (filePaths.length === 0 || !currentPath) return false;

        try {
            console.log(`📥 Moving ${filePaths.length} items to:`, currentPath);
            
            const success = await MoveFiles(filePaths, currentPath);
            
            if (success) {
                console.log('✅ Move operation successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after move operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                console.error('❌ Move operation failed');
                setError(`Failed to move files to "${currentPath}". This may be due to:
• Insufficient permissions (try running as administrator)
• Destination folder is read-only
• Files are in use by another application
• Cannot move across different drive types`);
                return false;
            }
        } catch (err) {
            console.error('❌ Error during move operation:', err);
            setError('Failed to move files: ' + err.message);
            return false;
        }
    }, [currentPath, setError, clearSelection, handleRefresh]);

    const handleRecycleBinDelete = useCallback(async (filePaths) => {
        try {
            console.log('🗑️ Moving files to recycle bin:', filePaths);
            
            const success = await MoveFilesToRecycleBin(filePaths);
            
            if (success) {
                console.log('✅ Move to recycle bin successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after recycle bin operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                console.error('❌ Move to recycle bin failed');
                setError('Failed to move files to recycle bin');
                return false;
            }
        } catch (err) {
            console.error('❌ Error during recycle bin operation:', err);
            setError('Failed to move files to recycle bin: ' + err.message);
            return false;
        }
    }, [setError, clearSelection, handleRefresh]);

    const handlePermanentDelete = useCallback(async (filePaths) => {
        try {
            console.log('🗑️ Permanently deleting files:', filePaths);
            
            const success = await DeleteFiles(filePaths);
            
            if (success) {
                console.log('✅ Permanent delete operation successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after permanent delete operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                console.error('❌ Permanent delete operation failed');
                setError('Failed to permanently delete files');
                return false;
            }
        } catch (err) {
            console.error('❌ Error during permanent delete operation:', err);
            setError('Failed to permanently delete files: ' + err.message);
            return false;
        }
    }, [setError, clearSelection, handleRefresh]);

    const handleRename = useCallback(async (filePath, newName) => {
        try {
            console.log('✏️ Renaming file:', filePath, 'to:', newName);
            
            const success = await RenameFile(filePath, newName);
            
            if (success) {
                console.log('✅ Rename operation successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after rename operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                console.error('❌ Rename operation failed');
                setError(`Failed to rename "${filePath}". This may be due to:
• A file with that name already exists
• Insufficient permissions
• Invalid characters in the new name
• File is in use by another application`);
                return false;
            }
        } catch (err) {
            console.error('❌ Error during rename operation:', err);
            setError('Failed to rename file: ' + err.message);
            return false;
        }
    }, [setError, clearSelection, handleRefresh]);

    const handleOpenPowerShell = useCallback(async () => {
        if (!currentPath) {
            console.warn('⚠️ No current path available for PowerShell');
            return;
        }
        
        try {
            console.log('🔧 Opening PowerShell 7 in:', currentPath);
            
            const success = await OpenPowerShellHere(currentPath);
            
            if (!success) {
                console.warn('⚠️ Failed to open PowerShell 7');
                setError('Failed to open PowerShell 7. Please ensure PowerShell 7 is installed at the default location.');
            } else {
                console.log('✅ PowerShell 7 opened successfully in:', currentPath);
            }
        } catch (err) {
            console.error('❌ Error opening PowerShell 7:', err);
            setError('Failed to open PowerShell 7: ' + err.message);
        }
    }, [currentPath, setError]);

    const handleHideFiles = useCallback(async (filePaths) => {
        try {
            console.log('👁️ Hiding files:', filePaths);
            
            const success = await HideFiles(filePaths);
            
            if (success) {
                console.log('✅ Hide files operation successful');
                clearSelection();
                setTimeout(() => {
                    console.log('🔄 Refreshing directory after hide operation');
                    handleRefresh();
                }, 50);
                return true;
            } else {
                console.error('❌ Hide files operation failed');
                setError(`Failed to hide files. This may be due to:
• Insufficient permissions (try running as administrator)
• Files are in use by another application
• Files are on a network drive or external storage`);
                return false;
            }
        } catch (err) {
            console.error('❌ Error during hide files operation:', err);
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