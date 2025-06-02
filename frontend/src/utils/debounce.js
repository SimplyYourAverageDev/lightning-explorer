// Debounce utility to prevent excessive function calls
export function debounce(func, wait, immediate = false) {
    let timeout;
    
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        
        const callNow = immediate && !timeout;
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(this, args);
    };
}

// Enhanced throttle utility for high-frequency events
export function throttle(func, limit) {
    let inThrottle;
    
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// RAF-based throttle for smooth animations and scroll handling
export function rafThrottle(func) {
    let rafId = null;
    let lastArgs = null;
    
    return function(...args) {
        lastArgs = args;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(this, lastArgs);
                rafId = null;
            });
        }
    };
}

// RequestIdleCallback wrapper with fallback
export function idleCallback(func, options = {}) {
    if (typeof requestIdleCallback !== 'undefined') {
        return requestIdleCallback(func, options);
    } else {
        // Fallback for browsers without requestIdleCallback
        return setTimeout(func, 1);
    }
}

// Batch DOM reads to avoid layout thrashing
export function batchReads(readFunctions) {
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            const results = readFunctions.map(fn => fn());
            resolve(results);
        });
    });
}

// Batch DOM writes to optimize rendering
export function batchWrites(writeFunctions) {
    requestAnimationFrame(() => {
        writeFunctions.forEach(fn => fn());
    });
}

// Specialized debounce for navigation operations (super fast)
export const debouncedNavigate = debounce((navigateFunc, path) => {
    navigateFunc(path);
}, 50); // Much faster for responsive navigation

// Specialized RAF throttle for scroll events (smoother than timer-based)
export const rafThrottledScroll = rafThrottle((scrollFunc, event) => {
    scrollFunc(event);
});

// Legacy throttle for scroll events (keeping for compatibility)
export const throttledScroll = throttle((scrollFunc, event) => {
    scrollFunc(event);
}, 16); // ~60fps

// Specialized debounce for file operations
export const debouncedFileOperation = debounce((operationFunc, ...args) => {
    operationFunc(...args);
}, 75); // Slightly faster for better responsiveness 