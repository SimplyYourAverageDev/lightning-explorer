import { useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";

// Memoized Empty Space Context Menu Component  
const EmptySpaceContextMenu = memo(({ visible, x, y, onClose, onOpenPowerShell }) => {
    const menuRef = useRef(null);
    
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };
        
        if (visible) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [visible, onClose]);
    
    if (!visible) return null;
    
    return (
        <div 
            ref={menuRef}
            className="context-menu empty-space-context-menu"
            onSelectStart={(e) => e.preventDefault()}
            style={{ 
                position: 'fixed', 
                left: x, 
                top: y, 
                zIndex: 1000 
            }}
        >
            <div className="context-menu-item" onClick={onOpenPowerShell}>
                <span className="context-menu-icon">[{'>'}_]</span>
                <span className="context-menu-text">Open PowerShell 7 Here</span>
            </div>
        </div>
    );
});

export { EmptySpaceContextMenu };
export default EmptySpaceContextMenu; 