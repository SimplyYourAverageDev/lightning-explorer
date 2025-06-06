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
    
    // SECURITY FIX: Track active navigation promises to prevent race conditions
    const activeNavigationRef = useRef(null);
    const navigationTimeoutRef = useRef(null);

    // MEMORY LEAK FIX: Comprehensive cleanup function
    const cleanup = useCallback(() => {
        // Clear all timeouts
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
            loadingTimeout.current = null;
        }
        
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
            navigationTimeoutRef.current = null;
        }
        
        // Clear render callback
        if (renderCompleteCallback.current) {
            renderCompleteCallback.current = null;
        }
        
        // Cancel active navigation
        if (activeNavigationRef.current) {
            activeNavigationRef.current.cancelled = true;
            activeNavigationRef.current = null;
        }
    }, []);

    // Smart loading indicator management with proper cleanup
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

    // RACE CONDITION FIX: Navigate to path with race condition prevention
    const navigateToPath = useCallback(async (path, source = 'user') => {
        log(`🧭 Navigation request: ${path} (${source}) - Real-time mode`);
        
        // Cancel any previous navigation
        if (activeNavigationRef.current) {
            activeNavigationRef.current.cancelled = true;
        }
        
        // Clear previous timeout
        if (navigationTimeoutRef.current) {
            clearTimeout(navigationTimeoutRef.current);
            navigationTimeoutRef.current = null;
        }
        
        // Create new navigation context
        const navigationContext = { cancelled: false };
        activeNavigationRef.current = navigationContext;
        
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
            
            // TIMEOUT FIX: Create proper timeout with cleanup
            let timeoutId;
            const timeoutPromise = new Promise((_, reject) => {
                timeoutId = setTimeout(() => {
                    reject(new Error('Navigation timeout'));
                }, 5000);
            });
            
            // Store timeout ID for cleanup
            navigationTimeoutRef.current = timeoutId;
            
            const navigationPromise = NavigateToPath(path);
            const response = await Promise.race([navigationPromise, timeoutPromise]);
            
            // Clear timeout on successful completion
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
                navigationTimeoutRef.current = null;
            }
            
            // Check if this navigation was cancelled
            if (navigationContext.cancelled) {
                log(`🚫 Navigation cancelled: ${path}`);
                return;
            }
            
            if (response && response.success) {
                const backendTime = Date.now() - navigationStartTime.current;
                log(`📊 Fresh backend response received in ${backendTime}ms, starting UI render...`);
                
                // Only update state if navigation wasn't cancelled
                if (!navigationContext.cancelled) {
                    setCurrentPath(response.data.currentPath);
                    setDirectoryContents(response.data);
                    
                    // Measure render completion time for fresh data
                    measureRenderTime(navigationStartTime.current, 'backend');
                }
                
            } else {
                const errorMsg = response?.message || 'Unknown navigation error';
                if (!navigationContext.cancelled) {
                    setError(errorMsg);
                    error('❌ Navigation failed:', errorMsg);
                }
            }
        } catch (err) {
            // Clear timeout on error
            if (navigationTimeoutRef.current) {
                clearTimeout(navigationTimeoutRef.current);
                navigationTimeoutRef.current = null;
            }
            
            if (!navigationContext.cancelled) {
                error('❌ Navigation error:', err);
                setError('Failed to navigate: ' + err.message);
            }
        } finally {
            // Only update loading state if navigation wasn't cancelled
            if (!navigationContext.cancelled) {
                setIsActuallyLoading(false);
                hideLoadingIndicator();
            }
            
            // Clear active navigation if it's still this one
            if (activeNavigationRef.current === navigationContext) {
                activeNavigationRef.current = null;
            }
        }
    }, [setError, measureRenderTime, showSmartLoadingIndicator, hideLoadingIndicator]);

    // Navigate up with proper path validation
    const handleNavigateUp = useCallback(async () => {
        if (!currentPath) return;
        
        try {
            // SECURITY FIX: Proper path validation for navigate up
            const cleanPath = currentPath.trim();
            if (!cleanPath) return;
            
            // Calculate parent path safely
            let parentPath;
            if (cleanPath.includes('\\')) {
                // Windows path
                const parts = cleanPath.split('\\').filter(part => part.length > 0);
                if (parts.length <= 1) return; // Already at root
                parentPath = parts.slice(0, -1).join('\\');
                // Ensure drive letter format for Windows
                if (parentPath.length === 1 && parentPath.match(/[A-Za-z]/)) {
                    parentPath += ':';
                }
                if (parentPath.length === 2 && parentPath.endsWith(':')) {
                    parentPath += '\\';
                }
            } else {
                // Unix-like path
                const parts = cleanPath.split('/').filter(part => part.length > 0);
                if (parts.length === 0) return; // Already at root
                parentPath = '/' + parts.slice(0, -1).join('/');
                if (parentPath === '/') {
                    // Already at root
                    return;
                }
            }
                
            if (parentPath && parentPath !== cleanPath) {
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

    // HYDRATION FIX: Listen for batched hydration events with optimized state updates
    useEffect(() => {
        // Handle individual file hydration (legacy - for compatibility)
        const unsubscribeHydrate = EventsOn("DirectoryHydrate", (fileInfo) => {
            logHydration(`🔄 Hydrating individual file: ${fileInfo.name}`);
            
            setDirectoryContents(prev => {
                if (!prev) return prev;
                
                // SECURITY FIX: Validate that this hydration is for the current directory
                const currentDir = prev.currentPath;
                const fileDir = fileInfo.path ? fileInfo.path.substring(0, fileInfo.path.lastIndexOf('/') || fileInfo.path.lastIndexOf('\\')) : '';
                
                // Only process hydration for files in the current directory
                if (currentDir !== fileDir) {
                    logHydration(`🚫 Ignoring hydration for ${fileInfo.path} - not in current directory ${currentDir}`);
                    return prev;
                }
                
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

        // Handle batched hydration (optimized for performance)
        const unsubscribeBatch = EventsOn("DirectoryBatch", (batchFiles) => {
            logBatch(`🔄 Hydrating batch of ${batchFiles.length} files`);
            
            setDirectoryContents(prev => {
                if (!prev || !batchFiles.length) return prev;
                
                // SECURITY FIX: Validate batch is for current directory
                const currentDir = prev.currentPath;
                const firstFile = batchFiles[0];
                const fileDir = firstFile.path ? firstFile.path.substring(0, firstFile.path.lastIndexOf('/') || firstFile.path.lastIndexOf('\\')) : '';
                
                // Only process batch for files in the current directory
                if (currentDir !== fileDir) {
                    logBatch(`🚫 Ignoring batch hydration - not in current directory ${currentDir}`);
                    return prev;
                }
                
                // Create a map for efficient lookups
                const batchMap = new Map();
                batchFiles.forEach(file => {
                    batchMap.set(file.path, file);
                });
                
                // Efficiently update existing files and add new ones
                const allFiles = [...prev.directories, ...prev.files];
                const updatedFiles = [];
                const newFiles = [];
                
                // Update existing files
                allFiles.forEach(file => {
                    if (batchMap.has(file.path)) {
                        updatedFiles.push(batchMap.get(file.path));
                        batchMap.delete(file.path); // Remove from map to track new files
                    } else {
                        updatedFiles.push(file);
                    }
                });
                
                // Add any remaining files from batch (new files)
                batchMap.forEach(file => newFiles.push(file));
                
                // Combine all files
                const finalFiles = [...updatedFiles, ...newFiles];
                
                // Split back into directories and files with efficient filtering
                const directories = [];
                const files = [];
                
                finalFiles.forEach(file => {
                    if (file.isDir) {
                        directories.push(file);
                    } else {
                        files.push(file);
                    }
                });
                
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
            EventsOff("DirectoryBatch");
            EventsOff("DirectoryComplete");
        };
    }, [setNavigationStats]);

    // MEMORY LEAK FIX: Cleanup on unmount
    useEffect(() => {
        return cleanup;
    }, [cleanup]);

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