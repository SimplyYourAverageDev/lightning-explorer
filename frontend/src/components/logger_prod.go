//go:build prod

package backend

// Production build - all logging is disabled
func logPrintln(v ...interface{}) {
	// No-op in production
}

func logPrintf(format string, v ...interface{}) {
	// No-op in production
}
