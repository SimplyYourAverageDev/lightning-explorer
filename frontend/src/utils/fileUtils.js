// Optimized file utilities with caching and performance optimizations

// Cache for file type and icon lookups to avoid repeated computations
const iconCache = new Map();
const typeCache = new Map();
const extensionCache = new Map();

// Clear caches periodically to prevent memory leaks
let cacheCleanupInterval;
const startCacheCleanup = () => {
    if (!cacheCleanupInterval) {
        cacheCleanupInterval = setInterval(() => {
            if (iconCache.size > 1000) iconCache.clear();
            if (typeCache.size > 1000) typeCache.clear();
            if (extensionCache.size > 1000) extensionCache.clear();
        }, 300000); // Clean every 5 minutes
    }
};

// Start cache cleanup
startCacheCleanup();

/**
 * Optimized file filtering with precomputed hidden status
 * @param {Array} files - Array of file objects
 * @param {boolean} showHidden - Whether to show hidden files
 * @returns {Array} - Filtered array
 */
export function filterFiles(files, showHidden) {
    if (!files || !Array.isArray(files)) return [];
    
    // If showing all files, return as-is (backend already filtered system files)
    if (showHidden) return files;
    
    // Filter out hidden files efficiently
    return files.filter(file => !file.isHidden);
}

/**
 * Batch filter files with optimized performance for large lists
 * @param {Array} directories - Directory entries
 * @param {Array} files - File entries
 * @param {boolean} showHidden - Whether to show hidden files
 * @returns {Object} - Object with filtered directories and files
 */
export function batchFilterFiles(directories, files, showHidden) {
    return {
        directories: filterFiles(directories, showHidden),
        files: filterFiles(files, showHidden)
    };
}

/**
 * Cached file type detection
 */
export function getFileType(filename, isDir) {
    if (isDir) return 'folder';
    
    const cacheKey = filename.toLowerCase();
    if (typeCache.has(cacheKey)) {
        return typeCache.get(cacheKey);
    }
    
    const ext = getExtension(filename);
    let type = 'file';
    
    // Fast type detection based on extension
    if (imageExtensions.has(ext)) type = 'image';
    else if (videoExtensions.has(ext)) type = 'video';
    else if (audioExtensions.has(ext)) type = 'audio';
    else if (documentExtensions.has(ext)) type = 'document';
    else if (codeExtensions.has(ext)) type = 'code';
    else if (archiveExtensions.has(ext)) type = 'archive';
    
    typeCache.set(cacheKey, type);
    return type;
}

/**
 * Cached file icon detection with performance optimization
 */
export function getFileIcon(filename, isDir) {
    if (isDir) return '📁';
    
    const cacheKey = filename.toLowerCase();
    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey);
    }
    
    const ext = getExtension(filename);
    let icon = '📄'; // Default file icon
    
    // Fast icon lookup using Sets for O(1) performance
    if (imageExtensions.has(ext)) icon = '🖼️';
    else if (videoExtensions.has(ext)) icon = '🎬';
    else if (audioExtensions.has(ext)) icon = '🎵';
    else if (documentExtensions.has(ext)) icon = '📝';
    else if (codeExtensions.has(ext)) icon = '💻';
    else if (archiveExtensions.has(ext)) icon = '📦';
    else if (executableExtensions.has(ext)) icon = '⚙️';
    
    iconCache.set(cacheKey, icon);
    return icon;
}

/**
 * Optimized extension extraction with caching
 */
export function getExtension(filename) {
    if (!filename) return '';
    
    if (extensionCache.has(filename)) {
        return extensionCache.get(filename);
    }
    
    const lastDot = filename.lastIndexOf('.');
    const ext = lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : '';
    
    extensionCache.set(filename, ext);
    return ext;
}

// Pre-computed Sets for O(1) lookup performance (much faster than arrays)
const imageExtensions = new Set([
    'jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif'
]);

const videoExtensions = new Set([
    'mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v', '3gp'
]);

const audioExtensions = new Set([
    'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'
]);

const documentExtensions = new Set([
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'rtf', 'odt'
]);

const codeExtensions = new Set([
    'js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'cs', 'php', 'rb', 'go', 'rs', 'swift'
]);

const archiveExtensions = new Set([
    'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'
]);

const executableExtensions = new Set([
    'exe', 'msi', 'deb', 'rpm', 'dmg', 'app'
]);

// Export sets for external use if needed
export { 
    imageExtensions, 
    videoExtensions, 
    audioExtensions, 
    documentExtensions, 
    codeExtensions, 
    archiveExtensions, 
    executableExtensions 
}; 