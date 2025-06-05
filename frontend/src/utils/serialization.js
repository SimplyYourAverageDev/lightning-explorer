import { decode, encode } from '@msgpack/msgpack';

// MessagePack-only serialization mode - Direct binary mode (no Base64)
export const SerializationMode = {
    MSGPACK_BINARY: 3  // Only MessagePack binary mode - removed Base64 encoding
};

/**
 * MessagePack-only utility class - Direct binary mode (no Base64)
 */
export class SerializationUtils {
    constructor() {
        // Always use MessagePack binary mode - no mode switching
        this.mode = SerializationMode.MSGPACK_BINARY;
    }

    /**
     * Deserialize MessagePack binary data only
     * @param {*} data - The data to deserialize (MessagePack binary Uint8Array or ArrayBuffer)
     * @returns {Object} - The deserialized object
     */
    deserialize(data) {
        try {
            // Handle different binary data types from Wails
            if (data instanceof ArrayBuffer) {
                return decode(new Uint8Array(data));
            } else if (data instanceof Uint8Array) {
                return decode(data);
            } else if (typeof data === 'string') {
                // Wails v2 automatically converts Go []byte to Base64 strings
                // This is expected behavior for Wails v2, not a performance issue
                const binaryData = this.base64ToUint8Array(data);
                return decode(binaryData);
            }
            
            // If it's already decoded, return as-is
            return data;
        } catch (error) {
            console.error('❌ MessagePack binary deserialization failed:', error);
            throw new Error('MessagePack binary deserialization failed: ' + error.message);
        }
    }

    /**
     * Serialize data to MessagePack binary only
     * @param {Object} data - The data to serialize
     * @returns {Uint8Array} - The MessagePack binary serialized data
     */
    serialize(data) {
        try {
            return encode(data);
        } catch (error) {
            console.error('❌ MessagePack binary serialization failed:', error);
            throw new Error('MessagePack binary serialization failed: ' + error.message);
        }
    }

    /**
     * Legacy Base64 conversion methods (for fallback compatibility only)
     */
    base64ToUint8Array(base64String) {
        const binaryString = atob(base64String);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    uint8ArrayToBase64(uint8Array) {
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        return btoa(binaryString);
    }

    /**
     * Get the current serialization mode (always MessagePack binary)
     * @returns {number} - Always returns MessagePack binary mode
     */
    getMode() {
        return SerializationMode.MSGPACK_BINARY;
    }

    /**
     * Set mode - does nothing since we only support MessagePack binary
     * @param {number} mode - Ignored, always uses MessagePack binary
     */
    setMode(mode) {
        // Always use MessagePack binary - ignore any other mode
        console.log('🔄 MessagePack binary mode enforced (mode switching disabled)');
    }
}

// Global instance - always MessagePack binary
const serializationUtils = new SerializationUtils();

/**
 * MessagePack-only Enhanced API wrapper
 */
export class EnhancedAPI {
    constructor(wailsAPI, serializationUtils) {
        this.api = wailsAPI;
        this.serialization = serializationUtils;
    }

    /**
     * Navigate to a path with MessagePack binary serialization
     * @param {string} path - The path to navigate to
     * @returns {Promise<Object>} - Navigation response
     */
    async navigateToPath(path) {
        const result = await this.api.NavigateToPathOptimized(path);
        return this.serialization.deserialize(result);
    }

    /**
     * List directory contents with MessagePack binary serialization
     * @param {string} path - The directory path
     * @returns {Promise<Object>} - Directory contents
     */
    async listDirectory(path) {
        const result = await this.api.ListDirectoryOptimized(path);
        return this.serialization.deserialize(result);
    }

    /**
     * Get file details with MessagePack binary serialization
     * @param {string} filePath - The file path
     * @returns {Promise<Object>} - File information
     */
    async getFileDetails(filePath) {
        const result = await this.api.GetFileDetailsOptimized(filePath);
        return this.serialization.deserialize(result);
    }

    /**
     * Get drive information with MessagePack binary serialization
     * @returns {Promise<Array>} - Drive information array
     */
    async getDriveInfo() {
        const result = await this.api.GetDriveInfoOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Get home directory with MessagePack binary serialization
     * @returns {Promise<Object>} - Home directory response
     */
    async getHomeDirectory() {
        const result = await this.api.GetHomeDirectoryOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Create directory with MessagePack binary serialization
     * @param {string} path - The parent directory path
     * @param {string} name - The new directory name
     * @returns {Promise<Object>} - Navigation response
     */
    async createDirectory(path, name) {
        const result = await this.api.CreateDirectoryOptimized(path, name);
        return this.serialization.deserialize(result);
    }

    /**
     * Delete path with MessagePack binary serialization
     * @param {string} path - The path to delete
     * @returns {Promise<Object>} - Navigation response
     */
    async deletePath(path) {
        const result = await this.api.DeletePathOptimized(path);
        return this.serialization.deserialize(result);
    }

    /**
     * Get quick access paths with MessagePack binary serialization
     * @returns {Promise<Array>} - Quick access paths array
     */
    async getQuickAccessPaths() {
        const result = await this.api.GetQuickAccessPathsOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Get system roots with MessagePack binary serialization
     * @returns {Promise<Object>} - System roots response
     */
    async getSystemRoots() {
        const result = await this.api.GetSystemRootsOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Set the serialization mode (always forces MessagePack binary)
     * @param {number} mode - Ignored, always uses MessagePack binary
     * @returns {Promise<boolean>} - Always returns true
     */
    async setSerializationMode(mode) {
        // MessagePack binary mode is enforced by default on backend
        return true;
    }

    /**
     * Get the current serialization mode (always MessagePack binary)
     * @returns {Promise<number>} - Always returns MessagePack binary mode
     */
    async getSerializationMode() {
        return SerializationMode.MSGPACK_BINARY;
    }
}

export { serializationUtils }; 