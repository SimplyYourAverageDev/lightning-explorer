import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { NavigateToPath } from "../../wailsjs/go/backend/App";
import { log, error } from "../utils/logger";

export function useNavigation(setError, setNavigationStats) {
    const [currentPath, setCurrentPath] = useState('');
    const [directoryContents, setDirectoryContents] = useState(null);
    const [isActuallyLoading, setIsActuallyLoading] = useState(true);
    const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
    
    // Performance tracking refs
    const navigationStartTime = useRef(null);
    const loadingTimeout = useRef(null);

    // Smart loading indicator management
    const showSmartLoadingIndicator = useCallback(() => {
        // Clear any existing timeout
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
        }
        
        // Only show loading after 150ms delay for perceived speed
        loadingTimeout.current = setTimeout(() => {
            if (isActuallyLoading) {
                setShowLoadingIndicator(true);
            }
        }, 150);
    }, [isActuallyLoading]);

    const hideLoadingIndicator = useCallback(() => {
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
            loadingTimeout.current = null;
        }
        setShowLoadingIndicator(false);
    }, []);

    // Navigate to path - always loads from backend
    const navigateToPath = useCallback(async (path, source = 'user') => {
        log(`🧭 Navigation request: ${path} (${source})`);
        navigationStartTime.current = Date.now();
        
        try {
            setError('');
            
            // Show loading indicator
            setIsActuallyLoading(true);
            showSmartLoadingIndicator();
            
            // Backend call with optimized timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigation timeout')), 5000);
            });
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            if (response && response.success) {
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                
                // Update performance stats
                const navigationTime = Date.now() - navigationStartTime.current;
                setNavigationStats(prev => ({
                    totalNavigations: prev.totalNavigations + 1,
                    cacheHits: prev.cacheHits,
                    averageTime: (prev.averageTime * prev.totalNavigations + navigationTime) / (prev.totalNavigations + 1),
                    lastNavigationTime: Date.now() - navigationStartTime.current
                }));
                
                log(`✅ Navigation completed in ${navigationTime}ms: ${response.data.currentPath}`);
            } else {
                const errorMsg = response?.message || 'Unknown navigation error';
                setError(errorMsg);
                error('❌ Navigation failed:', errorMsg);
            }
        } catch (err) {
            error('❌ Navigation error:', err);
            setError('Failed to navigate: ' + err.message);
        } finally {
            setIsActuallyLoading(false);
            hideLoadingIndicator();
        }
    }, [setError, setNavigationStats, showSmartLoadingIndicator, hideLoadingIndicator]);

    // Navigate up
    const handleNavigateUp = useCallback(async () => {
        if (!currentPath) return;
        
        try {
            // Calculate parent path
            const parentPath = currentPath.includes('\\') 
                ? currentPath.split('\\').slice(0, -1).join('\\')
                : currentPath.split('/').slice(0, -1).join('/');
                
            if (parentPath && parentPath !== currentPath) {
                await navigateToPath(parentPath, 'navigate-up');
            }
        } catch (err) {
            error('❌ Navigate up error:', err);
            setError('Failed to navigate up: ' + err.message);
        }
    }, [currentPath, navigateToPath, setError]);

    const handleRefresh = useCallback(() => {
        if (currentPath) {
            navigateToPath(currentPath, 'refresh');
        }
    }, [currentPath, navigateToPath]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (loadingTimeout.current) {
                clearTimeout(loadingTimeout.current);
            }
        };
    }, []);

    return {
        currentPath,
        directoryContents,
        isActuallyLoading,
        showLoadingIndicator,
        navigateToPath,
        handleNavigateUp,
        handleRefresh
    };
} 