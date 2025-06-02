// Frontend cache for ultra-fast navigation
export class NavigationCache {
    constructor(maxSize = 100, ttl = 10000) { // 10 second TTL, 100 entries max
        this.cache = new Map();
        this.accessOrder = new Map();
        this.maxSize = maxSize;
        this.ttl = ttl;
        this.hitCount = 0;
        this.missCount = 0;
    }

    get(path) {
        const entry = this.cache.get(path);
        if (!entry) {
            this.missCount++;
            return null;
        }

        // Check TTL
        if (Date.now() - entry.timestamp > this.ttl) {
            this.cache.delete(path);
            this.accessOrder.delete(path);
            this.missCount++;
            return null;
        }

        // Update access order for LRU
        this.accessOrder.set(path, Date.now());
        this.hitCount++;
        console.log(`⚡ Frontend cache HIT for: ${path} (${this.hitCount}/${this.hitCount + this.missCount} hit rate: ${(this.hitCount / (this.hitCount + this.missCount) * 100).toFixed(1)}%)`);
        return entry.data;
    }

    set(path, data) {
        // Remove oldest entries if cache is full
        if (this.cache.size >= this.maxSize) {
            const oldestPath = [...this.accessOrder.entries()]
                .sort(([,a], [,b]) => a - b)[0][0];
            this.cache.delete(oldestPath);
            this.accessOrder.delete(oldestPath);
        }

        this.cache.set(path, {
            data,
            timestamp: Date.now()
        });
        this.accessOrder.set(path, Date.now());
        console.log(`💾 Frontend cached: ${path} (${this.cache.size}/${this.maxSize} entries)`);
    }

    clear() {
        this.cache.clear();
        this.accessOrder.clear();
        console.log('🧹 Frontend cache cleared');
    }

    getStats() {
        return {
            entries: this.cache.size,
            hitRate: this.hitCount / (this.hitCount + this.missCount) * 100,
            hits: this.hitCount,
            misses: this.missCount
        };
    }
}

// Smart prefetching for likely navigation targets
export class NavigationPrefetcher {
    constructor() {
        this.prefetchQueue = new Set();
        this.isRunning = false;
    }

    async prefetch(paths) {
        if (this.isRunning) return;
        
        for (const path of paths) {
            if (this.cache && this.cache.get(path)) continue; // Already cached
            
            this.prefetchQueue.add(path);
        }

        if (this.prefetchQueue.size > 0) {
            this.processPrefetchQueue();
        }
    }

    async processPrefetchQueue() {
        if (this.isRunning || this.prefetchQueue.size === 0) return;
        
        this.isRunning = true;
        const path = [...this.prefetchQueue][0];
        this.prefetchQueue.delete(path);

        try {
            console.log(`🔮 Prefetching: ${path}`);
            const { NavigateToPath } = await import("../../wailsjs/go/backend/App");
            const response = await NavigateToPath(path);
            if (response && response.success && this.cache) {
                this.cache.set(path, response.data);
            }
        } catch (err) {
            console.log(`❌ Prefetch failed for ${path}:`, err);
        }

        this.isRunning = false;
        
        // Process next item with a small delay
        if (this.prefetchQueue.size > 0) {
            setTimeout(() => this.processPrefetchQueue(), 100);
        }
    }

    setCache(cache) {
        this.cache = cache;
    }
}

// Create singleton instances
export const navCache = new NavigationCache();
export const prefetcher = new NavigationPrefetcher();
prefetcher.setCache(navCache); 