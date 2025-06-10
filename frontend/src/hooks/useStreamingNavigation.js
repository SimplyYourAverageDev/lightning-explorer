import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { StreamDirectory } from "../../wailsjs/go/backend/App";
import { EventsOn, EventsOff } from "../../wailsjs/runtime/runtime";
import { log, error } from "../utils/logger";

export function useStreamingNavigation(setError, setNavigationStats) {
    const [currentPath, setCurrentPath] = useState('');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
    
    // Performance tracking
    const navigationStartTime = useRef(null);
    const loadingTimeout = useRef(null);
    const activeNavigationRef = useRef(null);

    // Entry buffering for batched updates
    const entryBufferRef = useRef([]);
    const flushScheduledRef = useRef(false);

    const flushBuffer = useCallback(() => {
        setFiles(prev => [...prev, ...entryBufferRef.current]);
        entryBufferRef.current = [];
        flushScheduledRef.current = false;
    }, []);

    // Smart loading indicator management
    const showSmartLoadingIndicator = useCallback(() => {
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
        }
        
        loadingTimeout.current = setTimeout(() => {
            if (loading) {
                setShowLoadingIndicator(true);
            }
        }, 150);
    }, [loading]);

    const hideLoadingIndicator = useCallback(() => {
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
            loadingTimeout.current = null;
        }
        setShowLoadingIndicator(false);
    }, []);

    // Streaming navigation function
    const navigateToPath = useCallback(async (path, source = 'user') => {
        log(`🧭 Streaming navigation request: ${path} (${source})`);
        
        // Cancel any previous navigation
        if (activeNavigationRef.current) {
            activeNavigationRef.current.cancelled = true;
        }
        
        // Create new navigation context
        const navigationContext = { cancelled: false };
        activeNavigationRef.current = navigationContext;
        
        navigationStartTime.current = Date.now();
        
        // Reset state for new navigation
        setFiles([]);
        setLoading(true);
        setError('');
        showSmartLoadingIndicator();
        
        // Set measuring state
        setNavigationStats(prev => ({
            ...prev,
            lastNavigationTime: 0
        }));

        try {
            // Start streaming directory contents
            StreamDirectory(path);
        } catch (err) {
            if (!navigationContext.cancelled) {
                error('❌ Streaming navigation error:', err);
                setError('Failed to navigate: ' + err.message);
                setLoading(false);
                hideLoadingIndicator();
            }
        }
    }, [setError, setNavigationStats, showSmartLoadingIndicator, hideLoadingIndicator]);

    // Navigate up functionality
    const handleNavigateUp = useCallback(async () => {
        if (!currentPath) return;
        
        try {
            const cleanPath = currentPath.trim();
            if (!cleanPath) return;
            
            let parentPath;
            if (cleanPath.includes('\\')) {
                // Windows path
                const parts = cleanPath.split('\\').filter(part => part.length > 0);
                if (parts.length <= 1) return;
                parentPath = parts.slice(0, -1).join('\\');
                if (parentPath.length === 1 && parentPath.match(/[A-Za-z]/)) {
                    parentPath += ':';
                }
                if (parentPath.length === 2 && parentPath.endsWith(':')) {
                    parentPath += '\\';
                }
            } else {
                const parts = cleanPath.split('/').filter(part => part.length > 0);
                if (parts.length === 0) return;
                parentPath = '/' + parts.slice(0, -1).join('/');
                if (parentPath === '/') return;
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

    // Subscribe to streaming events
    useEffect(() => {
        const onStart = (path) => {
            const navigationContext = activeNavigationRef.current;
            if (!navigationContext || navigationContext.cancelled) return;
            
            log(`📡 Directory streaming started: ${path}`);
            setFiles([]);
            setCurrentPath(path);
        };

        const onEntry = (fileInfo) => {
            const navigationContext = activeNavigationRef.current;
            if (!navigationContext || navigationContext.cancelled) return;
            
            // Buffer entries and flush in next animation frame
            entryBufferRef.current.push(fileInfo);
            if (!flushScheduledRef.current) {
                flushScheduledRef.current = true;
                requestAnimationFrame(flushBuffer);
            }
        };

        const onComplete = (data) => {
            const navigationContext = activeNavigationRef.current;
            if (!navigationContext || navigationContext.cancelled) return;

            // Flush any remaining buffered entries
            if (flushScheduledRef.current) {
                flushBuffer();
            }
            
            const totalTime = Date.now() - navigationStartTime.current;
            
            log(`✅ Directory streaming completed: ${data.path} (${data.count} entries in ${totalTime}ms)`);
            
            setLoading(false);
            hideLoadingIndicator();
            
            // Update performance stats
            setNavigationStats(prev => ({
                totalNavigations: prev.totalNavigations + 1,
                averageTime: (prev.averageTime * prev.totalNavigations + totalTime) / (prev.totalNavigations + 1),
                lastNavigationTime: totalTime
            }));
            
            // Clear active navigation
            if (activeNavigationRef.current === navigationContext) {
                activeNavigationRef.current = null;
            }
        };

        const onError = (message) => {
            const navigationContext = activeNavigationRef.current;
            if (!navigationContext || navigationContext.cancelled) return;
            
            error('❌ Directory streaming error:', message);
            setError(message);
            setLoading(false);
            hideLoadingIndicator();
            
            if (activeNavigationRef.current === navigationContext) {
                activeNavigationRef.current = null;
            }
        };

        EventsOn('DirectoryStart', onStart);
        EventsOn('DirectoryEntry', onEntry);
        EventsOn('DirectoryComplete', onComplete);
        EventsOn('DirectoryError', onError);

        return () => {
            EventsOff('DirectoryStart');
            EventsOff('DirectoryEntry');
            EventsOff('DirectoryComplete');
            EventsOff('DirectoryError');
        };
    }, [setError, setNavigationStats, hideLoadingIndicator]);

    // Create a compatible directoryContents object for existing components
    const directoryContents = files.length > 0 ? {
        currentPath,
        parentPath: currentPath ? (() => {
            const parts = currentPath.split(currentPath.includes('\\') ? '\\' : '/').filter(p => p);
            if (parts.length <= 1) return '';
            return parts.slice(0, -1).join(currentPath.includes('\\') ? '\\' : '/') + (currentPath.includes('\\') ? '\\' : '');
        })() : '',
        files: files.filter(f => !f.isDir),
        directories: files.filter(f => f.isDir),
        totalFiles: files.filter(f => !f.isDir).length,
        totalDirs: files.filter(f => f.isDir).length
    } : null;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (loadingTimeout.current) {
                clearTimeout(loadingTimeout.current);
            }
            if (activeNavigationRef.current) {
                activeNavigationRef.current.cancelled = true;
            }
        };
    }, []);

    return {
        currentPath,
        directoryContents,
        showLoadingIndicator,
        navigateToPath,
        handleNavigateUp,
        handleRefresh
    };
} 