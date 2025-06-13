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
            className="modern-context-menu"
            onSelectStart={(e) => e.preventDefault()}
            style={{ 
                position: 'fixed', 
                left: x, 
                top: y, 
                zIndex: 1000 
            }}
            tabIndex={-1}
        >
            <div className="context-menu-item-modern" onClick={onCreateFolder}>
                <span className="context-menu-icon-modern">📁</span>
                <span className="context-menu-text-modern">New Folder</span>
                <span className="context-menu-shortcut">+</span>
            </div>
            
            <div className="context-menu-separator-modern"></div>
            
            <div className="context-menu-item-modern" onClick={onOpenPowerShell}>
                <span className="context-menu-icon-modern">💻</span>
                <span className="context-menu-text-modern">Open PowerShell Here</span>
                <span className="context-menu-shortcut">P</span>
            </div>
        </div>
    );
});

export { EmptySpaceContextMenu };
export default EmptySpaceContextMenu; 