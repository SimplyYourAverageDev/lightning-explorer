import { useState, useEffect } from "preact/hooks";

const InspectMenu = ({ visible, x, y, onClose, element }) => {
    if (!visible) return null;

    const handleInspectElement = () => {
        // In development mode, we can try to trigger the browser's inspect functionality
        if (element) {
            // Log the element for inspection
            console.log('🔍 Inspecting element:', element);
            
            // Try to trigger the browser's native context menu
            // This will work in development mode when dev tools are available
            const rect = element.getBoundingClientRect();
            const event = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: false, // Don't allow cancellation
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                button: 2
            });
            
            // Temporarily disable our custom context menu handling
            const originalHandler = element.oncontextmenu;
            element.oncontextmenu = null;
            
            // Dispatch the event
            element.dispatchEvent(event);
            
            // Restore the original handler after a short delay
            setTimeout(() => {
                element.oncontextmenu = originalHandler;
            }, 100);
        }
        onClose();
    };

    const handleCopySelector = () => {
        if (element) {
            // Generate a CSS selector for the element
            let selector = element.tagName.toLowerCase();
            if (element.id) {
                selector += `#${element.id}`;
            }
            if (element.className) {
                const classes = element.className.split(' ').filter(c => c.trim());
                selector += classes.map(c => `.${c}`).join('');
            }
            
            navigator.clipboard.writeText(selector).then(() => {
                console.log('Selector copied:', selector);
            });
        }
        onClose();
    };

    const handleLogElement = () => {
        if (element) {
            console.log('🔍 Inspected Element:', element);
            console.log('📊 Element Properties:', {
                tagName: element.tagName,
                id: element.id,
                className: element.className,
                textContent: element.textContent?.substring(0, 100),
                attributes: Array.from(element.attributes).map(attr => ({
                    name: attr.name,
                    value: attr.value
                }))
            });
        }
        onClose();
    };

    return (
        <div 
            className="context-menu inspect-menu"
            style={{
                left: x,
                top: y,
                background: '#1a1a1a',
                border: '1px solid #444',
                color: '#fff'
            }}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="context-menu-item" onClick={handleInspectElement}>
                🔍 Inspect Element
            </div>
            <div className="context-menu-item" onClick={handleLogElement}>
                📊 Log to Console
            </div>
            <div className="context-menu-item" onClick={handleCopySelector}>
                📋 Copy Selector
            </div>
            <div className="context-menu-separator"></div>
            <div className="context-menu-item" onClick={onClose}>
                ❌ Close
            </div>
        </div>
    );
};

export { InspectMenu }; 