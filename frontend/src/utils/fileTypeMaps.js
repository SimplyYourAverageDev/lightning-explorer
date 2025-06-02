// Pre-compiled file type and icon maps for optimal performance
// These are constants that are computed once at module load time

// Specific file mappings (highest priority)
export const SPECIFIC_FILE_MAP = {
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

// Extension to type mappings
export const EXTENSION_TYPE_MAP = {
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
    'properties': 'config', 'env': 'config',
    
    // Images
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
    'xd': 'xd',
    
    // Audio files
    'mp3': 'audio', 'm4a': 'audio', 'aac': 'audio',
    'wav': 'audio', 'flac': 'audio', 'ogg': 'audio',
    'wma': 'audio', 'aiff': 'audio',
    'midi': 'music', 'mid': 'music',
    
    // Video files
    'mp4': 'video', 'm4v': 'video',
    'avi': 'video', 'mkv': 'video', 'mov': 'video',
    'wmv': 'video', 'flv': 'video', 'webm': 'video',
    '3gp': 'video', 'mpg': 'video', 'mpeg': 'video',
    
    // Documents
    'pdf': 'pdf',
    'doc': 'word', 'docx': 'word',
    'xls': 'excel', 'xlsx': 'excel', 'csv': 'csv',
    'ppt': 'powerpoint', 'pptx': 'powerpoint',
    'odt': 'document', 'ods': 'document', 'odp': 'document',
    'rtf': 'document',
    'txt': 'text',
    'md': 'markdown', 'markdown': 'markdown',
    'tex': 'latex', 'bib': 'latex',
    'epub': 'ebook', 'mobi': 'ebook', 'azw': 'ebook',
    
    // Archives
    'zip': 'archive', 'rar': 'archive', '7z': 'archive',
    'tar': 'archive', 'gz': 'archive', 'bz2': 'archive',
    'xz': 'archive', 'lz': 'archive', 'lzma': 'archive',
    'cab': 'archive', 'iso': 'disc', 'dmg': 'disc',
    'pkg': 'package', 'deb': 'package', 'rpm': 'package',
    
    // Executables
    'exe': 'executable', 'msi': 'installer', 'app': 'macos',
    'run': 'executable', 'bin': 'executable',
    'appimage': 'executable', 'snap': 'executable',
    
    // Fonts
    'ttf': 'font', 'otf': 'font', 'woff': 'font', 'woff2': 'font',
    'eot': 'font', 'fon': 'font',
    
    // 3D and CAD
    'obj': '3d', 'fbx': '3d', 'dae': '3d', 'blend': 'blender',
    'max': '3d', '3ds': '3d', 'stl': '3d', 'ply': '3d',
    'dwg': 'cad', 'dxf': 'cad', 'step': 'cad', 'iges': 'cad'
};

// Special folder icons
export const SPECIAL_FOLDER_MAP = {
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

// Type to icon mappings
export const TYPE_ICON_MAP = {
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

// Default constants
export const DEFAULT_FILE_ICON = '📄';
export const DEFAULT_FOLDER_ICON = '📁';
export const DEFAULT_FILE_TYPE = 'file'; 