import { decode, encode } from '@msgpack/msgpack';

// MessagePack-only serialization mode - NO JSON SUPPORT
export const SerializationMode = {
    MSGPACK_BASE64: 2  // Only MessagePack Base64 mode - removed JSON and pure MessagePack
};

/**
 * MessagePack-only utility class - NO JSON SUPPORT
 */
export class SerializationUtils {
    constructor() {
        // Always use MessagePack Base64 mode - no mode switching
        this.mode = SerializationMode.MSGPACK_BASE64;
    }

    /**
     * Deserialize MessagePack data only
     * @param {*} data - The data to deserialize (MessagePack Base64 string)
     * @returns {Object} - The deserialized object
     */
    deserialize(data) {
        try {
            if (typeof data === 'string') {
                // Decode base64 to binary, then decode MessagePack
                const binaryData = this.base64ToUint8Array(data);
                return decode(binaryData);
            }
            // If it's already decoded, return as-is
            return data;
        } catch (error) {
            console.error('❌ MessagePack deserialization failed:', error);
            throw new Error('MessagePack deserialization failed: ' + error.message);
        }
    }

    /**
     * Serialize data to MessagePack Base64 only
     * @param {Object} data - The data to serialize
     * @returns {string} - The MessagePack Base64 serialized data
     */
    serialize(data) {
        try {
            const binaryData = encode(data);
            return this.uint8ArrayToBase64(binaryData);
        } catch (error) {
            console.error('❌ MessagePack serialization failed:', error);
            throw new Error('MessagePack serialization failed: ' + error.message);
        }
    }

    /**
     * Convert base64 string to Uint8Array
     * @param {string} base64 - Base64 encoded string
     * @returns {Uint8Array} - Binary data
     */
    base64ToUint8Array(base64) {
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }

    /**
     * Convert Uint8Array to base64 string
     * @param {Uint8Array} bytes - Binary data
     * @returns {string} - Base64 encoded string
     */
    uint8ArrayToBase64(bytes) {
        let binaryString = '';
        for (let i = 0; i < bytes.length; i++) {
            binaryString += String.fromCharCode(bytes[i]);
        }
        return btoa(binaryString);
    }

    /**
     * Get the current serialization mode (always MessagePack Base64)
     * @returns {number} - Always returns MessagePack Base64 mode
     */
    getMode() {
        return SerializationMode.MSGPACK_BASE64;
    }

    /**
     * Set mode - does nothing since we only support MessagePack Base64
     * @param {number} mode - Ignored, always uses MessagePack Base64
     */
    setMode(mode) {
        // Always use MessagePack Base64 - ignore any other mode
        console.log('🔄 MessagePack Base64 mode enforced (mode switching disabled)');
    }
}

// Global instance - always MessagePack Base64
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
     * Navigate to a path with MessagePack serialization
     * @param {string} path - The path to navigate to
     * @returns {Promise<Object>} - Navigation response
     */
    async navigateToPath(path) {
        const result = await this.api.NavigateToPathOptimized(path);
        return this.serialization.deserialize(result);
    }

    /**
     * List directory contents with MessagePack serialization
     * @param {string} path - The directory path
     * @returns {Promise<Object>} - Directory contents
     */
    async listDirectory(path) {
        const result = await this.api.ListDirectoryOptimized(path);
        return this.serialization.deserialize(result);
    }

    /**
     * Get file details with MessagePack serialization
     * @param {string} filePath - The file path
     * @returns {Promise<Object>} - File information
     */
    async getFileDetails(filePath) {
        const result = await this.api.GetFileDetailsOptimized(filePath);
        return this.serialization.deserialize(result);
    }

    /**
     * Get drive information with MessagePack serialization
     * @returns {Promise<Array>} - Drive information array
     */
    async getDriveInfo() {
        const result = await this.api.GetDriveInfoOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Get home directory with MessagePack serialization
     * @returns {Promise<Object>} - Home directory response
     */
    async getHomeDirectory() {
        const result = await this.api.GetHomeDirectoryOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Create directory with MessagePack serialization
     * @param {string} path - The parent directory path
     * @param {string} name - The new directory name
     * @returns {Promise<Object>} - Navigation response
     */
    async createDirectory(path, name) {
        const result = await this.api.CreateDirectoryOptimized(path, name);
        return this.serialization.deserialize(result);
    }

    /**
     * Delete path with MessagePack serialization
     * @param {string} path - The path to delete
     * @returns {Promise<Object>} - Navigation response
     */
    async deletePath(path) {
        const result = await this.api.DeletePathOptimized(path);
        return this.serialization.deserialize(result);
    }

    /**
     * Get quick access paths with MessagePack serialization
     * @returns {Promise<Array>} - Quick access paths array
     */
    async getQuickAccessPaths() {
        const result = await this.api.GetQuickAccessPathsOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Get system roots with MessagePack serialization
     * @returns {Promise<Object>} - System roots response
     */
    async getSystemRoots() {
        const result = await this.api.GetSystemRootsOptimized();
        return this.serialization.deserialize(result);
    }

    /**
     * Set the serialization mode (always forces MessagePack Base64)
     * @param {number} mode - Ignored, always uses MessagePack Base64
     * @returns {Promise<boolean>} - Always returns true
     */
    async setSerializationMode(mode) {
        // Force MessagePack Base64 mode on backend
        return await this.api.SetSerializationMode(SerializationMode.MSGPACK_BASE64);
    }

    /**
     * Get the current serialization mode (always MessagePack Base64)
     * @returns {Promise<number>} - Always returns MessagePack Base64 mode
     */
    async getSerializationMode() {
        return SerializationMode.MSGPACK_BASE64;
    }
}

// Export utilities
export { serializationUtils };
export default SerializationUtils; 