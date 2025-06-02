import { useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";

// Memoized Context Menu Component
const ContextMenu = memo(({ visible, x, y, files, onClose, onPermanentDelete, onCopy, onCut, onRename, onHide }) => {
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
            className="context-menu"
            onSelectStart={(e) => e.preventDefault()}
            style={{ 
                position: 'fixed', 
                left: x, 
                top: y, 
                zIndex: 1000 
            }}
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
            <div className="context-menu-item" onClick={onHide} style={{ color: 'var(--blueprint-text-secondary)' }}>
                <span className="context-menu-icon">[H]</span>
                <span className="context-menu-text">Hide ({files.length})</span>
            </div>
            <div className="context-menu-item" onClick={onPermanentDelete} style={{ color: 'var(--blueprint-error)' }}>
                <span className="context-menu-icon">[!]</span>
                <span className="context-menu-text">Delete ({files.length})</span>
            </div>
        </div>
    );
});

export { ContextMenu };
export default ContextMenu; 