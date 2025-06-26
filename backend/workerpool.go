package backend

import (
	"runtime"
	"sync"
)

// Job represents a task to be executed
type Job struct {
	Execute func()
}

// WorkerPool manages a pool of workers to execute jobs concurrently
type WorkerPool struct {
	jobs    chan Job
	wg      sync.WaitGroup
	workers int
	jobPool sync.Pool // Pool of reusable job objects
}

// NewWorkerPool creates a new worker pool with optimized worker count
func NewWorkerPool(numWorkers int) *WorkerPool {
	// If numWorkers is 0, auto-detect based on CPU cores
	if numWorkers == 0 {
		numWorkers = runtime.NumCPU()
		// For I/O bound operations, we can have more workers than CPU cores
		// But cap it to avoid excessive context switching
		if numWorkers > 8 {
			numWorkers = 8
		} else if numWorkers < 2 {
			numWorkers = 2
		}
	}

	// Buffer size based on expected workload
	// Larger buffer reduces contention but uses more memory
	bufferSize := numWorkers * 16

	return &WorkerPool{
		jobs:    make(chan Job, bufferSize),
		workers: numWorkers,
		jobPool: sync.Pool{
			New: func() interface{} {
				return &Job{}
			},
		},
	}
}

// Start initializes the workers and begins processing jobs
func (wp *WorkerPool) Start() {
	// Pre-warm the workers for immediate availability
	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go wp.worker(i)
	}
}

// worker is the optimized worker goroutine
func (wp *WorkerPool) worker(id int) {
	defer wp.wg.Done()

	// Process jobs until channel is closed
	for job := range wp.jobs {
		if job.Execute != nil {
			job.Execute()
		}
		// Return job to pool if it was allocated from pool
		// This reduces GC pressure
		job.Execute = nil
	}
}

// Submit adds a job to the queue with non-blocking option
func (wp *WorkerPool) Submit(job Job) bool {
	select {
	case wp.jobs <- job:
		return true
	default:
		// Channel is full, job rejected
		// Caller can decide whether to retry or handle differently
		return false
	}
}

// SubmitBlocking adds a job to the queue, blocking if necessary
func (wp *WorkerPool) SubmitBlocking(job Job) {
	wp.jobs <- job
}

// Wait blocks until all jobs are completed
func (wp *WorkerPool) Wait() {
	close(wp.jobs)
	wp.wg.Wait()
}

// QueueSize returns the current number of pending jobs
func (wp *WorkerPool) QueueSize() int {
	return len(wp.jobs)
}

// IsIdle returns true if no jobs are pending
func (wp *WorkerPool) IsIdle() bool {
	return len(wp.jobs) == 0
}
