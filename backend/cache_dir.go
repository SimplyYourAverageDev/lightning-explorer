package backend

import (
	"container/list"
	"sync"
	"time"
)

// dirCacheEntry represents a cached directory listing along with the directory
// modification timestamp. Kept small and copy-friendly.
type dirCacheEntry struct {
	files   []FileInfo
	modTime int64 // seconds since epoch
	at      int64 // access time (unix seconds) for TTL
}

// lruDirCache is a bounded LRU cache with TTL semantics for directory listings.
// - capacity: maximum number of distinct directories to retain
// - ttl: entries older than this (since last access) are considered expired
type lruDirCache struct {
	mu    sync.Mutex
	cap   int
	ttl   time.Duration
	ll    *list.List               // holds *lruItem with key
	items map[string]*list.Element // key -> element
}

type lruItem struct {
	key   string
	value dirCacheEntry
}

func newLRUDirCache(capacity int, ttl time.Duration) *lruDirCache {
	if capacity <= 0 {
		capacity = 128
	}
	if ttl <= 0 {
		ttl = 60 * time.Second
	}
	return &lruDirCache{
		cap:   capacity,
		ttl:   ttl,
		ll:    list.New(),
		items: make(map[string]*list.Element, capacity),
	}
}

// Get returns the cached entry if present, not expired, and modTime matches.
// ok is false if not found/expired/modTime mismatch.
func (c *lruDirCache) Get(key string, modTime int64) (entry dirCacheEntry, ok bool) {
	now := time.Now().Unix()
	c.mu.Lock()
	defer c.mu.Unlock()
	if ele, exists := c.items[key]; exists {
		it := ele.Value.(*lruItem)
		// TTL check
		if now-it.value.at > int64(c.ttl/time.Second) {
			c.removeElement(ele)
			return dirCacheEntry{}, false
		}
		// modtime must match to be valid
		if it.value.modTime != modTime {
			c.removeElement(ele)
			return dirCacheEntry{}, false
		}
		// refresh access, move to front
		it.value.at = now
		c.ll.MoveToFront(ele)
		return it.value, true
	}
	return dirCacheEntry{}, false
}

// Put inserts/updates an entry. Caller provides files and modTime.
func (c *lruDirCache) Put(key string, files []FileInfo, modTime int64) {
	now := time.Now().Unix()
	c.mu.Lock()
	defer c.mu.Unlock()
	if ele, exists := c.items[key]; exists {
		it := ele.Value.(*lruItem)
		it.value = dirCacheEntry{files: files, modTime: modTime, at: now}
		c.ll.MoveToFront(ele)
		return
	}
	it := &lruItem{key: key, value: dirCacheEntry{files: files, modTime: modTime, at: now}}
	ele := c.ll.PushFront(it)
	c.items[key] = ele
	if c.ll.Len() > c.cap {
		c.removeOldest()
	}
}

func (c *lruDirCache) removeOldest() {
	ele := c.ll.Back()
	if ele != nil {
		c.removeElement(ele)
	}
}

func (c *lruDirCache) removeElement(e *list.Element) {
	c.ll.Remove(e)
	it := e.Value.(*lruItem)
	delete(c.items, it.key)
}

// PurgeExpired removes entries past TTL. Optional periodic housekeeping.
func (c *lruDirCache) PurgeExpired() {
	now := time.Now().Unix()
	c.mu.Lock()
	for key, ele := range c.items {
		it := ele.Value.(*lruItem)
		if now-it.value.at > int64(c.ttl/time.Second) {
			c.ll.Remove(ele)
			delete(c.items, key)
		}
	}
	c.mu.Unlock()
}
