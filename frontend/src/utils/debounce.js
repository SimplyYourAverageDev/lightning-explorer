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

// Throttle utility for high-frequency events like scrolling
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

// Specialized debounce for navigation operations (super fast)
export const debouncedNavigate = debounce((navigateFunc, path) => {
    navigateFunc(path);
}, 50); // Much faster for responsive navigation

// Specialized throttle for scroll events  
export const throttledScroll = throttle((scrollFunc, event) => {
    scrollFunc(event);
}, 16); // ~60fps

// Specialized debounce for file operations
export const debouncedFileOperation = debounce((operationFunc, ...args) => {
    operationFunc(...args);
}, 75); // Slightly faster for better responsiveness 