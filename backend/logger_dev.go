//go:build !prod

package backend

import "log"

// Development build - logging is enabled
func logPrintln(v ...interface{}) {
	log.Println(v...)
}

func logPrintf(format string, v ...interface{}) {
	log.Printf(format, v...)
}
