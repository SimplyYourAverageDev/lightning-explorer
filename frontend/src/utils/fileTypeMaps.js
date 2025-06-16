// Pre-compiled file type and icon maps for optimal performance using Phosphor Icons
// These are constants that are computed once at module load time

// Import Phosphor Icons
import {
    FileIcon,
    FolderIcon,
    FileImageIcon,
    FileVideoIcon,
    MusicNotesIcon,
    FileTextIcon,
    FileCodeIcon,
    FileZipIcon,
    GearIcon,
    FileJsIcon,
    FileTsIcon,
    FileJsxIcon,
    FileVueIcon,
    FileHtmlIcon,
    FileCssIcon,
    DatabaseIcon,
    FilePdfIcon,
    MicrosoftWordLogoIcon,
    MicrosoftExcelLogoIcon,
    MicrosoftPowerpointLogoIcon,
    ArchiveIcon,
    CaretRightIcon,
    CaretDownIcon,
    FolderOpenIcon,
    TerminalIcon,
    GitBranchIcon,
    HammerIcon,
    PuzzlePieceIcon,
    WrenchIcon,
    BooksIcon,
    TestTubeIcon,
    PackageIcon,
    GlobeIcon,
    LockIcon,
    TrashIcon,
    NotePencilIcon,
    CameraIcon,
    PaintBrushIcon,
    SpeakerHighIcon,
    VideoIcon,
    BookOpenIcon,
    FloppyDiskIcon,
    LightningIcon,
    TextTIcon,
    CubeIcon,
    DiamondIcon,
    RulerIcon,
    FilePyIcon,
    // Add more icons as needed
} from '@phosphor-icons/react';

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
    
    // Windows scripts
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
    'cab': 'archive', 'iso': 'disc',
    
    // Executables
    'exe': 'executable', 'msi': 'installer',
    
    // Fonts
    'ttf': 'font', 'otf': 'font', 'woff': 'font', 'woff2': 'font',
    'eot': 'font', 'fon': 'font',
    
    // 3D and CAD
    'obj': '3d', 'fbx': '3d', 'dae': '3d', 'blend': 'blender',
    'max': '3d', '3ds': '3d', 'stl': '3d', 'ply': '3d',
    'dwg': 'cad', 'dxf': 'cad', 'step': 'cad', 'iges': 'cad'
};

// Special folder icons - Phosphor Icon components
export const SPECIAL_FOLDER_MAP = {
    'node_modules': PackageIcon,
    '.git': GitBranchIcon,
    '.vscode': FileCodeIcon,
    '.idea': FileCodeIcon,
    'dist': PackageIcon,
    'build': HammerIcon,
    'src': FolderIcon,
    'assets': PaintBrushIcon,
    'images': FileImageIcon,
    'img': FileImageIcon,
    'css': FileCssIcon,
    'js': FileJsIcon,
    'components': PuzzlePieceIcon,
    'utils': WrenchIcon,
    'config': GearIcon,
    'docs': BooksIcon,
    'documentation': BooksIcon,
    'test': TestTubeIcon,
    'tests': TestTubeIcon,
    '__pycache__': FilePyIcon,
    'venv': FilePyIcon,
    'env': GlobeIcon,
    'bin': GearIcon,
    'lib': BooksIcon,
    'include': FolderIcon,
    'public': GlobeIcon,
    'private': LockIcon,
    'temp': FolderIcon,
    'tmp': FolderIcon,
    'cache': FloppyDiskIcon,
    'log': NotePencilIcon,
    'logs': NotePencilIcon
};

// Type to icon mappings - Phosphor Icon components
export const TYPE_ICON_MAP = {
    // Programming languages
    'javascript': FileJsIcon,
    'typescript': FileTsIcon,
    'react': FileJsxIcon,
    'vue': FileVueIcon,
    'svelte': FileCodeIcon,
    'html': FileHtmlIcon,
    'css': FileCssIcon,
    'sass': FileCssIcon,
    'php': FileCodeIcon,
    'python': FilePyIcon,
    'java': FileCodeIcon,
    'csharp': FileCodeIcon,
    'cpp': FileCodeIcon,
    'c': FileCodeIcon,
    'go': FileCodeIcon,
    'rust': FileCodeIcon,
    'swift': FileCodeIcon,
    'kotlin': FileCodeIcon,
    'dart': FileCodeIcon,
    'ruby': FileCodeIcon,
    'perl': FileCodeIcon,
    'lua': FileCodeIcon,
    'r': FileCodeIcon,
    'julia': FileCodeIcon,
    'powershell': TerminalIcon,
    'batch': TerminalIcon,
    'assembly': FileCodeIcon,
    
    // Data and config
    'json': FileCodeIcon,
    'xml': FileCodeIcon,
    'yaml': FileCodeIcon,
    'database': DatabaseIcon,
    'config': GearIcon,
    
    // Special files
    'readme': BookOpenIcon,
    'license': FileTextIcon,
    'docker': PackageIcon,
    'build': HammerIcon,
    'nodejs': FileJsIcon,
    'git': GitBranchIcon,
    
    // Images
    'image': FileImageIcon,
    'gif': FileImageIcon,
    'vector': PaintBrushIcon,
    'icon': FileImageIcon,
    'camera': CameraIcon,
    'photoshop': PaintBrushIcon,
    'illustrator': PaintBrushIcon,
    'design': PaintBrushIcon,
    'figma': PaintBrushIcon,
    'xd': PaintBrushIcon,
    
    // Media
    'audio': SpeakerHighIcon,
    'music': SpeakerHighIcon,
    'video': VideoIcon,
    
    // Documents
    'pdf': FilePdfIcon,
    'word': MicrosoftWordLogoIcon,
    'excel': MicrosoftExcelLogoIcon,
    'csv': MicrosoftExcelLogoIcon,
    'powerpoint': MicrosoftPowerpointLogoIcon,
    'document': FileTextIcon,
    'text': FileTextIcon,
    'markdown': FileTextIcon,
    'latex': BookOpenIcon,
    'ebook': BookOpenIcon,
    
    // Archives and packages
    'archive': ArchiveIcon,
    'package': PackageIcon,
    'disc': FloppyDiskIcon,
    
    // Executables
    'executable': LightningIcon,
    'installer': PackageIcon,
    'batch': TerminalIcon,
    
    // Fonts
    'font': TextTIcon,
    
    // 3D and design
    '3d': CubeIcon,
    'blender': CubeIcon,
    'cad': RulerIcon,
    
    // Default
    'file': FileIcon,
    'folder': FolderIcon
};

// Default icon components
export const DEFAULT_FILE_ICON = FileIcon;
export const DEFAULT_FOLDER_ICON = FolderIcon;

// Helper function to get icon component
export const getIconComponent = (type, isDir = false) => {
    if (isDir) {
        return FolderIcon;
    }
    
    return TYPE_ICON_MAP[type] || FileIcon;
};

// Special folder icon getter
export const getSpecialFolderIcon = (folderName) => {
    return SPECIAL_FOLDER_MAP[folderName.toLowerCase()] || FolderIcon;
}; 