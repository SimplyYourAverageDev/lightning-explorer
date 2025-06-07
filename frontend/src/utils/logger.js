// Production-optimized logger utility with zero overhead in production
// In production this is ALWAYS false so all log(...) calls drop out
const debug = false;

// In production, these become no-op functions that get optimized away by bundlers
export const log = debug ? (...args) => console.log(...args) : () => {};
export const warn = debug ? (...args) => console.warn(...args) : () => {};
export const error = debug ? (...args) => console.error(...args) : () => {};
export const time = debug ? (label) => console.time(label) : () => {};
export const timeEnd = debug ? (label) => console.timeEnd(label) : () => {};
export const group = debug ? (label) => console.group(label) : () => {};
export const groupEnd = debug ? () => console.groupEnd() : () => {};

// Performance-critical operations should use these instead of the above
// These have additional checks to prevent any runtime overhead in hot paths
export const logHotPath = debug && typeof console !== 'undefined' ? (...args) => console.log(...args) : () => {};
export const logBatch = debug && typeof console !== 'undefined' ? (...args) => console.log(...args) : () => {};
export const logHydration = debug && typeof console !== 'undefined' ? (...args) => console.log(...args) : () => {};

// Export debug flag for conditional logic
export { debug }; 