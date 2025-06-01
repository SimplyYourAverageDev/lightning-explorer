import { useState } from 'preact/hooks';
import FileIcon from './FileIcon';

const FileList = ({ contents, onNavigate, isLoading }) => {
    const [selectedFile, setSelectedFile] = useState(null);
    
    const formatFileSize = (size) => {
        if (size === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(size) / Math.log(k));
        return `${parseFloat((size / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
    };
    
    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    
    const handleFileClick = (file) => {
        setSelectedFile(file);
        if (file.isDir) {
            onNavigate(file.path);
        }
    };
    
    const handleDoubleClick = (file) => {
        if (file.isDir) {
            onNavigate(file.path);
        }
    };
    
    if (isLoading) {
        return (
            <div className="blueprint-panel flex-1">
                <div className="blueprint-panel-header">
                    <span>Loading Directory...</span>
                </div>
                <div className="p-8 text-center">
                    <div className="blueprint-loading text-blue-300">
                        <div className="inline-block w-6 h-6 border-2 border-blue-300 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="mt-4 text-gray-400">Scanning files...</p>
                </div>
            </div>
        );
    }
    
    const allItems = [...contents.directories, ...contents.files];
    
    return (
        <div className="blueprint-panel flex-1 flex flex-col">
            <div className="blueprint-panel-header flex justify-between items-center">
                <span>Directory Contents</span>
                <div className="text-xs opacity-75">
                    {contents.totalDirs} folders, {contents.totalFiles} files
                </div>
            </div>
            
            <div className="flex-1 overflow-auto custom-scrollbar">
                {allItems.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        <div className="text-4xl mb-4">📂</div>
                        <p>This directory is empty</p>
                    </div>
                ) : (
                    <div className="p-2">
                        {/* Header row */}
                        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs font-semibold text-gray-400 border-b border-gray-600 uppercase tracking-wider">
                            <div className="col-span-5">Name</div>
                            <div className="col-span-2">Size</div>
                            <div className="col-span-3">Modified</div>
                            <div className="col-span-2">Type</div>
                        </div>
                        
                        {/* File/folder rows */}
                        {allItems.map((file, index) => (
                            <div
                                key={`${file.path}-${index}`}
                                onClick={() => handleFileClick(file)}
                                onDoubleClick={() => handleDoubleClick(file)}
                                className={`
                                    grid grid-cols-12 gap-2 px-3 py-2 mx-1 my-1 rounded-md cursor-pointer
                                    transition-all duration-200 ease-in-out
                                    hover:bg-blue-900/30 hover:border-blue-400/30 border border-transparent
                                    ${selectedFile?.path === file.path ? 'bg-blue-800/40 border-blue-400/50' : ''}
                                    ${file.isHidden ? 'opacity-60' : ''}
                                `}
                            >
                                {/* Name column */}
                                <div className="col-span-5 flex items-center space-x-3 min-w-0">
                                    <FileIcon file={file} />
                                    <span className={`truncate text-sm ${file.isDir ? 'text-blue-300 font-medium' : 'text-gray-200'}`}>
                                        {file.name}
                                    </span>
                                </div>
                                
                                {/* Size column */}
                                <div className="col-span-2 flex items-center text-xs text-gray-400">
                                    {file.isDir ? '—' : formatFileSize(file.size)}
                                </div>
                                
                                {/* Modified column */}
                                <div className="col-span-3 flex items-center text-xs text-gray-400">
                                    {file.modTime ? formatDate(file.modTime) : '—'}
                                </div>
                                
                                {/* Type column */}
                                <div className="col-span-2 flex items-center text-xs text-gray-400">
                                    {file.isDir ? 'Folder' : (file.extension || 'File')}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            
            {/* Status bar */}
            <div className="border-t border-gray-600 px-4 py-2 bg-gray-800/50">
                <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>{contents.currentPath}</span>
                    <span>
                        {selectedFile ? (
                            <>Selected: {selectedFile.name}</>
                        ) : (
                            <>{contents.totalDirs + contents.totalFiles} items</>
                        )}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default FileList; 