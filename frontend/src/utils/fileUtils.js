// Enhanced file type detection and icon mapping utilities with extensive emoji support

export const getFileType = (fileName, isDir) => {
    if (isDir) return 'folder';
    
    const ext = fileName.split('.').pop()?.toLowerCase();
    const baseName = fileName.toLowerCase();
    
    // Specific file mappings first (highest priority)
    const specificFiles = {
        'readme': 'readme',
        'readme.md': 'readme',
        'readme.txt': 'readme',
        'license': 'license',
        'license.md': 'license',
        'license.txt': 'license',
        'dockerfile': 'docker',
        'docker-compose.yml': 'docker',
        'docker-compose.yaml': 'docker',
        'makefile': 'build',
        'cmake.txt': 'build',
        'package.json': 'nodejs',
        'package-lock.json': 'nodejs',
        'yarn.lock': 'nodejs',
        'pom.xml': 'java',
        'build.gradle': 'java',
        'cargo.toml': 'rust',
        'go.mod': 'go',
        'requirements.txt': 'python',
        'pipfile': 'python',
        '.gitignore': 'git',
        '.gitmodules': 'git',
        '.env': 'config',
        '.env.local': 'config',
        '.env.example': 'config'
    };
    
    if (specificFiles[baseName]) return specificFiles[baseName];
    
    // Programming languages and scripts
    const codeTypes = {
        // Web technologies
        'js': 'javascript', 'mjs': 'javascript', 'cjs': 'javascript',
        'jsx': 'react', 'tsx': 'react',
        'ts': 'typescript',
        'html': 'html', 'htm': 'html',
        'css': 'css', 'scss': 'sass', 'sass': 'sass', 'less': 'css',
        'vue': 'vue', 'svelte': 'svelte',
        'php': 'php', 'phtml': 'php',
        
        // System languages
        'c': 'c', 'h': 'c',
        'cpp': 'cpp', 'cxx': 'cpp', 'cc': 'cpp', 'hpp': 'cpp',
        'cs': 'csharp', 'csx': 'csharp',
        'java': 'java', 'class': 'java', 'jar': 'java',
        'go': 'go',
        'rs': 'rust', 'rlib': 'rust',
        'swift': 'swift',
        'kt': 'kotlin', 'kts': 'kotlin',
        'dart': 'dart',
        
        // Scripting languages
        'py': 'python', 'pyw': 'python', 'pyc': 'python',
        'rb': 'ruby', 'rbw': 'ruby',
        'pl': 'perl', 'pm': 'perl',
        'lua': 'lua',
        'r': 'r', 'rdata': 'r',
        'jl': 'julia',
        
        // Shell scripts
        'sh': 'shell', 'bash': 'shell', 'zsh': 'shell', 'fish': 'shell',
        'ps1': 'powershell', 'psm1': 'powershell',
        'bat': 'batch', 'cmd': 'batch',
        
        // Assembly and low-level
        'asm': 'assembly', 's': 'assembly',
        
        // Database
        'sql': 'database', 'mysql': 'database', 'pgsql': 'database',
        'db': 'database', 'sqlite': 'database', 'sqlite3': 'database',
        
        // Configuration and data
        'json': 'json', 'jsonc': 'json',
        'xml': 'xml', 'xsd': 'xml', 'xsl': 'xml',
        'yaml': 'yaml', 'yml': 'yaml',
        'toml': 'config', 'ini': 'config', 'cfg': 'config', 'conf': 'config',
        'properties': 'config', 'env': 'config'
    };
    
    if (codeTypes[ext]) return codeTypes[ext];
    
    // Images
    const imageTypes = {
        'jpg': 'image', 'jpeg': 'image',
        'png': 'image',
        'gif': 'gif',
        'svg': 'vector',
        'bmp': 'image',
        'webp': 'image',
        'ico': 'icon',
        'tiff': 'image', 'tif': 'image',
        'raw': 'camera', 'cr2': 'camera', 'nef': 'camera', 'arw': 'camera',
        'psd': 'photoshop', 'psb': 'photoshop',
        'ai': 'illustrator',
        'sketch': 'design',
        'fig': 'figma',
        'xd': 'xd'
    };
    
    if (imageTypes[ext]) return imageTypes[ext];
    
    // Audio files
    const audioTypes = {
        'mp3': 'audio', 'm4a': 'audio', 'aac': 'audio',
        'wav': 'audio', 'flac': 'audio', 'ogg': 'audio',
        'wma': 'audio', 'aiff': 'audio',
        'midi': 'music', 'mid': 'music'
    };
    
    if (audioTypes[ext]) return audioTypes[ext];
    
    // Video files
    const videoTypes = {
        'mp4': 'video', 'm4v': 'video',
        'avi': 'video', 'mkv': 'video', 'mov': 'video',
        'wmv': 'video', 'flv': 'video', 'webm': 'video',
        '3gp': 'video', 'mpg': 'video', 'mpeg': 'video'
    };
    
    if (videoTypes[ext]) return videoTypes[ext];
    
    // Documents
    const documentTypes = {
        'pdf': 'pdf',
        'doc': 'word', 'docx': 'word',
        'xls': 'excel', 'xlsx': 'excel', 'csv': 'csv',
        'ppt': 'powerpoint', 'pptx': 'powerpoint',
        'odt': 'document', 'ods': 'document', 'odp': 'document',
        'rtf': 'document',
        'txt': 'text',
        'md': 'markdown', 'markdown': 'markdown',
        'tex': 'latex', 'bib': 'latex',
        'epub': 'ebook', 'mobi': 'ebook', 'azw': 'ebook'
    };
    
    if (documentTypes[ext]) return documentTypes[ext];
    
    // Archives
    const archiveTypes = {
        'zip': 'archive', 'rar': 'archive', '7z': 'archive',
        'tar': 'archive', 'gz': 'archive', 'bz2': 'archive',
        'xz': 'archive', 'lz': 'archive', 'lzma': 'archive',
        'cab': 'archive', 'iso': 'disc', 'dmg': 'disc',
        'pkg': 'package', 'deb': 'package', 'rpm': 'package'
    };
    
    if (archiveTypes[ext]) return archiveTypes[ext];
    
    // Executables
    const executableTypes = {
        'exe': 'executable', 'msi': 'installer', 'app': 'macos',
        'run': 'executable', 'bin': 'executable',
        'appimage': 'executable', 'snap': 'executable'
    };
    
    if (executableTypes[ext]) return executableTypes[ext];
    
    // Fonts
    const fontTypes = {
        'ttf': 'font', 'otf': 'font', 'woff': 'font', 'woff2': 'font',
        'eot': 'font', 'fon': 'font'
    };
    
    if (fontTypes[ext]) return fontTypes[ext];
    
    // 3D and CAD
    const threeDTypes = {
        'obj': '3d', 'fbx': '3d', 'dae': '3d', 'blend': 'blender',
        'max': '3d', '3ds': '3d', 'stl': '3d', 'ply': '3d',
        'dwg': 'cad', 'dxf': 'cad', 'step': 'cad', 'iges': 'cad'
    };
    
    if (threeDTypes[ext]) return threeDTypes[ext];
    
    // Default fallback
    return 'file';
};

export const getFileIcon = (fileName, isDir) => {
    if (isDir) {
        // Special folder icons
        const folderName = fileName.toLowerCase();
        const specialFolders = {
            'node_modules': '📦',
            '.git': '🔀',
            '.vscode': '🔵',
            '.idea': '💡',
            'dist': '📦',
            'build': '🔨',
            'src': '📂',
            'assets': '🎨',
            'images': '🖼️',
            'img': '🖼️',
            'css': '🎨',
            'js': '📜',
            'components': '🧩',
            'utils': '🔧',
            'config': '⚙️',
            'docs': '📚',
            'documentation': '📚',
            'test': '🧪',
            'tests': '🧪',
            '__pycache__': '🐍',
            'venv': '🐍',
            'env': '🌍',
            'bin': '⚙️',
            'lib': '📚',
            'include': '📂',
            'public': '🌐',
            'private': '🔒',
            'temp': '🗂️',
            'tmp': '🗂️',
            'cache': '💾',
            'log': '📝',
            'logs': '📝'
        };
        
        return specialFolders[folderName] || '📁';
    }
    
    const type = getFileType(fileName, false);
    
    const icons = {
        // Programming languages
        'javascript': '🟨',
        'typescript': '🔷',
        'react': '⚛️',
        'vue': '💚',
        'svelte': '🧡',
        'html': '🌐',
        'css': '🎨',
        'sass': '💅',
        'php': '🐘',
        'python': '🐍',
        'java': '☕',
        'csharp': '🔷',
        'cpp': '⚙️',
        'c': '🔧',
        'go': '🐹',
        'rust': '🦀',
        'swift': '🐦',
        'kotlin': '🟣',
        'dart': '🎯',
        'ruby': '💎',
        'perl': '🐪',
        'lua': '🌙',
        'r': '📊',
        'julia': '🔴',
        'shell': '🐚',
        'powershell': '💙',
        'batch': '⚫',
        'assembly': '🔩',
        
        // Data and config
        'json': '📋',
        'xml': '📄',
        'yaml': '📝',
        'database': '🗄️',
        'config': '⚙️',
        
        // Special files
        'readme': '📖',
        'license': '📜',
        'docker': '🐳',
        'build': '🔨',
        'nodejs': '💚',
        'git': '🔀',
        
        // Images
        'image': '🖼️',
        'gif': '🎞️',
        'vector': '🎨',
        'icon': '🔳',
        'camera': '📷',
        'photoshop': '🎨',
        'illustrator': '🎨',
        'design': '🎨',
        'figma': '🎨',
        'xd': '🎨',
        
        // Media
        'audio': '🎵',
        'music': '🎼',
        'video': '🎬',
        
        // Documents
        'pdf': '📕',
        'word': '📘',
        'excel': '📗',
        'csv': '📊',
        'powerpoint': '📙',
        'document': '📄',
        'text': '📝',
        'markdown': '📝',
        'latex': '📖',
        'ebook': '📚',
        
        // Archives and packages
        'archive': '📦',
        'package': '📦',
        'disc': '💿',
        
        // Executables
        'executable': '⚡',
        'installer': '📦',
        'macos': '🍎',
        
        // Fonts
        'font': '🔤',
        
        // 3D and design
        '3d': '🎲',
        'blender': '🎲',
        'cad': '📐',
        
        // Default
        'file': '📄',
        'folder': '📁'
    };
    
    return icons[type] || '📄';
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