import { useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";

// Memoized Empty Space Context Menu Component  
const EmptySpaceContextMenu = memo(({ visible, x, y, onClose, onOpenPowerShell, onCreateFolder }) => {
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

    // Add keyboard event handling for empty space context menu shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!visible) return;
            
            // Don't handle keys if user is typing in an input
            if (event.target.matches('input, textarea')) return;
            
            switch (event.key.toLowerCase()) {
                case '+':
                case '=': // Plus key without shift
                    event.preventDefault();
                    onCreateFolder();
                    break;
                case 'p':
                    event.preventDefault();
                    onOpenPowerShell();
                    break;
                case 'escape':
                    event.preventDefault();
                    onClose();
                    break;
            }
        };

        if (visible) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [visible, onCreateFolder, onOpenPowerShell, onClose]);
    
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
            tabIndex={-1} // Make the menu focusable for better keyboard handling
        >
            <div className="context-menu-item" onClick={onCreateFolder}>
                <span className="context-menu-icon">[+]</span>
                <span className="context-menu-text">New Folder</span>
            </div>
            <div className="context-menu-separator"></div>
            <div className="context-menu-item" onClick={onOpenPowerShell}>
                <span className="context-menu-icon">[P]</span>
                <span className="context-menu-text">Open PowerShell 7 Here</span>
            </div>
        </div>
    );
});

export { EmptySpaceContextMenu };
export default EmptySpaceContextMenu; 