// WeakMap to store function references for better memory management
const functionReferences = new WeakMap();

// Optimized debounce utility with cancel support
export function debounce(func, wait, immediate = false) {
    let timeout;
    let lastCallTime = 0;
    
    const debounced = function executedFunction(...args) {
        const now = Date.now();
        const timeSinceLastCall = now - lastCallTime;
        
        const later = () => {
            timeout = null;
            if (!immediate) {
                lastCallTime = Date.now();
                func.apply(this, args);
            }
        };
        
        const callNow = immediate && !timeout;
        
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) {
            lastCallTime = now;
            func.apply(this, args);
        }
    };
    
    // Add cancel method
    debounced.cancel = () => {
        clearTimeout(timeout);
        timeout = null;
    };
    
    return debounced;
}

// Optimized throttle with trailing call support
export function throttle(func, limit, options = {}) {
    const { trailing = true, leading = true } = options;
    let inThrottle = false;
    let lastArgs = null;
    let lastThis = null;
    
    const throttled = function(...args) {
        lastArgs = args;
        lastThis = this;
        
        if (!inThrottle) {
            if (leading) {
                func.apply(this, args);
            }
            
            inThrottle = true;
            
            setTimeout(() => {
                inThrottle = false;
                if (trailing && lastArgs) {
                    func.apply(lastThis, lastArgs);
                    lastArgs = null;
                    lastThis = null;
                }
            }, limit);
        }
    };
    
    throttled.cancel = () => {
        inThrottle = false;
        lastArgs = null;
        lastThis = null;
    };
    
    return throttled;
}

// Optimized RAF-based throttle with cancel support
export function rafThrottle(func) {
    let rafId = null;
    let lastArgs = null;
    let lastThis = null;
    
    const rafThrottled = function(...args) {
        lastArgs = args;
        lastThis = this;
        
        if (rafId === null) {
            rafId = requestAnimationFrame(() => {
                func.apply(lastThis, lastArgs);
                rafId = null;
                lastArgs = null;
                lastThis = null;
            });
        }
    };
    
    rafThrottled.cancel = () => {
        if (rafId !== null) {
            cancelAnimationFrame(rafId);
            rafId = null;
            lastArgs = null;
            lastThis = null;
        }
    };
    
    return rafThrottled;
}

// RequestIdleCallback wrapper with fallback
export function idleCallback(func, options = {}) {
    if (typeof requestIdleCallback !== 'undefined') {
        return requestIdleCallback(func, options);
    } else {
        // Fallback with better timing
        const timeout = options.timeout || 50;
        return setTimeout(func, timeout);
    }
}

// Optimized batch DOM operations using microtasks
export function batchReads(readFunctions) {
    return new Promise(resolve => {
        // Use microtask for faster execution
        queueMicrotask(() => {
            requestAnimationFrame(() => {
                const results = readFunctions.map(fn => fn());
                resolve(results);
            });
        });
    });
}

export function batchWrites(writeFunctions) {
    // Use microtask for faster scheduling
    queueMicrotask(() => {
        requestAnimationFrame(() => {
            writeFunctions.forEach(fn => fn());
        });
    });
}

// Specialized debounce for navigation operations (optimized)
export const debouncedNavigate = debounce((navigateFunc, path) => {
    navigateFunc(path);
}, 25); // Even faster for snappier navigation

// Specialized RAF throttle for scroll events (optimized)
export const rafThrottledScroll = rafThrottle((scrollFunc, event) => {
    scrollFunc(event);
});

// Legacy throttle for scroll events (optimized with options)
export const throttledScroll = throttle((scrollFunc, event) => {
    scrollFunc(event);
}, 16, { trailing: false }); // ~60fps, no trailing call for smoother scrolling

// Specialized debounce for file operations (optimized)
export const debouncedFileOperation = debounce((operationFunc, ...args) => {
    operationFunc(...args);
}, 50); // Faster for better responsiveness 