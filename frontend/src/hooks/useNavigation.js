import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { NavigateToPath } from "../../wailsjs/go/backend/App";
import { navCache, prefetcher } from "../services/NavigationService";

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

    // Prefetch sibling directories for fast navigation
    const prefetchSiblingDirectories = useCallback(async (path) => {
        try {
            const parentPath = path.includes('\\') ? path.split('\\').slice(0, -1).join('\\') : path.split('/').slice(0, -1).join('/');
            if (parentPath && parentPath !== path) {
                const cached = navCache.get(parentPath);
                if (cached) {
                    // Prefetch up to 5 sibling directories
                    const siblings = cached.directories.slice(0, 5).map(dir => dir.path);
                    prefetcher.prefetch(siblings);
                }
            }
        } catch (err) {
            console.log('Prefetch siblings failed:', err);
        }
    }, []);

    // Prefetch common navigation targets
    const prefetchNavigationTargets = useCallback(async (directoryData) => {
        try {
            const prefetchTargets = [];
            
            // Prefetch parent directory
            if (directoryData.parentPath) {
                prefetchTargets.push(directoryData.parentPath);
            }
            
            // Prefetch first few subdirectories (most likely to be accessed)
            const subDirs = directoryData.directories.slice(0, 3).map(dir => dir.path);
            prefetchTargets.push(...subDirs);
            
            prefetcher.prefetch(prefetchTargets);
        } catch (err) {
            console.log('Prefetch targets failed:', err);
        }
    }, []);

    // Ultra-fast navigation with intelligent caching and prefetching
    const navigateToPath = useCallback(async (path, source = 'user') => {
        console.log(`🧭 Navigation request: ${path} (${source})`);
        navigationStartTime.current = Date.now();
        
        try {
            setError('');
            
            // Check frontend cache first - INSTANT response
            const cached = navCache.get(path);
            if (cached) {
                setCurrentPath(cached.currentPath);
                setDirectoryContents(cached);
                hideLoadingIndicator();
                
                // Update stats
                setNavigationStats(prev => ({
                    totalNavigations: prev.totalNavigations + 1,
                    cacheHits: prev.cacheHits + 1,
                    averageTime: (prev.averageTime * prev.totalNavigations + (Date.now() - navigationStartTime.current)) / (prev.totalNavigations + 1)
                }));

                // Prefetch sibling directories and common navigation targets
                if (source === 'user') {
                    prefetchSiblingDirectories(path);
                }
                
                return;
            }

            // Show loading indicator with smart delay
            setIsActuallyLoading(true);
            showSmartLoadingIndicator();
            
            // Backend call with optimized timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigation timeout')), 5000);
            });
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            if (response && response.success) {
                // Cache the result for future use
                navCache.set(path, response.data);
                
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                
                // Update performance stats
                const navigationTime = Date.now() - navigationStartTime.current;
                setNavigationStats(prev => ({
                    totalNavigations: prev.totalNavigations + 1,
                    cacheHits: prev.cacheHits,
                    averageTime: (prev.averageTime * prev.totalNavigations + navigationTime) / (prev.totalNavigations + 1)
                }));
                
                console.log(`✅ Navigation completed in ${navigationTime}ms: ${response.data.currentPath}`);
                
                // Prefetch likely navigation targets
                if (source === 'user') {
                    prefetchNavigationTargets(response.data);
                }
            } else {
                const errorMsg = response?.message || 'Unknown navigation error';
                setError(errorMsg);
                console.error('❌ Navigation failed:', errorMsg);
            }
        } catch (err) {
            console.error('❌ Navigation error:', err);
            setError('Failed to navigate: ' + err.message);
        } finally {
            setIsActuallyLoading(false);
            hideLoadingIndicator();
        }
    }, [setError, setNavigationStats, showSmartLoadingIndicator, hideLoadingIndicator, prefetchSiblingDirectories, prefetchNavigationTargets]);

    // Optimized navigate up
    const handleNavigateUp = useCallback(async () => {
        if (!currentPath) return;
        
        try {
            // For navigate up, we can often predict the parent path instantly
            const parentPath = currentPath.includes('\\') 
                ? currentPath.split('\\').slice(0, -1).join('\\')
                : currentPath.split('/').slice(0, -1).join('/');
                
            if (parentPath && parentPath !== currentPath) {
                await navigateToPath(parentPath, 'navigate-up');
            }
        } catch (err) {
            console.error('❌ Navigate up error:', err);
            setError('Failed to navigate up: ' + err.message);
        }
    }, [currentPath, navigateToPath, setError]);

    const handleRefresh = useCallback(() => {
        if (currentPath) {
            // Clear cache for current path to force refresh
            navCache.cache.delete(currentPath);
            navigateToPath(currentPath, 'refresh');
        }
    }, [currentPath, navigateToPath]);

    const clearCache = useCallback(() => {
        navCache.clear();
        console.log('🧹 Manual cache clear requested');
    }, []);

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
        handleRefresh,
        clearCache
    };
} 