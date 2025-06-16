// Optimized file utilities with caching and performance optimizations
// Updated to work with Phosphor Icons

// Import the icon mappings
import { 
    SPECIFIC_FILE_MAP, 
    EXTENSION_TYPE_MAP, 
    TYPE_ICON_MAP, 
    SPECIAL_FOLDER_MAP,
    DEFAULT_FILE_ICON,
    DEFAULT_FOLDER_ICON,
    getIconComponent,
    getSpecialFolderIcon
} from './fileTypeMaps.js';

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

// Initialize cleanup when module loads
startCacheCleanup();

// Performance-optimized extension sets using the same patterns as before
const imageExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'tif']);
const videoExtensions = new Set(['mp4', 'm4v', 'avi', 'mkv', 'mov', 'wmv', 'flv', 'webm', '3gp', 'mpg', 'mpeg']);
const audioExtensions = new Set(['mp3', 'm4a', 'aac', 'wav', 'flac', 'ogg', 'wma', 'aiff', 'midi', 'mid']);
const documentExtensions = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf', 'txt', 'md', 'markdown']);
const codeExtensions = new Set(['js', 'jsx', 'ts', 'tsx', 'html', 'css', 'scss', 'sass', 'php', 'py', 'java', 'c', 'cpp', 'cs', 'go', 'rs', 'rb', 'pl', 'lua', 'r', 'jl']);
const archiveExtensions = new Set(['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab']);
const executableExtensions = new Set(['exe', 'msi', 'deb', 'rpm', 'dmg', 'pkg']);

/**
 * Optimized extension extraction with caching
 */
function getExtension(filename) {
    if (extensionCache.has(filename)) {
        return extensionCache.get(filename);
    }
    
    const lastDot = filename.lastIndexOf('.');
    const ext = lastDot === -1 ? '' : filename.slice(lastDot + 1).toLowerCase();
    
    extensionCache.set(filename, ext);
    return ext;
}

/**
 * Enhanced file type detection with comprehensive mappings
 */
export function getFileType(filename, isDir) {
    if (isDir) return 'folder';
    
    const cacheKey = filename.toLowerCase();
    if (typeCache.has(cacheKey)) {
        return typeCache.get(cacheKey);
    }
    
    // Check specific file mappings first (highest priority)
    const lowerFilename = filename.toLowerCase();
    if (SPECIFIC_FILE_MAP[lowerFilename]) {
        const type = SPECIFIC_FILE_MAP[lowerFilename];
        typeCache.set(cacheKey, type);
        return type;
    }
    
    // Check extension mappings
    const ext = getExtension(filename);
    const type = EXTENSION_TYPE_MAP[ext] || 'file';
    
    typeCache.set(cacheKey, type);
    return type;
}

/**
 * Get icon component for file/folder
 * Returns the actual Phosphor Icon component
 */
export function getFileIcon(filename, isDir) {
    if (isDir) {
        // Check for special folder icons
        const specialIcon = getSpecialFolderIcon(filename);
        return specialIcon;
    }
    
    const cacheKey = filename.toLowerCase();
    if (iconCache.has(cacheKey)) {
        return iconCache.get(cacheKey);
    }
    
    const fileType = getFileType(filename, isDir);
    const iconComponent = getIconComponent(fileType, isDir);
    
    iconCache.set(cacheKey, iconComponent);
    return iconComponent;
}

/**
 * Get icon type class for CSS styling
 * This provides backwards compatibility for the CSS classes
 */
export function getFileIconType(filename, isDir) {
    if (isDir) return 'folder';
    
    const ext = getExtension(filename);
    
    // Fast type detection using Sets for O(1) performance
    if (imageExtensions.has(ext)) return 'image';
    if (videoExtensions.has(ext)) return 'video';
    if (audioExtensions.has(ext)) return 'audio';
    if (documentExtensions.has(ext)) return 'document';
    if (codeExtensions.has(ext)) return 'code';
    if (archiveExtensions.has(ext)) return 'archive';
    if (executableExtensions.has(ext)) return 'executable';
    
    return 'file';
}

/**
 * Filter files based on visibility settings with performance optimization
 */
export function filterFiles(files, showHidden = false) {
    if (!files || files.length === 0) return [];
    
    if (showHidden) {
        return files; // No filtering needed
    }
    
    // Use filter for hidden file detection
    return files.filter(file => {
        // Skip files/folders that start with '.'
        if (file.name.startsWith('.')) return false;
        
        // Skip system files on Windows
        if (file.isSystem || file.isHidden) return false;
        
        return true;
    });
}

/**
 * Check if a file is considered "hidden"
 */
export function isHiddenFile(filename) {
    return filename.startsWith('.') || filename.toLowerCase() === 'desktop.ini' || filename.toLowerCase() === 'thumbs.db';
}

/**
 * Get file category for grouping
 */
export function getFileCategory(filename, isDir) {
    if (isDir) return 'folder';
    
    const ext = getExtension(filename);
    
    if (imageExtensions.has(ext)) return 'image';
    if (videoExtensions.has(ext)) return 'video';
    if (audioExtensions.has(ext)) return 'audio';
    if (documentExtensions.has(ext)) return 'document';
    if (codeExtensions.has(ext)) return 'code';
    if (archiveExtensions.has(ext)) return 'archive';
    
    return 'other';
}

/**
 * Check if file extension indicates a specific type
 */
export const isImageFile = (filename) => imageExtensions.has(getExtension(filename));
export const isVideoFile = (filename) => videoExtensions.has(getExtension(filename));
export const isAudioFile = (filename) => audioExtensions.has(getExtension(filename));
export const isDocumentFile = (filename) => documentExtensions.has(getExtension(filename));
export const isCodeFile = (filename) => codeExtensions.has(getExtension(filename));
export const isArchiveFile = (filename) => archiveExtensions.has(getExtension(filename));

/**
 * Get human-readable file type description
 */
export function getFileTypeDescription(filename, isDir) {
    if (isDir) return 'Folder';
    
    const type = getFileType(filename, isDir);
    const ext = getExtension(filename).toUpperCase();
    
    const typeDescriptions = {
        'javascript': 'JavaScript File',
        'typescript': 'TypeScript File',
        'react': 'React Component',
        'html': 'HTML Document',
        'css': 'CSS Stylesheet',
        'python': 'Python Script',
        'java': 'Java Source File',
        'image': `${ext} Image`,
        'video': `${ext} Video`,
        'audio': `${ext} Audio`,
        'pdf': 'PDF Document',
        'word': 'Word Document',
        'excel': 'Excel Spreadsheet',
        'archive': `${ext} Archive`,
        'executable': 'Executable File'
    };
    
    return typeDescriptions[type] || `${ext} File` || 'File';
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
 * Split filename into name and extension status
 * @param {string} filename - The filename to split
 * @returns {Object} - Object with name and hasExtension properties
 */
export function splitFilename(filename) {
    const lastDot = filename.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) {
        return { name: filename, hasExtension: false };
    }
    
    return {
        name: filename.substring(0, lastDot),
        hasExtension: true
    };
}

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