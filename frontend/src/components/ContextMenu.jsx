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
            <div className="context-menu-item-modern" onClick={onCopy}>
                <span className="context-menu-icon-modern">📋</span>
                <span className="context-menu-text-modern">Copy</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">C</span>
            </div>
            
            <div className="context-menu-item-modern" onClick={onCut}>
                <span className="context-menu-icon-modern">✂️</span>
                <span className="context-menu-text-modern">Cut</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">X</span>
            </div>
            
            <div className="context-menu-separator-modern"></div>
            
            {files.length === 1 && (
                <div className="context-menu-item-modern" onClick={onRename}>
                    <span className="context-menu-icon-modern">✏️</span>
                    <span className="context-menu-text-modern">Rename</span>
                    <span className="context-menu-shortcut">F2</span>
                </div>
            )}
            
            <div className="context-menu-separator-modern"></div>
            
            <div className="context-menu-item-modern warning" onClick={onHide}>
                <span className="context-menu-icon-modern">👁️‍🗨️</span>
                <span className="context-menu-text-modern">Hide</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">H</span>
            </div>
            
            <div className="context-menu-separator-modern"></div>
            
            <div className="context-menu-item-modern warning" onClick={onMoveToTrash}>
                <span className="context-menu-icon-modern">🗑️</span>
                <span className="context-menu-text-modern">Move to Trash</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">Del</span>
            </div>
            
            <div className="context-menu-item-modern danger" onClick={onPermanentDelete}>
                <span className="context-menu-icon-modern">💥</span>
                <span className="context-menu-text-modern">Permanent Delete</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">⇧Del</span>
            </div>
        </div>
    );
});

export { ContextMenu };
export default ContextMenu; 