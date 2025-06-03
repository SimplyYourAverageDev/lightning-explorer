import { memo, useMemo, useCallback } from "preact/compat";

// Memoized Breadcrumb component
const Breadcrumb = memo(({ 
    currentPath, 
    onNavigate
}) => {
    const segments = useMemo(() => {
        if (!currentPath) return [];
        
        // Handle Windows and Unix paths differently
        const isWindows = currentPath.includes('\\') || currentPath.includes(':');
        
        if (isWindows) {
            // For Windows paths like "C:\Users\username"
            const parts = currentPath.split(/[\\]/);
            return parts.filter(Boolean);
        } else {
            // For Unix paths like "/home/username"
            const parts = currentPath.split('/');
            return parts.filter(Boolean);
        }
    }, [currentPath]);
    
    const handleSegmentClick = useCallback((index) => {
        // Build path from segments
        const pathSegments = segments.slice(0, index + 1);
        let newPath;
        
        // Detect Windows vs Unix path
        const isWindows = currentPath.includes('\\') || currentPath.includes(':');
        
        if (isWindows) {
            // Windows path reconstruction
            newPath = pathSegments.join('\\');
            // Add trailing backslash for drive roots
            if (index === 0 && pathSegments[0].includes(':')) {
                newPath += '\\';
            }
        } else {
            // Unix path reconstruction
            newPath = '/' + pathSegments.join('/');
        }
        
        onNavigate(newPath);
    }, [segments, onNavigate, currentPath]);
    
    if (!segments.length) return null;
    
    return (
        <div className="nav-breadcrumb custom-scrollbar" onSelectStart={(e) => e.preventDefault()}>
            {segments.map((segment, index) => (
                <div key={index} className="breadcrumb-segment-wrapper">
                    {index > 0 && <span className="separator">{'/'}</span>}
                    <span 
                        className={`nav-segment ${index === segments.length - 1 ? 'current' : ''}`}
                        onClick={() => handleSegmentClick(index)}
                        title={segment}
                    >
                        {segment}
                    </span>
                </div>
            ))}
        </div>
    );
});

export { Breadcrumb };
export default Breadcrumb; 