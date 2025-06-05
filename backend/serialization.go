package backend

import (
	"encoding/base64"
	"encoding/json"
	"log"

	"github.com/vmihailenco/msgpack/v5"
)

// MessagePack-only serialization mode - NO JSON OR PURE MSGPACK SUPPORT
type SerializationMode int

const (
	SerializationMsgPackBase64 SerializationMode = 2 // Only MessagePack Base64 mode supported
)

// SerializationUtils provides MessagePack Base64 serialization only
type SerializationUtils struct {
	// No mode field needed since we only support MessagePack Base64
}

// NewSerializationUtils creates a new SerializationUtils instance (MessagePack Base64 only)
func NewSerializationUtils() *SerializationUtils {
	return &SerializationUtils{}
}

// SerializeNavigationResponse serializes NavigationResponse using MessagePack Base64 only
func (s *SerializationUtils) SerializeNavigationResponse(data NavigationResponse) (interface{}, error) {
	// FORCE MessagePack Base64 - no other modes supported
	return s.encodeMsgPackBase64(data)
}

// SerializeFileInfo serializes FileInfo using MessagePack Base64 only
func (s *SerializationUtils) SerializeFileInfo(data FileInfo) (interface{}, error) {
	// FORCE MessagePack Base64 - no other modes supported
	return s.encodeMsgPackBase64(data)
}

// SerializeDriveInfoSlice serializes []DriveInfo using MessagePack Base64 only
func (s *SerializationUtils) SerializeDriveInfoSlice(data []DriveInfo) (interface{}, error) {
	// FORCE MessagePack Base64 - no other modes supported
	return s.encodeMsgPackBase64(data)
}

// encodeMsgPackBase64 encodes data to MessagePack and then to base64 string
func (s *SerializationUtils) encodeMsgPackBase64(data interface{}) (string, error) {
	msgPackData, err := msgpack.Marshal(data)
	if err != nil {
		return "", err
	}
	return base64.StdEncoding.EncodeToString(msgPackData), nil
}

// DecodeMsgPackBase64 decodes base64 MessagePack data into target struct
func DecodeMsgPackBase64(encodedData string, target interface{}) error {
	msgPackData, err := base64.StdEncoding.DecodeString(encodedData)
	if err != nil {
		return err
	}
	return msgpack.Unmarshal(msgPackData, target)
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
		// Base64 encoded MessagePack size
		base64Size := base64.StdEncoding.EncodedLen(len(msgPackData))
		results["msgpack_base64"] = base64Size
	}

	return results
}

// LogSerializationComparison logs the size comparison for debugging
func LogSerializationComparison(data interface{}, label string) {
	sizes := BenchmarkSerializationSizes(data)
	log.Printf("🔍 MessagePack serialization stats for %s:", label)
	for format, size := range sizes {
		if format == "msgpack_base64" {
			log.Printf("   %s: %d bytes (ACTIVE)", format, size)
		} else {
			log.Printf("   %s: %d bytes (comparison only)", format, size)
		}
	}

	if jsonSize, exists := sizes["json"]; exists {
		if msgPackSize, exists := sizes["msgpack"]; exists {
			reduction := float64(jsonSize-msgPackSize) / float64(jsonSize) * 100
			log.Printf("   MessagePack is %.1f%% smaller than JSON", reduction)
		}
	}
}

// Global serialization utility instance - MessagePack Base64 only
var globalSerializationUtils = NewSerializationUtils()

// GetSerializationUtils returns the global serialization utils instance
func GetSerializationUtils() *SerializationUtils {
	return globalSerializationUtils
}

// SetSerializationMode is deprecated - only MessagePack Base64 supported
func SetSerializationMode(mode SerializationMode) {
	// Only log - mode switching is no longer supported
	log.Printf("🔄 MessagePack Base64 mode enforced (mode switching disabled)")
}
