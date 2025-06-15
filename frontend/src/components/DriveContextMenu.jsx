import { useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";

// Drive Context Menu Component
const DriveContextMenu = memo(({ visible, x, y, drive, onClose, onEject, onOpenInExplorer, onProperties }) => {
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

    // Add keyboard event handling for drive context menu
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!visible) return;
            
            // Don't handle keys if user is typing in an input
            if (event.target.matches('input, textarea')) return;
            
            switch (event.key.toLowerCase()) {
                case 'e':
                    event.preventDefault();
                    onEject();
                    break;
                case 'o':
                    event.preventDefault();
                    onOpenInExplorer();
                    break;
                case 'p':
                    event.preventDefault();
                    onProperties();
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
    }, [visible, onEject, onOpenInExplorer, onProperties, onClose]);
    
    if (!visible || !drive) return null;
    
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
            <div className="context-menu-item-modern" onClick={onOpenInExplorer}>
                <span className="context-menu-text-modern">Open</span>
                <span className="context-menu-shortcut">O</span>
            </div>
            
            <div className="context-menu-separator-modern"></div>
            
            {/* Only show eject for removable drives (not system drives like C:) */}
            {drive.letter && drive.letter.toUpperCase() !== 'C' && (
                <>
                    <div className="context-menu-item-modern warning" onClick={onEject}>
                        <span className="context-menu-text-modern">Eject Drive</span>
                        <span className="context-menu-shortcut">E</span>
                    </div>
                    
                    <div className="context-menu-separator-modern"></div>
                </>
            )}
            
            <div className="context-menu-item-modern" onClick={onProperties}>
                <span className="context-menu-text-modern">Properties</span>
                <span className="context-menu-shortcut">P</span>
            </div>
        </div>
    );
});

export { DriveContextMenu };
export default DriveContextMenu; 