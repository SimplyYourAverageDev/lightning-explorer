import { useState, useEffect } from 'preact/hooks';

const NavigationBar = ({ currentPath, onNavigate, onNavigateUp, onNavigateHome }) => {
    const [pathParts, setPathParts] = useState([]);
    const [inputPath, setInputPath] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    
    useEffect(() => {
        if (currentPath) {
            setInputPath(currentPath);
            // Split path into parts for breadcrumb navigation
            const parts = currentPath.split(/[\\/]/).filter(part => part.length > 0);
            setPathParts(parts);
        }
    }, [currentPath]);
    
    const handlePathInputSubmit = (e) => {
        e.preventDefault();
        if (inputPath.trim()) {
            onNavigate(inputPath.trim());
        }
        setIsEditing(false);
    };
    
    const handleBreadcrumbClick = (index) => {
        if (index === -1) {
            // Root click
            const isWindows = currentPath.includes(':\\');
            if (isWindows) {
                // Go to drive root (e.g., C:\)
                const driveLetter = currentPath.charAt(0);
                onNavigate(`${driveLetter}:\\`);
            } else {
                onNavigate('/');
            }
        } else {
            // Build path up to clicked part
            const isWindows = currentPath.includes(':\\');
            let pathUpTo;
            
            if (isWindows && index === 0) {
                // First part is drive letter
                pathUpTo = pathParts[0];
            } else if (isWindows) {
                pathUpTo = pathParts.slice(0, index + 1).join('\\');
            } else {
                pathUpTo = '/' + pathParts.slice(0, index + 1).join('/');
            }
            
            onNavigate(pathUpTo);
        }
    };
    
    const canNavigateUp = () => {
        if (!currentPath) return false;
        const isRoot = currentPath === '/' || /^[A-Z]:\\?$/.test(currentPath);
        return !isRoot;
    };
    
    return (
        <div className="blueprint-panel">
            <div className="blueprint-panel-header">
                <span>File Explorer Navigation</span>
            </div>
            
            <div className="p-4 space-y-4">
                {/* Quick navigation buttons */}
                <div className="flex space-x-2">
                    <button
                        onClick={onNavigateUp}
                        disabled={!canNavigateUp()}
                        className="blueprint-button disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Go up one level"
                    >
                        ↑ Up
                    </button>
                    
                    <button
                        onClick={onNavigateHome}
                        className="blueprint-button"
                        title="Go to home directory"
                    >
                        🏠 Home
                    </button>
                    
                    <button
                        onClick={() => setIsEditing(!isEditing)}
                        className="blueprint-button"
                        title="Edit path directly"
                    >
                        ✏️ Edit
                    </button>
                </div>
                
                {/* Path display/input */}
                <div className="space-y-2">
                    {isEditing ? (
                        <form onSubmit={handlePathInputSubmit} className="flex space-x-2">
                            <input
                                type="text"
                                value={inputPath}
                                onChange={(e) => setInputPath(e.target.value)}
                                onBlur={() => setIsEditing(false)}
                                className="flex-1 blueprint-input text-sm"
                                placeholder="Enter path..."
                                autoFocus
                            />
                            <button type="submit" className="blueprint-button">
                                Go
                            </button>
                        </form>
                    ) : (
                        /* Breadcrumb navigation */
                        <div className="flex items-center space-x-1 text-sm">
                            <span className="text-gray-400">Path:</span>
                            
                            {/* Root indicator */}
                            <button
                                onClick={() => handleBreadcrumbClick(-1)}
                                className="px-2 py-1 rounded text-blue-300 hover:bg-blue-900/30 transition-colors"
                                title="Go to root"
                            >
                                {currentPath?.includes(':\\') ? '💻' : '/'}
                            </button>
                            
                            {/* Path parts */}
                            {pathParts.map((part, index) => (
                                <div key={index} className="flex items-center space-x-1">
                                    <span className="text-gray-500">/</span>
                                    <button
                                        onClick={() => handleBreadcrumbClick(index)}
                                        className="px-2 py-1 rounded text-blue-300 hover:bg-blue-900/30 transition-colors max-w-32 truncate"
                                        title={part}
                                    >
                                        {part}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Current path display (always visible) */}
                <div className="text-xs text-gray-500 bg-gray-800/30 p-2 rounded border border-gray-600 font-mono">
                    <span className="text-gray-400">Current: </span>
                    <span className="break-all">{currentPath || 'No path selected'}</span>
                </div>
            </div>
        </div>
    );
};

export default NavigationBar; 