package backend

import (
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
}

// NewWorkerPool creates a new worker pool with a specified number of workers
func NewWorkerPool(numWorkers int) *WorkerPool {
	return &WorkerPool{
		jobs:    make(chan Job),
		workers: numWorkers,
	}
}

// Start initializes the workers and begins processing jobs
func (wp *WorkerPool) Start() {
	for i := 0; i < wp.workers; i++ {
		wp.wg.Add(1)
		go func() {
			defer wp.wg.Done()
			for job := range wp.jobs {
				job.Execute()
			}
		}()
	}
}

// Submit adds a job to the queue
func (wp *WorkerPool) Submit(job Job) {
	wp.jobs <- job
}

// Wait blocks until all jobs are completed
func (wp *WorkerPool) Wait() {
	close(wp.jobs)
	wp.wg.Wait()
}
