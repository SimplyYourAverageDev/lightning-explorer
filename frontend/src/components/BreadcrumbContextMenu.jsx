import { useRef, useEffect, useState } from "preact/hooks";
import { memo } from "preact/compat";
import { CopyIcon } from '@phosphor-icons/react';

const BreadcrumbContextMenu = memo(({ visible, x, y, path, onClose, onCopy }) => {
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
    if (visible && menuRef.current) {
      menuRef.current.focus();
    }
  }, [visible]);

  // Clamp to viewport
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

  // Re-clamp on size change
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

  if (!visible) return null;

  return (
    <div
      ref={menuRef}
      className="modern-context-menu"
      onSelectStart={(e) => e.preventDefault()}
      style={{ position: 'fixed', left: pos.left, top: pos.top, zIndex: 1000 }}
      tabIndex={-1}
    >
      <div
        className="context-menu-item-modern"
        onClick={() => onCopy(path)}
      >
        <CopyIcon size={16} weight="bold" className="context-menu-icon" />
        <span className="context-menu-text-modern">Copy as Path</span>
        <span className="context-menu-shortcut">C</span>
      </div>
    </div>
  );
});

export { BreadcrumbContextMenu };
export default BreadcrumbContextMenu;
