import { useRef, useEffect, useState } from "preact/hooks";
import { memo } from "preact/compat";
import { PushPinSlashIcon, FolderOpenIcon } from '@phosphor-icons/react';

// Memoized Pinned Item Context Menu Component
const PinnedItemContextMenu = memo(({ visible, x, y, item, onClose, onUnpin, onOpen }) => {
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

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (!visible) return;
            switch (event.key.toLowerCase()) {
                case 'u':
                case 'delete':
                    event.preventDefault();
                    onUnpin();
                    break;
                case 'o':
                case 'enter':
                    event.preventDefault();
                    onOpen();
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
    }, [visible, onUnpin, onOpen, onClose]);

    // Clamp to viewport when visible/x/y change
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

    // Re-clamp on resize of the menu
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

    if (!visible || !item) return null;

    return (
        <div
            ref={menuRef}
            className="modern-context-menu"
            style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 1000 }}
            tabIndex={-1}
        >
            <div className="context-menu-item-modern" onClick={onOpen}>
                <FolderOpenIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Open</span>
                <span className="context-menu-shortcut">Enter</span>
            </div>
            <div className="context-menu-separator-modern"></div>
            <div className="context-menu-item-modern warning" onClick={onUnpin}>
                <PushPinSlashIcon size={16} weight="bold" className="context-menu-icon" />
                <span className="context-menu-text-modern">Unpin from Quick Access</span>
                <span className="context-menu-shortcut">Del</span>
            </div>
        </div>
    );
});

export { PinnedItemContextMenu };
export default PinnedItemContextMenu; 
