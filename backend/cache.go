package backend

import (
	"log"
	"time"
)

// NewCacheManager creates a new cache manager instance with optimized settings
func NewCacheManager() *CacheManager {
	cm := &CacheManager{
		dirCache:   make(map[string]*CacheEntry),
		lastAccess: make(map[string]time.Time),
	}

	// Start background cleanup routine
	go cm.backgroundCleanup()

	return cm
}

// Get retrieves a cache entry if it exists and is still valid
func (c *CacheManager) Get(path string) (*CacheEntry, bool) {
	c.cacheMutex.RLock()
	defer c.cacheMutex.RUnlock()

	entry, exists := c.dirCache[path]
	if !exists {
		return nil, false
	}

	// Extended cache validity for better performance
	// Use 30 seconds for recently accessed paths, 5 seconds for others
	maxAge := 5 * time.Second
	if lastAccess, hasAccess := c.lastAccess[path]; hasAccess {
		if time.Since(lastAccess) < 2*time.Minute {
			maxAge = 30 * time.Second // Recently accessed paths get longer cache
		}
	}

	cacheAge := time.Since(entry.Timestamp)
	if cacheAge > maxAge {
		return nil, false
	}

	// Update access time for LRU
	c.lastAccess[path] = time.Now()

	log.Printf("⚡ Backend cache HIT for: %s (age: %v, max: %v)", path, cacheAge, maxAge)
	return entry, true
}

// Set stores a cache entry with intelligent size management
func (c *CacheManager) Set(path string, entry *CacheEntry) {
	c.cacheMutex.Lock()
	defer c.cacheMutex.Unlock()

	c.dirCache[path] = entry
	c.lastAccess[path] = time.Now()

	// Increased cache size for better hit rates
	maxEntries := 200
	if len(c.dirCache) > maxEntries {
		c.cleanOldEntriesLocked(maxEntries / 2) // Clean half when full
	}

	log.Printf("💾 Backend cached: %s (%d/%d entries)", path, len(c.dirCache), maxEntries)
}

// Clear removes all cache entries
func (c *CacheManager) Clear() {
	c.cacheMutex.Lock()
	defer c.cacheMutex.Unlock()

	c.dirCache = make(map[string]*CacheEntry)
	c.lastAccess = make(map[string]time.Time)
	log.Printf("🧹 Backend cache cleared")
}

// CleanOldEntries removes stale cache entries to prevent memory bloat
func (c *CacheManager) CleanOldEntries() {
	c.cacheMutex.Lock()
	defer c.cacheMutex.Unlock()

	c.cleanOldEntriesLocked(0)
}

// cleanOldEntriesLocked is the internal implementation that requires a write lock
func (c *CacheManager) cleanOldEntriesLocked(targetSize int) {
	if targetSize <= 0 {
		// Normal cleanup - remove entries older than 1 minute
		maxAge := 1 * time.Minute
		now := time.Now()
		removedCount := 0

		for path, entry := range c.dirCache {
			if now.Sub(entry.Timestamp) > maxAge {
				delete(c.dirCache, path)
				delete(c.lastAccess, path)
				removedCount++
			}
		}

		if removedCount > 0 {
			log.Printf("🧹 Cleaned %d old cache entries, %d remaining", removedCount, len(c.dirCache))
		}
	} else {
		// Aggressive cleanup to reach target size - remove least recently accessed
		if len(c.dirCache) <= targetSize {
			return
		}

		type accessEntry struct {
			path       string
			accessTime time.Time
		}

		// Sort by access time
		var accessList []accessEntry
		for path, accessTime := range c.lastAccess {
			accessList = append(accessList, accessEntry{path, accessTime})
		}

		// Sort by access time (oldest first)
		for i := 0; i < len(accessList)-1; i++ {
			for j := i + 1; j < len(accessList); j++ {
				if accessList[i].accessTime.After(accessList[j].accessTime) {
					accessList[i], accessList[j] = accessList[j], accessList[i]
				}
			}
		}

		// Remove oldest entries
		toRemove := len(c.dirCache) - targetSize
		removedCount := 0
		for i := 0; i < toRemove && i < len(accessList); i++ {
			path := accessList[i].path
			delete(c.dirCache, path)
			delete(c.lastAccess, path)
			removedCount++
		}

		log.Printf("🧹 Aggressive cleanup: removed %d entries, %d remaining", removedCount, len(c.dirCache))
	}
}

// backgroundCleanup runs periodic cache maintenance
func (c *CacheManager) backgroundCleanup() {
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		c.CleanOldEntries()
	}
}

// GetCacheStats returns cache statistics for debugging/monitoring
func (c *CacheManager) GetCacheStats() map[string]interface{} {
	c.cacheMutex.RLock()
	defer c.cacheMutex.RUnlock()

	stats := make(map[string]interface{})
	stats["total_entries"] = len(c.dirCache)
	stats["memory_usage_estimate"] = len(c.dirCache) * 1024 // Rough estimate

	// Calculate age distribution
	now := time.Now()
	ageDistribution := map[string]int{
		"under_5s":  0,
		"5s_to_30s": 0,
		"over_30s":  0,
	}

	accessDistribution := map[string]int{
		"recent":   0, // Accessed in last 2 minutes
		"moderate": 0, // Accessed 2-10 minutes ago
		"old":      0, // Accessed over 10 minutes ago
	}

	for path, entry := range c.dirCache {
		age := now.Sub(entry.Timestamp)
		switch {
		case age < 5*time.Second:
			ageDistribution["under_5s"]++
		case age < 30*time.Second:
			ageDistribution["5s_to_30s"]++
		default:
			ageDistribution["over_30s"]++
		}

		// Check access time
		if accessTime, exists := c.lastAccess[path]; exists {
			accessAge := now.Sub(accessTime)
			switch {
			case accessAge < 2*time.Minute:
				accessDistribution["recent"]++
			case accessAge < 10*time.Minute:
				accessDistribution["moderate"]++
			default:
				accessDistribution["old"]++
			}
		}
	}

	stats["age_distribution"] = ageDistribution
	stats["access_distribution"] = accessDistribution
	stats["hit_rate_estimate"] = "See frontend logs for real-time hit rates"

	return stats
}
