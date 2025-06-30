// Prefetch utility to warm backend directory cache on hover
// NOTE: Hover-triggered prefetches should be fire-and-forget, we only rely on the
//       backend to cache the directory contents so that subsequent navigations
//       stream almost instantly.

// Keep a reference to the last path we prefetched so we do not spam the backend
let lastPrefetchPath = null;
let delayTimer = null;

// Fire the actual backend call (dynamic import keeps initial bundle small)
async function prefetchDirectory(path) {
    lastPrefetchPath = path;
    try {
        const { ListDirectory } = await import("../../wailsjs/go/backend/App");
        // We don't need the result on the UI side – the backend caches it.
        await ListDirectory(path);
    } catch (_) {
        // Silently ignore errors – prefetching is best-effort only
    }
}

/**
 * Schedule a prefetch for the given directory after a short debounce.
 * If the caller schedules another path before the timer fires, the previous
 * request is cancelled so only the most recent hover triggers a backend call.
 *
 * @param {string} path Absolute directory path to prefetch.
 * @param {number} [delay=120] Debounce delay in milliseconds.
 */
export function schedulePrefetch(path, delay = 120) {
    if (!path || path === lastPrefetchPath) return;

    if (delayTimer) clearTimeout(delayTimer);

    delayTimer = setTimeout(() => {
        delayTimer = null;
        prefetchDirectory(path);
    }, delay);
} 