//go:build prod

package backend

// Production build - logging no-ops to keep output clean
func logPrintln(v ...interface{})               {}
func logPrintf(format string, v ...interface{}) {}
