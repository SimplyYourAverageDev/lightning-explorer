import { useRef, useEffect } from "preact/hooks";
import { memo } from "preact/compat";
import { PushPinSlashIcon, FolderOpenIcon } from '@phosphor-icons/react';

// Memoized Pinned Item Context Menu Component
const PinnedItemContextMenu = memo(({ visible, x, y, item, onClose, onUnpin, onOpen }) => {
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

    if (!visible || !item) return null;

    return (
        <div
            ref={menuRef}
            className="modern-context-menu"
            style={{ position: 'fixed', left: x, top: y, zIndex: 1000 }}
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