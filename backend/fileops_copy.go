package backend

import (
	"io"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"sync/atomic"
)

const (
	copyBufferSize       = 256 * 1024
	copyWorkerMultiplier = 2
)

var bufferPool = sync.Pool{New: func() interface{} {
	return make([]byte, copyBufferSize)
}}

func (fo *FileOperationsManager) copyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	buffer := bufferPool.Get().([]byte)
	defer bufferPool.Put(buffer)

	if _, err = io.CopyBuffer(destFile, sourceFile, buffer); err != nil {
		return err
	}

	if srcInfo, err := os.Stat(src); err == nil {
		os.Chmod(dst, srcInfo.Mode())
		os.Chtimes(dst, srcInfo.ModTime(), srcInfo.ModTime())
	}

	return nil
}

func (fo *FileOperationsManager) copyDir(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dst, srcInfo.Mode()); err != nil {
		return err
	}

	entries, err := os.ReadDir(src)
	if err != nil {
		return err
	}

	maxWorkers := runtime.NumCPU() * copyWorkerMultiplier
	if maxWorkers < 2 {
		maxWorkers = 2
	}
	sem := make(chan struct{}, maxWorkers)
	var wg sync.WaitGroup
	var once sync.Once
	var firstErr error
	var failed atomic.Bool

	launch := func(fn func()) {
		wg.Add(1)
		go func() {
			defer wg.Done()
			defer func() { <-sem }()
			fn()
		}()
	}

	for _, entry := range entries {
		if failed.Load() {
			break
		}

		srcPath := filepath.Join(src, entry.Name())
		dstPath := filepath.Join(dst, entry.Name())

		if entry.IsDir() {
			if err := fo.copyDir(srcPath, dstPath); err != nil {
				once.Do(func() { firstErr = err; failed.Store(true) })
				break
			}
			continue
		}

		sem <- struct{}{}
		launch(func() {
			if err := fo.copyFile(srcPath, dstPath); err != nil {
				once.Do(func() { firstErr = err; failed.Store(true) })
			}
		})
	}

	wg.Wait()

	if firstErr != nil {
		return firstErr
	}

	return nil
}

func (fo *FileOperationsManager) copyAndDelete(src, dst string) error {
	srcInfo, err := os.Stat(src)
	if err != nil {
		return err
	}

	if srcInfo.IsDir() {
		return fo.copyDirAndDelete(src, dst)
	}

	return fo.copyFileAndDelete(src, dst)
}

func (fo *FileOperationsManager) copyFileAndDelete(src, dst string) error {
	if err := fo.copyFile(src, dst); err != nil {
		return err
	}

	return os.Remove(src)
}

func (fo *FileOperationsManager) copyDirAndDelete(src, dst string) error {
	if err := fo.copyDir(src, dst); err != nil {
		return err
	}

	return os.RemoveAll(src)
}
