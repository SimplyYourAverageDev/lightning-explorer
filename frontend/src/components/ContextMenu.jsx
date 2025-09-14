import { useRef, useEffect, useState } from "preact/hooks";
import { memo } from "preact/compat";
import { 
    CopyIcon, 
    ScissorsIcon, 
    PencilIcon, 
    EyeClosedIcon, 
    TrashIcon, 
    XIcon 
} from '@phosphor-icons/react';

// Memoized Context Menu Component
const ContextMenu = memo(({ visible, x, y, files, onClose, onPermanentDelete, onMoveToTrash, onCopy, onCut, onRename, onHide }) => {
    const menuRef = useRef(null);
    const [pos, setPos] = useState({ left: x, top: y });
    
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
                case 'r':
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
    
    useEffect(() => {
        if (visible && menuRef.current) {
            menuRef.current.focus();
        }
    }, [visible]);

    // Re-clamp if the menu size changes after icons/fonts render
    useEffect(() => {
        if (!visible || !menuRef.current) return;
        const pad = 8;
        const el = menuRef.current;
        const observer = new ResizeObserver(() => {
            const rect = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let nx = pos.left;
            let ny = pos.top;
            if (rect.right > vw - pad) nx = Math.max(pad, vw - pad - rect.width);
            if (rect.bottom > vh - pad) ny = Math.max(pad, vh - pad - rect.height);
            if (nx !== pos.left || ny !== pos.top) setPos({ left: nx, top: ny });
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, [visible, pos.left, pos.top]);
    
    // Clamp to viewport when becoming visible or when x/y change
    useEffect(() => {
        if (!visible) return;
        const pad = 8; // viewport padding
        const clamp = () => {
            const el = menuRef.current;
            if (!el) return;
            // temporarily place at raw coords to measure
            el.style.left = `${x}px`;
            el.style.top = `${y}px`;
            const rect = el.getBoundingClientRect();
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            let nx = x;
            let ny = y;
            if (rect.right > vw - pad) nx = Math.max(pad, vw - pad - rect.width);
            if (rect.bottom > vh - pad) ny = Math.max(pad, vh - pad - rect.height);
            if (nx < pad) nx = pad;
            if (ny < pad) ny = pad;
            setPos({ left: nx, top: ny });
        };
        clamp();
        // also clamp on resize/scroll to keep it visible
        const onWin = () => clamp();
        window.addEventListener('resize', onWin);
        window.addEventListener('scroll', onWin, true);
        return () => {
            window.removeEventListener('resize', onWin);
            window.removeEventListener('scroll', onWin, true);
        };
    }, [visible, x, y]);

    if (!visible) return null;
    
    return (
        <div 
            ref={menuRef}
            className="modern-context-menu"
            onSelectStart={(e) => e.preventDefault()}
            style={{ 
                position: 'fixed', 
                left: pos.left, 
                top: pos.top, 
                zIndex: 1000 
            }}
            tabIndex={-1}
        >
            <div className="context-menu-item-modern" onClick={onCopy}>
                <CopyIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Copy</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">C</span>
            </div>
            
            <div className="context-menu-item-modern" onClick={onCut}>
                <ScissorsIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Cut</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">X</span>
            </div>
            
            <div className="context-menu-separator-modern"></div>
            
            {files.length === 1 && (
                <div className="context-menu-item-modern" onClick={onRename}>
                    <PencilIcon size={16} weight="bold" className="context-menu-icon" />
                    <span className="context-menu-text-modern">Rename</span>
                    <span className="context-menu-shortcut">F2</span>
                </div>
            )}
            
            <div className="context-menu-separator-modern"></div>
            
            <div className="context-menu-item-modern warning" onClick={onHide}>
                <EyeClosedIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Hide</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">H</span>
            </div>
            
            <div className="context-menu-separator-modern"></div>
            
            <div className="context-menu-item-modern warning" onClick={onMoveToTrash}>
                <TrashIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Move to Trash</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">Del</span>
            </div>
            
            <div className="context-menu-item-modern danger" onClick={onPermanentDelete}>
                <XIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Permanent Delete</span>
                <span className="context-menu-count">({files.length})</span>
                <span className="context-menu-shortcut">⇧Del</span>
            </div>
        </div>
    );
});

export { ContextMenu };
export default ContextMenu; 
