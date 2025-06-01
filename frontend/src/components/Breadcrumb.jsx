import { memo, useMemo, useCallback } from "preact/compat";

// Memoized Breadcrumb component
const Breadcrumb = memo(({ currentPath, onNavigate }) => {
    const segments = useMemo(() => 
        currentPath.split(/[\/\\]/).filter(Boolean), 
        [currentPath]
    );
    
    const handleSegmentClick = useCallback((index) => {
        if (index === -1) {
            // Root click - navigate to first drive on Windows or root on Unix
            if (segments.length > 0 && segments[0].includes(':')) {
                // Windows - navigate to drive root
                onNavigate(segments[0] + '\\');
            } else {
                // Unix - navigate to root
                onNavigate('/');
            }
        } else {
            // Build path from segments
            const pathSegments = segments.slice(0, index + 1);
            let newPath;
            
            if (pathSegments[0].includes(':')) {
                // Windows path
                newPath = pathSegments.join('\\');
                if (!newPath.endsWith('\\') && index === 0) {
                    newPath += '\\';
                }
            } else {
                // Unix path
                newPath = '/' + pathSegments.join('/');
            }
            
            onNavigate(newPath);
        }
    }, [segments, onNavigate]);
    
    return (
        <div className="nav-breadcrumb custom-scrollbar">
            <span 
                className="nav-segment" 
                onClick={() => handleSegmentClick(-1)}
            >
                ROOT
            </span>
            {segments.map((segment, index) => (
                <span key={index}>
                    <span className="separator">/</span>
                    <span 
                        className={`nav-segment ${index === segments.length - 1 ? 'current' : ''}`}
                        onClick={() => handleSegmentClick(index)}
                    >
                        {segment}
                    </span>
                </span>
            ))}
        </div>
    );
});

export default Breadcrumb; 