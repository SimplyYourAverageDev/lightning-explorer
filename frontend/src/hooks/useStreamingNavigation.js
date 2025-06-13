import { useState, useCallback, useRef, useEffect } from "preact/hooks";
import { log, error } from "../utils/logger";

export function useStreamingNavigation(setError, setNavigationStats) {
    const [currentPath, setCurrentPath] = useState('');
    const [files, setFiles] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showLoadingIndicator, setShowLoadingIndicator] = useState(false);
    
    // --- Internal refs ------------------------------------------------------
    // Performance tracking
    const navigationStartTime = useRef(null);
    const loadingTimeout = useRef(null);
    const activeNavigationRef = useRef(null);

    // Batching to minimise re-renders when many DirectoryBatch events arrive
    const pendingFilesRef = useRef([]);
    const flushTimerRef  = useRef(null);

    // Track if event listeners are registered
    const listenersRegistered = useRef(false);
    const listenersRegistering = useRef(false);
    const eventUnsubscribers = useRef([]);

    // No longer needed - using native batching from backend

    // Disable loading indicator to prevent flash during navigation
    const showSmartLoadingIndicator = useCallback(() => {
        // No-op: don't show loading indicator to prevent flash
    }, []);

    const hideLoadingIndicator = useCallback(() => {
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
            loadingTimeout.current = null;
        }
        setShowLoadingIndicator(false);
    }, []);

    // ---------------------------------------------------------------------
    // Helpers for frame-batched state updates

    // Flush accumulated files to state (runs in RAF)
    const flushPendingFiles = useCallback(() => {
        if (pendingFilesRef.current.length > 0) {
            // Use functional update to append so we don't lose concurrent state
            setFiles(prev => [...prev, ...pendingFilesRef.current]);
            pendingFilesRef.current = [];
        }
        flushTimerRef.current = null;
    }, []);

    const scheduleFlush = useCallback(() => {
        if (flushTimerRef.current == null) {
            // requestAnimationFrame gives us one flush per frame (~16ms) which is
            // more than enough and aligns with browser paint timing. Fallback to
            // setTimeout when RAF is not available (e.g., in certain test envs).
            const raf = (typeof window !== 'undefined' && window.requestAnimationFrame) || ((fn) => setTimeout(fn, 16));
            flushTimerRef.current = raf(flushPendingFiles);
        }
    }, [flushPendingFiles]);

    // ---------------------------------------------------------------------
    // Event handlers - defined outside useEffect to avoid recreation
    const onStart = useCallback((path) => {
        console.log('📡 Frontend received DirectoryStart:', path);
        const navigationContext = activeNavigationRef.current;
        if (!navigationContext || navigationContext.cancelled) {
            console.log('⚠️ DirectoryStart received but no active navigation context');
            return;
        }
        
        log(`📡 Directory streaming started: ${path}`);
        // Reset buffered files & timers from any previous navigation
        pendingFilesRef.current = [];
        if (flushTimerRef.current != null) {
            if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
                window.cancelAnimationFrame(flushTimerRef.current);
            } else {
                clearTimeout(flushTimerRef.current);
            }
            flushTimerRef.current = null;
        }

        setFiles([]);
        setCurrentPath(path);
    }, []);

    const onBatch = useCallback((batchFiles) => {
        console.log('📡 Frontend received DirectoryBatch:', batchFiles?.length, 'files');
        const navigationContext = activeNavigationRef.current;
        if (!navigationContext || navigationContext.cancelled) {
            console.log('⚠️ DirectoryBatch received but no active navigation context');
            return;
        }

        log(`📡 Received batch of ${batchFiles.length} files`);

        // Add to pending buffer and schedule a flush
        pendingFilesRef.current.push(...batchFiles);
        scheduleFlush();
    }, [scheduleFlush]);

    const onComplete = useCallback((data) => {
        console.log('📡 Frontend received DirectoryComplete:', data);
        const navigationContext = activeNavigationRef.current;
        if (!navigationContext || navigationContext.cancelled) return;
        
        // Ensure last pending files are committed before finishing
        flushPendingFiles();

        const totalTime = Date.now() - navigationStartTime.current;
        const totalEntries = (data.totalFiles || 0) + (data.totalDirs || 0);
        
        log(`✅ Directory streaming completed: ${data.path} (${totalEntries} entries in ${totalTime}ms)`);
        
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
    }, [hideLoadingIndicator, setNavigationStats, flushPendingFiles]);

    const onError = useCallback((message) => {
        console.log('📡 Frontend received DirectoryError:', message);
        const navigationContext = activeNavigationRef.current;
        if (!navigationContext || navigationContext.cancelled) return;
        
        error('❌ Directory streaming error:', message);
        setError(message);
        setLoading(false);
        hideLoadingIndicator();
        
        if (activeNavigationRef.current === navigationContext) {
            activeNavigationRef.current = null;
        }
    }, [setError, hideLoadingIndicator]);

    // Register event listeners immediately when hook loads
    const registerEventListeners = useCallback(async () => {
        if (listenersRegistered.current || listenersRegistering.current) {
            console.log('🔧 Event listeners already registered or registering, skipping...');
            return;
        }

        listenersRegistering.current = true; // prevent concurrent registrations
        
        try {
            console.log('🔧 useStreamingNavigation: Registering event listeners...');
            
            const { EventsOn } = await import('../../wailsjs/runtime/runtime');
            const unsubDirectoryStart = EventsOn('DirectoryStart', onStart);
            const unsubDirectoryBatch = EventsOn('DirectoryBatch', onBatch);
            const unsubDirectoryComplete = EventsOn('DirectoryComplete', onComplete);
            const unsubDirectoryError = EventsOn('DirectoryError', onError);
            
            // Store unsubscribers
            eventUnsubscribers.current = [
                unsubDirectoryStart,
                unsubDirectoryBatch, 
                unsubDirectoryComplete,
                unsubDirectoryError
            ];
            
            listenersRegistered.current = true;
            listenersRegistering.current = false;
            console.log('🔧 useStreamingNavigation: Event listeners registered successfully!');
        } catch (err) {
            console.error('❌ Failed to register event listeners:', err);
            error('Failed to register event listeners:', err);
            listenersRegistering.current = false;
        }
    }, [onStart, onBatch, onComplete, onError]);

    // Cleanup event listeners
    const cleanupEventListeners = useCallback(() => {
        if (!listenersRegistered.current) return;

        try {
            console.log('🔧 useStreamingNavigation: Cleaning up event listeners...');

            import('../../wailsjs/runtime/runtime').then(({ EventsOff }) => {
                // Call unsubscribe functions if available
                eventUnsubscribers.current.forEach(unsub => {
                    if (typeof unsub === 'function') {
                        unsub();
                    }
                });

                // Fallback cleanup
                EventsOff('DirectoryStart');
                EventsOff('DirectoryBatch');
                EventsOff('DirectoryComplete');
                EventsOff('DirectoryError');
            });
            
            eventUnsubscribers.current = [];
            listenersRegistered.current = false;
            console.log('🔧 useStreamingNavigation: Event listeners cleaned up successfully!');
        } catch (err) {
            console.error('❌ Failed to cleanup event listeners:', err);
        }
    }, []);

    // Register event listeners on hook initialization
    useEffect(() => {
        registerEventListeners();
        return cleanupEventListeners;
    }, [registerEventListeners, cleanupEventListeners]);

    // Streaming navigation function
    const navigateToPath = useCallback(async (path, source = 'user') => {
        log(`🧭 Streaming navigation request: ${path} (${source})`);
        
        // Ensure event listeners are registered before navigation
        if (!listenersRegistered.current) {
            console.log('🔧 Event listeners not registered, registering now...');
            await registerEventListeners();
        }
        
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
        // Don't show loading indicator to prevent flash
        
        // Dynamically import the backend streaming function when required
        const { StreamDirectory } = await import('../../wailsjs/go/backend/App');

        // Set measuring state
        setNavigationStats(prev => ({
            ...prev,
            lastNavigationTime: 0
        }));

        try {
            // Small delay to ensure event listeners are ready
            await new Promise(resolve => setTimeout(resolve, 10));
            
            // Check if navigation was cancelled during delay
            if (navigationContext.cancelled) {
                console.log('🚫 Navigation cancelled during setup');
                return;
            }
            
            console.log(`🧭 Starting StreamDirectory for: ${path} (listeners registered: ${listenersRegistered.current})`);
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
    }, [setError, setNavigationStats, hideLoadingIndicator, registerEventListeners]);

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

            if (flushTimerRef.current != null) {
                if (typeof window !== 'undefined' && window.cancelAnimationFrame) {
                    window.cancelAnimationFrame(flushTimerRef.current);
                } else {
                    clearTimeout(flushTimerRef.current);
                }
            }
        };
    }, []);

    return {
        currentPath,
        directoryContents,
        showLoadingIndicator,
        loading,
        navigateToPath,
        handleNavigateUp,
        handleRefresh
    };
} 