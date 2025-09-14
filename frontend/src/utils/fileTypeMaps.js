// Pre-compiled file type and icon maps for optimal performance using Phosphor Icons
// These are constants that are computed once at module load time

// Import a compact set of Phosphor Icons for performance
import {
    FileIcon,
    FolderIcon,
    FileImageIcon,
    FileTextIcon,
    FileCodeIcon,
    FileZipIcon,
    SpeakerHighIcon,
    VideoIcon,
    LightningIcon,
} from '@phosphor-icons/react';

// Specific file mappings (highest priority)
export const SPECIFIC_FILE_MAP = {
    'readme': 'document',
    'readme.md': 'document',
    'readme.txt': 'document',
    'license': 'document',
    'license.md': 'document',
    'license.txt': 'document',
    'dockerfile': 'code',
    'docker-compose.yml': 'code',
    'docker-compose.yaml': 'code',
    'makefile': 'code',
    'cmake.txt': 'code',
    'package.json': 'code',
    'package-lock.json': 'code',
    'yarn.lock': 'code',
    'pom.xml': 'code',
    'build.gradle': 'code',
    'cargo.toml': 'code',
    'go.mod': 'code',
    'requirements.txt': 'code',
    'pipfile': 'code',
    '.gitignore': 'code',
    '.gitmodules': 'code',
    '.env': 'document',
    '.env.local': 'document',
    '.env.example': 'document'
};

// Extension to type mappings
export const EXTENSION_TYPE_MAP = {
    // Code -> generic 'code'
    'js':'code','mjs':'code','cjs':'code','jsx':'code','tsx':'code','ts':'code','html':'code','htm':'code','css':'code','scss':'code','sass':'code','less':'code','vue':'code','svelte':'code','php':'code','phtml':'code','c':'code','h':'code','cpp':'code','cxx':'code','cc':'code','hpp':'code','cs':'code','csx':'code','java':'code','class':'code','jar':'code','go':'code','rs':'code','rlib':'code','swift':'code','kt':'code','kts':'code','dart':'code','py':'code','pyw':'code','pyc':'code','rb':'code','rbw':'code','pl':'code','pm':'code','lua':'code','r':'code','rdata':'code','jl':'code','ps1':'code','psm1':'code','bat':'code','cmd':'code','asm':'code','s':'code','sql':'code','db':'code','sqlite':'code','sqlite3':'code','json':'code','jsonc':'code','xml':'code','yaml':'code','yml':'code','ini':'code','toml':'code','cfg':'code','conf':'code','properties':'code',
    // Media
    'jpg':'image','jpeg':'image','png':'image','gif':'image','svg':'image','bmp':'image','webp':'image','ico':'image','tiff':'image','tif':'image',
    'mp3':'audio','m4a':'audio','aac':'audio','wav':'audio','flac':'audio','ogg':'audio','wma':'audio','aiff':'audio','midi':'audio','mid':'audio',
    'mp4':'video','m4v':'video','avi':'video','mkv':'video','mov':'video','wmv':'video','flv':'video','webm':'video','3gp':'video','mpg':'video','mpeg':'video',
    // Documents
    'pdf':'document','doc':'document','docx':'document','xls':'document','xlsx':'document','csv':'document','ppt':'document','pptx':'document','odt':'document','ods':'document','odp':'document','rtf':'document','txt':'document','md':'document','markdown':'document',
    // Archives & executables
    'zip':'archive','rar':'archive','7z':'archive','cab':'archive','iso':'archive',
    'exe':'executable','msi':'executable'
};

// Special folder icons - Phosphor Icon components
export const SPECIAL_FOLDER_MAP = {
    'images': FileImageIcon,
    'img': FileImageIcon,
};

// Type to icon mappings - Phosphor Icon components
export const TYPE_ICON_MAP = {
    image: FileImageIcon,
    video: VideoIcon,
    audio: SpeakerHighIcon,
    document: FileTextIcon,
    code: FileCodeIcon,
    archive: FileZipIcon,
    executable: LightningIcon,
    file: FileIcon,
    folder: FolderIcon,
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
