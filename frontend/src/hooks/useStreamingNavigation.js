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
    
    // Track if event listeners are registered
    const listenersRegistered = useRef(false);
    const eventUnsubscribers = useRef([]);

    // No longer needed - using native batching from backend

    // Smart loading indicator management
    const showSmartLoadingIndicator = useCallback(() => {
        // Show loading indicator immediately for navigation, no delay
        setShowLoadingIndicator(true);
    }, []);

    const hideLoadingIndicator = useCallback(() => {
        if (loadingTimeout.current) {
            clearTimeout(loadingTimeout.current);
            loadingTimeout.current = null;
        }
        setShowLoadingIndicator(false);
    }, []);

    // Event handlers - defined outside useEffect to avoid recreation
    const onStart = useCallback((path) => {
        console.log('📡 Frontend received DirectoryStart:', path);
        const navigationContext = activeNavigationRef.current;
        if (!navigationContext || navigationContext.cancelled) {
            console.log('⚠️ DirectoryStart received but no active navigation context');
            return;
        }
        
        log(`📡 Directory streaming started: ${path}`);
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
        
        // Add batch directly to files state for better performance
        setFiles(prev => [...prev, ...batchFiles]);
    }, []);

    const onComplete = useCallback((data) => {
        console.log('📡 Frontend received DirectoryComplete:', data);
        const navigationContext = activeNavigationRef.current;
        if (!navigationContext || navigationContext.cancelled) return;
        
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
    }, [hideLoadingIndicator, setNavigationStats]);

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
    const registerEventListeners = useCallback(() => {
        if (listenersRegistered.current) {
            console.log('🔧 Event listeners already registered, skipping...');
            return;
        }

        try {
            console.log('🔧 useStreamingNavigation: Registering event listeners...');
            
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
            console.log('🔧 useStreamingNavigation: Event listeners registered successfully!');
        } catch (err) {
            console.error('❌ Failed to register event listeners:', err);
            error('Failed to register event listeners:', err);
        }
    }, [onStart, onBatch, onComplete, onError]);

    // Cleanup event listeners
    const cleanupEventListeners = useCallback(() => {
        if (!listenersRegistered.current) return;

        try {
            console.log('🔧 useStreamingNavigation: Cleaning up event listeners...');
            
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
    }, []); // Empty dependency array - register once on mount

    // Streaming navigation function
    const navigateToPath = useCallback(async (path, source = 'user') => {
        log(`🧭 Streaming navigation request: ${path} (${source})`);
        
        // Ensure event listeners are registered before navigation
        if (!listenersRegistered.current) {
            console.log('🔧 Event listeners not registered, registering now...');
            registerEventListeners();
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
        showSmartLoadingIndicator();
        
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
    }, [setError, setNavigationStats, showSmartLoadingIndicator, hideLoadingIndicator, registerEventListeners]);

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