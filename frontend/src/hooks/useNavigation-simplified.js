import { useState, useCallback } from "preact/hooks";
import { NavigateToPath } from "../../wailsjs/go/backend/App";
import { log, error } from "../utils/logger";

export function useNavigation(setError) {
    const [currentPath, setCurrentPath] = useState('');
    const [directoryContents, setDirectoryContents] = useState(null);
    const [loading, setLoading] = useState(false);

    const navigateToPath = useCallback(async (path) => {
        log(`🧭 Navigating to: ${path}`);
        
        setLoading(true);
        setError('');
        
        try {
            const response = await NavigateToPath(path);
            
            if (response && response.success) {
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
            } else {
                const errorMsg = response?.message || 'Navigation failed';
                setError(errorMsg);
                error('❌ Navigation failed:', errorMsg);
            }
        } catch (err) {
            error('❌ Navigation error:', err);
            setError('Failed to navigate: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [setError]);

    const handleNavigateUp = useCallback(() => {
        if (!currentPath) return;
        
        const pathParts = currentPath.split(/[/\\]/);
        if (pathParts.length > 1) {
            const parentPath = pathParts.slice(0, -1).join('\\');
            navigateToPath(parentPath);
        }
    }, [currentPath, navigateToPath]);

    const handleRefresh = useCallback(() => {
        if (currentPath) {
            navigateToPath(currentPath);
        }
    }, [currentPath, navigateToPath]);

    return {
        currentPath,
        directoryContents,
        loading,
        navigateToPath,
        handleNavigateUp,
        handleRefresh
    };
} 