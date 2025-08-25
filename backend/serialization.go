package backend

import (
	"encoding/json"

	"github.com/vmihailenco/msgpack/v5"
)

// MessagePack-only serialization mode - Direct binary mode (no Base64)
type SerializationMode int

const (
	SerializationMsgPackBinary SerializationMode = 3 // Direct MessagePack binary mode
)

// SerializationUtils provides MessagePack binary serialization only
type SerializationUtils struct {
	// No mode field needed since we only support MessagePack binary
}

// NewSerializationUtils creates a new SerializationUtils instance (MessagePack binary only)
func NewSerializationUtils() *SerializationUtils {
	return &SerializationUtils{}
}

// SerializeNavigationResponse serializes NavigationResponse using MessagePack binary only
func (s *SerializationUtils) SerializeNavigationResponse(data NavigationResponse) (interface{}, error) {
	// FORCE MessagePack binary - no Base64 encoding
	return s.encodeMsgPackBinary(data)
}

// SerializeFileInfo serializes FileInfo using MessagePack binary only
func (s *SerializationUtils) SerializeFileInfo(data FileInfo) (interface{}, error) {
	// FORCE MessagePack binary - no Base64 encoding
	return s.encodeMsgPackBinary(data)
}

// SerializeDriveInfoSlice serializes []DriveInfo using MessagePack binary only
func (s *SerializationUtils) SerializeDriveInfoSlice(data []DriveInfo) (interface{}, error) {
	// FORCE MessagePack binary - no Base64 encoding
	return s.encodeMsgPackBinary(data)
}

// SerializeGeneric serializes any data structure using MessagePack binary
func (s *SerializationUtils) SerializeGeneric(data interface{}) (interface{}, error) {
	// FORCE MessagePack binary - no Base64 encoding
	return s.encodeMsgPackBinary(data)
}

// encodeMsgPackBinary encodes data to MessagePack binary directly
func (s *SerializationUtils) encodeMsgPackBinary(data interface{}) ([]byte, error) {
	return msgpack.Marshal(data)
}

// DecodeMsgPackBinary decodes binary MessagePack data into target struct
func DecodeMsgPackBinary(binaryData []byte, target interface{}) error {
	return msgpack.Unmarshal(binaryData, target)
}

// BenchmarkSerializationSizes compares MessagePack with JSON (for comparison purposes only)
func BenchmarkSerializationSizes(data interface{}) map[string]int {
	results := make(map[string]int)

	// JSON size (for comparison only - not used for actual serialization)
	if jsonData, err := json.Marshal(data); err == nil {
		results["json"] = len(jsonData)
	}

	// MessagePack size (our only serialization method)
	if msgPackData, err := msgpack.Marshal(data); err == nil {
		results["msgpack"] = len(msgPackData)
		results["msgpack_binary"] = len(msgPackData)
	}

	return results
}

// LogSerializationComparison logs the size comparison for debugging
func LogSerializationComparison(data interface{}, label string) {
	sizes := BenchmarkSerializationSizes(data)
	logPrintf("🔍 MessagePack binary serialization stats for %s:", label)
	for format, size := range sizes {
		if format == "msgpack_binary" {
			logPrintf("   %s: %d bytes (ACTIVE - direct binary)", format, size)
		} else {
			logPrintf("   %s: %d bytes (comparison only)", format, size)
		}
	}

	if jsonSize, exists := sizes["json"]; exists {
		if msgPackSize, exists := sizes["msgpack"]; exists {
			reduction := float64(jsonSize-msgPackSize) / float64(jsonSize) * 100
			logPrintf("   MessagePack is %.1f%% smaller than JSON", reduction)
		}
	}
}

// Global serialization utility instance - MessagePack binary only
var globalSerializationUtils = NewSerializationUtils()

// GetSerializationUtils returns the global serialization utils instance
func GetSerializationUtils() *SerializationUtils {
	return globalSerializationUtils
}

// SetSerializationMode is deprecated - only MessagePack binary supported
func SetSerializationMode(mode SerializationMode) {
	// Only log - mode switching is no longer supported
	logPrintf("🔄 MessagePack binary mode enforced (mode switching disabled)")
}
