import { useState, useEffect } from 'preact/hooks';

const FileIcon = ({ file, className = "" }) => {
    const [iconType, setIconType] = useState('file');
    
    useEffect(() => {
        if (file.isDir) {
            setIconType('folder');
        } else {
            const ext = file.extension?.toLowerCase();
            
            // Image files
            if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico'].includes(ext)) {
                setIconType('image');
            }
            // Code files
            else if (['js', 'jsx', 'ts', 'tsx', 'py', 'go', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yaml', 'yml'].includes(ext)) {
                setIconType('code');
            }
            // Text files
            else if (['txt', 'md', 'rst', 'log', 'csv'].includes(ext)) {
                setIconType('text');
            }
            // Archive files
            else if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) {
                setIconType('archive');
            }
            // Executable files
            else if (['exe', 'msi', 'app', 'deb', 'rpm'].includes(ext)) {
                setIconType('executable');
            }
            else {
                setIconType('file');
            }
        }
    }, [file]);
    
    const getIconSymbol = () => {
        switch (iconType) {
            case 'folder':
                return '📁';
            case 'image':
                return '🖼️';
            case 'code':
                return '⚡';
            case 'text':
                return '📄';
            case 'archive':
                return '📦';
            case 'executable':
                return '⚙️';
            default:
                return '📄';
        }
    };
    
    const getFileTypeLabel = () => {
        if (file.isDir) return 'DIR';
        if (file.extension) return file.extension.toUpperCase();
        return 'FILE';
    };
    
    return (
        <div className={`file-icon ${iconType} ${className}`} title={file.name}>
            <span className="text-xs">{getFileTypeLabel()}</span>
        </div>
    );
};

export default FileIcon; 