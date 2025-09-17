package backend

import (
	"container/list"
	"sync"
	"time"
)

type dirCacheEntry struct {
	files      []FileInfo
	modTime    int64
	at         int64
	entryBytes int64
}

type lruDirCache struct {
	mu               sync.Mutex
	cap              int
	ttl              time.Duration
	ll               *list.List
	items            map[string]*list.Element
	maxEntriesPerDir int
	maxBytes         int64
	approxEntrySize  int64
	currentBytes     int64
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
		cap:              capacity,
		ttl:              ttl,
		ll:               list.New(),
		items:            make(map[string]*list.Element, capacity),
		maxEntriesPerDir: 8000,
		maxBytes:         64 << 20, // ~64MiB total cache budget by default
		approxEntrySize:  160,      // rough estimate per entry (bytes)
	}
}

func (c *lruDirCache) shouldCache(lenEntries int) bool {
	if c == nil {
		return false
	}
	if c.maxEntriesPerDir > 0 && lenEntries > c.maxEntriesPerDir {
		return false
	}
	return true
}

func (c *lruDirCache) entryCost(files []FileInfo) int64 {
	if c == nil {
		return 0
	}
	if len(files) == 0 {
		return 0
	}
	size := int64(len(files)) * c.approxEntrySize
	if size == 0 {
		size = int64(len(files)) * 64
	}
	return size
}

func (c *lruDirCache) Get(key string, modTime int64) (entry dirCacheEntry, ok bool) {
	if c == nil {
		return dirCacheEntry{}, false
	}
	now := time.Now().Unix()
	c.mu.Lock()
	defer c.mu.Unlock()
	if ele, exists := c.items[key]; exists {
		it := ele.Value.(*lruItem)
		if c.ttl > 0 && now-it.value.at > int64(c.ttl/time.Second) {
			c.removeElement(ele)
			return dirCacheEntry{}, false
		}
		if it.value.modTime != modTime {
			c.removeElement(ele)
			return dirCacheEntry{}, false
		}
		it.value.at = now
		c.ll.MoveToFront(ele)
		return it.value, true
	}
	return dirCacheEntry{}, false
}

func (c *lruDirCache) Put(key string, files []FileInfo, modTime int64) {
	if c == nil {
		return
	}
	if !c.shouldCache(len(files)) {
		return
	}
	now := time.Now().Unix()
	entryBytes := c.entryCost(files)
	if c.maxBytes > 0 && entryBytes > c.maxBytes {
		return
	}

	c.mu.Lock()
	defer c.mu.Unlock()

	if entryBytes > 0 && c.maxBytes > 0 {
		for c.currentBytes+entryBytes > c.maxBytes && c.ll.Len() > 0 {
			c.removeOldest()
		}
		if entryBytes > c.maxBytes {
			return
		}
	}

	if ele, exists := c.items[key]; exists {
		it := ele.Value.(*lruItem)
		c.currentBytes -= it.value.entryBytes
		it.value = dirCacheEntry{files: files, modTime: modTime, at: now, entryBytes: entryBytes}
		c.currentBytes += entryBytes
		c.ll.MoveToFront(ele)
		return
	}

	it := &lruItem{key: key, value: dirCacheEntry{files: files, modTime: modTime, at: now, entryBytes: entryBytes}}
	ele := c.ll.PushFront(it)
	c.items[key] = ele
	c.currentBytes += entryBytes
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
	it := e.Value.(*lruItem)
	c.ll.Remove(e)
	delete(c.items, it.key)
	c.currentBytes -= it.value.entryBytes
	if c.currentBytes < 0 {
		c.currentBytes = 0
	}
}

func (c *lruDirCache) PurgeExpired() {
	if c == nil {
		return
	}
	now := time.Now().Unix()
	c.mu.Lock()
	for key, ele := range c.items {
		it := ele.Value.(*lruItem)
		if c.ttl > 0 && now-it.value.at > int64(c.ttl/time.Second) {
			c.ll.Remove(ele)
			delete(c.items, key)
			c.currentBytes -= it.value.entryBytes
		}
	}
	if c.currentBytes < 0 {
		c.currentBytes = 0
	}
	c.mu.Unlock()
}

func (c *lruDirCache) maxEntriesLimit() int {
	if c == nil {
		return 0
	}
	return c.maxEntriesPerDir
}
