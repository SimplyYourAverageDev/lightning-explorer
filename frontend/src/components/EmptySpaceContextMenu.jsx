import { useRef, useEffect, useState } from "preact/hooks";
import { memo } from "preact/compat";
import { 
    FolderPlusIcon, 
    TerminalIcon 
} from '@phosphor-icons/react';

// Memoized Empty Space Context Menu Component  
const EmptySpaceContextMenu = memo(({ visible, x, y, onClose, onOpenPowerShell, onCreateFolder }) => {
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

    // Add keyboard event handling for empty space context menu shortcuts
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!visible) return;
            
            // Don't handle keys if user is typing in an input
            if (event.target.matches('input, textarea')) return;
            
            switch (event.key.toLowerCase()) {
                case '+':
                case 'n':
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
    
    useEffect(() => {
        if (visible && menuRef.current) {
            menuRef.current.focus();
        }
    }, [visible]);

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
        const pad = 8;
        const clamp = () => {
            const el = menuRef.current;
            if (!el) return;
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
            <div className="context-menu-item-modern" onClick={onCreateFolder}>
                <FolderPlusIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">New Folder</span>
                <span className="context-menu-shortcut">+</span>
            </div>
            
            <div className="context-menu-separator-modern"></div>
            
            <div className="context-menu-item-modern" onClick={onOpenPowerShell}>
                <TerminalIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Open PowerShell Here</span>
                <span className="context-menu-shortcut">P</span>
            </div>
        </div>
    );
});

export { EmptySpaceContextMenu };
export default EmptySpaceContextMenu; 
