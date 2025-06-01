// File type detection and icon mapping utilities

export const getFileType = (fileName, isDir) => {
    if (isDir) return 'folder';
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    const codeExtensions = ['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'rs', 'cpp', 'c', 'h', 'java', 'cs', 'php', 'rb', 'swift', 'kt', 'dart', 'vue', 'svelte'];
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'bmp', 'webp', 'ico'];
    const documentExtensions = ['txt', 'md', 'pdf', 'doc', 'docx', 'rtf', 'odt'];
    const archiveExtensions = ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'];
    const executableExtensions = ['exe', 'msi', 'app', 'deb', 'rpm', 'dmg'];
    
    if (codeExtensions.includes(ext)) return 'code';
    if (imageExtensions.includes(ext)) return 'image';
    if (documentExtensions.includes(ext)) return 'document';
    if (archiveExtensions.includes(ext)) return 'archive';
    if (executableExtensions.includes(ext)) return 'executable';
    
    return 'file';
};

export const getFileIcon = (fileName, isDir) => {
    const type = getFileType(fileName, isDir);
    
    const icons = {
        folder: '📁',
        file: '📄',
        code: '💾',
        image: '🖼️',
        document: '📋',
        archive: '📦',
        executable: '⚡'
    };
    
    return icons[type] || '📄';
};

// Filter function for hidden and system files
export const filterFiles = (files, showHiddenFiles) => {
    if (!files) return [];
    if (showHiddenFiles) return files;
    
    return files.filter(file => {
        // Hide files that start with . (hidden files)
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