import { useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";

// Memoized Context Menu Component
const ContextMenu = memo(({ visible, x, y, files, onClose, onPermanentDelete, onMoveToTrash, onCopy, onCut, onRename, onHide }) => {
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

    // Add keyboard event handling for context menu shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!visible) return;
            
            // Don't handle keys if user is typing in an input
            if (event.target.matches('input, textarea')) return;
            
            switch (event.key.toLowerCase()) {
                case 'c':
                    event.preventDefault();
                    onCopy();
                    break;
                case 'x':
                    event.preventDefault();
                    onCut();
                    break;
                case 'h':
                    event.preventDefault();
                    onHide();
                    break;
                case 'delete':
                    event.preventDefault();
                    if (event.shiftKey) {
                        // Shift+Delete: Permanent delete
                        onPermanentDelete();
                    } else {
                        // Delete: Move to trash
                        onMoveToTrash();
                    }
                    break;
                case 'f2':
                    if (files.length === 1) {
                        event.preventDefault();
                        onRename();
                    }
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
    }, [visible, onCopy, onCut, onHide, onPermanentDelete, onMoveToTrash, onRename, onClose, files.length]);
    
    if (!visible) return null;
    
    return (
        <div 
            ref={menuRef}
            className="context-menu"
            onSelectStart={(e) => e.preventDefault()}
            style={{ 
                position: 'fixed', 
                left: x, 
                top: y, 
                zIndex: 1000 
            }}
            tabIndex={-1} // Make the menu focusable for better keyboard handling
        >
            <div className="context-menu-item" onClick={onCopy}>
                <span className="context-menu-icon">[C]</span>
                <span className="context-menu-text">Copy ({files.length})</span>
            </div>
            <div className="context-menu-item" onClick={onCut}>
                <span className="context-menu-icon">[X]</span>
                <span className="context-menu-text">Cut ({files.length})</span>
            </div>
            <div className="context-menu-separator"></div>
            {files.length === 1 && (
                <div className="context-menu-item" onClick={onRename}>
                    <span className="context-menu-icon">[F2]</span>
                    <span className="context-menu-text">Rename</span>
                </div>
            )}
            <div className="context-menu-separator"></div>
            <div className="context-menu-item" onClick={onHide} style={{ color: 'var(--zen-text-secondary)' }}>
                <span className="context-menu-icon">[H]</span>
                <span className="context-menu-text">Hide ({files.length})</span>
            </div>
            <div className="context-menu-separator"></div>
            <div className="context-menu-item" onClick={onMoveToTrash} style={{ color: 'var(--zen-text-warning, #f59e0b)' }}>
                <span className="context-menu-icon">[Del]</span>
                <span className="context-menu-text">Move to Trash ({files.length})</span>
            </div>
            <div className="context-menu-item" onClick={onPermanentDelete} style={{ color: 'var(--zen-error)' }}>
                <span className="context-menu-icon">[Shift+Del]</span>
                <span className="context-menu-text">Permanent Delete ({files.length})</span>
            </div>
        </div>
    );
});

export { ContextMenu };
export default ContextMenu; 