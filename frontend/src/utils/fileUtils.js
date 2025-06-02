// Optimized file type detection using pre-compiled maps
import { 
    SPECIFIC_FILE_MAP, 
    EXTENSION_TYPE_MAP, 
    DEFAULT_FILE_TYPE,
    SPECIAL_FOLDER_MAP, 
    TYPE_ICON_MAP, 
    DEFAULT_FILE_ICON, 
    DEFAULT_FOLDER_ICON 
} from './fileTypeMaps.js';

export const getFileType = (fileName, isDir) => {
    if (isDir) return 'folder';
    
    const baseName = fileName.toLowerCase();
    
    // Check specific file mappings first (highest priority)
    if (SPECIFIC_FILE_MAP[baseName]) return SPECIFIC_FILE_MAP[baseName];
    
    // Check extension mappings
    const ext = fileName.split('.').pop()?.toLowerCase();
    return EXTENSION_TYPE_MAP[ext] || DEFAULT_FILE_TYPE;
};

export const getFileIcon = (fileName, isDir) => {
    if (isDir) {
        const folderName = fileName.toLowerCase();
        return SPECIAL_FOLDER_MAP[folderName] || DEFAULT_FOLDER_ICON;
    }
    
    const type = getFileType(fileName, false);
    return TYPE_ICON_MAP[type] || DEFAULT_FILE_ICON;
};

// Filter function for hidden and system files
export const filterFiles = (files, showHiddenFiles) => {
    if (!files) return [];
    if (showHiddenFiles) return files;
    
    return files.filter(file => {
        // Most important: Check the isHidden property from the backend
        if (file.isHidden) return false;
        
        // Hide files that start with . (hidden files) - redundant but kept for safety
        if (file.name.startsWith('.')) return false;
        
        // Hide common Windows system files
        const systemFiles = [
            'NTUSER.DAT', 'ntuser.dat.LOG1', 'ntuser.dat.LOG2', 'ntuser.ini',
            'Application Data', 'Cookies', 'Local Settings', 'My Documents',
            'NetHood', 'PrintHood', 'Recent', 'SendTo', 'Start Menu', 'Templates'
        ];
        
        if (systemFiles.includes(file.name)) return false;
        
        // Hide files with system file extensions and patterns
        const hiddenPatterns = [
            /^NTUSER\.DAT/i,
            /\.TM\.blf$/i,
            /\.TMContainer.*\.regtrans-ms$/i,
            /^thumbs\.db$/i,
            /^desktop\.ini$/i
        ];
        
        return !hiddenPatterns.some(pattern => pattern.test(file.name));
    });
}; 