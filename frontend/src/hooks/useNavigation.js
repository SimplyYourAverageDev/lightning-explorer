import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { NavigateToPath } from "../../wailsjs/go/backend/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { log, error } from "../utils/logger";

export function useNavigation(setError, setNavigationStats) {
    const [currentPath, setCurrentPath] = useState('');
    const [directoryContents, setDirectoryContents] = useState(null);
    const [isActuallyLoading, setIsActuallyLoading] = useState(true);
    const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
    
    // Performance tracking refs
    const navigationStartTime = useRef(null);
    const loadingTimeout = useRef(null);
    const renderCompleteCallback = useRef(null);

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

    // Helper function to measure render completion time
    const measureRenderTime = useCallback((startTime, source = 'unknown') => {
        // Wait for multiple animation frames to ensure rendering is complete
        // This accounts for: DOM updates, style calculations, layout, paint, and composite
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    const totalTime = Date.now() - startTime;
                    const renderPhaseTime = totalTime - (source === 'backend' ? 0 : 0); // Can track backend vs render split if needed
                    
                    // Update performance stats with the complete UI render time
                    setNavigationStats(prev => ({
                        totalNavigations: prev.totalNavigations + 1,
                        averageTime: (prev.averageTime * prev.totalNavigations + totalTime) / (prev.totalNavigations + 1),
                        lastNavigationTime: totalTime
                    }));
                    
                    log(`✅ Complete navigation with UI render: ${totalTime}ms total (includes backend + rendering)`);
                    
                    // Clear the callback reference
                    renderCompleteCallback.current = null;
                });
            });
        });
    }, [setNavigationStats]);

    // Navigate to path with real-time fresh data
    const navigateToPath = useCallback(async (path, source = 'user') => {
        log(`🧭 Navigation request: ${path} (${source}) - Real-time mode`);
        navigationStartTime.current = Date.now();
        
        // Clear any pending render completion callback
        if (renderCompleteCallback.current) {
            renderCompleteCallback.current = null;
        }
        
        // Set measuring state to show progress in UI
        setNavigationStats(prev => ({
            ...prev,
            lastNavigationTime: 0 // This will trigger "Measuring..." display
        }));
        
        try {
            setError('');
            
            // Always fetch fresh data from backend (no caching)
            setIsActuallyLoading(true);
            showSmartLoadingIndicator();
            
            // Backend call with optimized timeout
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Navigation timeout')), 5000);
            });
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            if (response && response.success) {
                const backendTime = Date.now() - navigationStartTime.current;
                log(`📊 Fresh backend response received in ${backendTime}ms, starting UI render...`);
                
                setCurrentPath(response.data.currentPath);
                setDirectoryContents(response.data);
                
                // Measure render completion time for fresh data
                measureRenderTime(navigationStartTime.current, 'backend');
                
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
    }, [setError, measureRenderTime, showSmartLoadingIndicator, hideLoadingIndicator]);

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

    // Listen for progressive hydration events
    useEffect(() => {
        const unsubscribeHydrate = EventsOn("DirectoryHydrate", (fileInfo) => {
            log(`🔄 Hydrating file: ${fileInfo.name}`);
            
            setDirectoryContents(prev => {
                if (!prev) return prev;
                
                // Find and update the matching entry
                const allFiles = [...prev.directories, ...prev.files];
                const updatedFiles = allFiles.map(file => 
                    file.path === fileInfo.path ? fileInfo : file
                );
                
                // Split back into directories and files
                const directories = updatedFiles.filter(f => f.isDir);
                const files = updatedFiles.filter(f => !f.isDir);
                
                return {
                    ...prev,
                    directories,
                    files,
                    totalDirs: directories.length,
                    totalFiles: files.length
                };
            });
        });

        const unsubscribeComplete = EventsOn("DirectoryComplete", (data) => {
            log(`✅ Directory hydration completed: ${data.path} (${data.totalFiles} files processed)`);
            
            // Update performance stats to reflect completion
            setNavigationStats(prev => ({
                ...prev,
                lastHydrationTime: Date.now()
            }));
        });
        
        return () => {
            EventsOff("DirectoryHydrate");
            EventsOff("DirectoryComplete");
        };
    }, [setNavigationStats]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (loadingTimeout.current) {
                clearTimeout(loadingTimeout.current);
            }
            if (renderCompleteCallback.current) {
                renderCompleteCallback.current = null;
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