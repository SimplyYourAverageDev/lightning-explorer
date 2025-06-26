package backend

import (
	"strings"
	"sync"
	"time"
)

// FileInfoPool manages a pool of FileInfo objects to reduce allocations
type FileInfoPool struct {
	pool sync.Pool
}

// NewFileInfoPool creates a new FileInfo object pool
func NewFileInfoPool() *FileInfoPool {
	return &FileInfoPool{
		pool: sync.Pool{
			New: func() interface{} {
				return &FileInfo{}
			},
		},
	}
}

// Get retrieves a FileInfo from the pool
func (p *FileInfoPool) Get() *FileInfo {
	return p.pool.Get().(*FileInfo)
}

// Put returns a FileInfo to the pool after resetting it
func (p *FileInfoPool) Put(fi *FileInfo) {
	// Reset the FileInfo to avoid data leaks
	fi.Name = ""
	fi.Path = ""
	fi.IsDir = false
	fi.Size = 0
	fi.ModTime = time.Time{}
	fi.Permissions = ""
	fi.Extension = ""
	fi.IsHidden = false

	p.pool.Put(fi)
}

// StringBuilderPool manages a pool of string builders for path construction
type StringBuilderPool struct {
	pool sync.Pool
}

// NewStringBuilderPool creates a new string builder pool
func NewStringBuilderPool() *StringBuilderPool {
	return &StringBuilderPool{
		pool: sync.Pool{
			New: func() interface{} {
				sb := &strings.Builder{}
				sb.Grow(260) // Pre-allocate for typical Windows path length
				return sb
			},
		},
	}
}

// Get retrieves a string builder from the pool
func (p *StringBuilderPool) Get() *strings.Builder {
	return p.pool.Get().(*strings.Builder)
}

// Put returns a string builder to the pool after resetting it
func (p *StringBuilderPool) Put(sb *strings.Builder) {
	sb.Reset()
	p.pool.Put(sb)
}

// Global pools for application-wide use
var (
	globalFileInfoPool      = NewFileInfoPool()
	globalStringBuilderPool = NewStringBuilderPool()
)

// GetFileInfoFromPool gets a FileInfo from the global pool
func GetFileInfoFromPool() *FileInfo {
	return globalFileInfoPool.Get()
}

// PutFileInfoToPool returns a FileInfo to the global pool
func PutFileInfoToPool(fi *FileInfo) {
	globalFileInfoPool.Put(fi)
}

// GetStringBuilderFromPool gets a string builder from the global pool
func GetStringBuilderFromPool() *strings.Builder {
	return globalStringBuilderPool.Get()
}

// PutStringBuilderToPool returns a string builder to the global pool
func PutStringBuilderToPool(sb *strings.Builder) {
	globalStringBuilderPool.Put(sb)
}
