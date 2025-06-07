import { useState, useRef, useEffect, useCallback } from "preact/hooks";
import { memo } from "preact/compat";
import { splitFilename } from "../utils/fileUtils";

// Memoized 8-bit Dialog Component
const RetroDialog = memo(({ isOpen, type, title, message, defaultValue, onConfirm, onCancel, onClose, metadata }) => {
    const [inputValue, setInputValue] = useState(defaultValue || '');
    const inputRef = useRef(null);
    
    useEffect(() => {
        setInputValue(defaultValue || '');
    }, [defaultValue]);
    
    useEffect(() => {
        if (isOpen && type === 'prompt' && inputRef.current) {
            inputRef.current.focus();
            
            // Handle selective text selection for file rename operations
            if (metadata && metadata.isFile && metadata.originalName) {
                const { name, hasExtension } = splitFilename(metadata.originalName);
                
                if (hasExtension && name.length > 0) {
                    // Select only the filename part (before extension)
                    setTimeout(() => {
                        inputRef.current.setSelectionRange(0, name.length);
                    }, 0);
                } else {
                    // No extension or hidden file, select all
                    inputRef.current.select();
                }
            } else {
                // For folders or other dialogs, select all text
                inputRef.current.select();
            }
        }
    }, [isOpen, type, metadata]);
    
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!isOpen) return;
            
            if (e.key === 'Escape') {
                onCancel();
            } else if (e.key === 'Enter') {
                if (type === 'prompt') {
                    onConfirm(inputValue);
                } else {
                    onConfirm();
                }
            }
        };
        
        if (isOpen) {
            document.addEventListener('keydown', handleKeyDown);
            return () => document.removeEventListener('keydown', handleKeyDown);
        }
    }, [isOpen, type, inputValue, onConfirm, onCancel]);
    
    const handleInputChange = useCallback((e) => {
        setInputValue(e.target.value);
    }, []);

    const handleInputKeyDown = useCallback((e) => {
        // Allow Ctrl+A to select all text in the input
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            if (inputRef.current) {
                inputRef.current.select();
            }
        }
    }, []);
    
    const handleConfirm = useCallback(() => {
        if (type === 'prompt') {
            onConfirm(inputValue);
        } else {
            onConfirm();
        }
    }, [type, inputValue, onConfirm]);
    
    if (!isOpen) return null;
    
    return (
        <div className="retro-dialog-overlay" onSelectStart={(e) => e.preventDefault()}>
            <div className={`retro-dialog ${type === 'prompt' ? 'prompt-type' : ''} ${type === 'delete' ? 'delete-type' : ''}`} onSelectStart={(e) => e.preventDefault()}>
                {/* Dialog header */}
                <div className="retro-dialog-header">
                    <div className="retro-dialog-title">{title || 'SYSTEM MESSAGE'}</div>
                    <button 
                        className="retro-dialog-close"
                        onClick={onCancel}
                        title="CLOSE [ESC]"
                    >
                        ✕
                    </button>
                </div>
                
                {/* Dialog content */}
                <div className="retro-dialog-content">
                    <div className="retro-dialog-icon">
                        {type === 'confirm' && '⚠️'}
                        {type === 'prompt' && '✏️'}
                        {type === 'alert' && 'ℹ️'}
                        {type === 'error' && '❌'}
                        {type === 'success' && '✅'}
                        {type === 'delete' && '🗑️'}
                    </div>
                    <div className="retro-dialog-message">
                        {message.split('\n').map((line, index) => (
                            <div key={index}>{line}</div>
                        ))}
                    </div>
                    
                    {type === 'prompt' && (
                        <div className="retro-dialog-input-container">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputValue}
                                onChange={handleInputChange}
                                onKeyDown={handleInputKeyDown}
                                className="retro-dialog-input"
                                placeholder="ENTER VALUE..."
                            />
                        </div>
                    )}
                </div>
                
                {/* Dialog buttons */}
                <div className="retro-dialog-buttons">
                    {type === 'prompt' ? (
                        <>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-primary"
                                onClick={handleConfirm}
                            >
                                [ENTER] CONFIRM
                            </button>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-secondary"
                                onClick={onCancel}
                            >
                                [ESC] CANCEL
                            </button>
                        </>
                    ) : type === 'confirm' || type === 'delete' ? (
                        <>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-primary"
                                onClick={handleConfirm}
                            >
                                [ENTER] YES
                            </button>
                            <button 
                                className="retro-dialog-btn retro-dialog-btn-secondary"
                                onClick={onCancel}
                            >
                                [ESC] NO
                            </button>
                        </>
                    ) : (
                        <button 
                            className="retro-dialog-btn retro-dialog-btn-primary"
                            onClick={handleConfirm}
                        >
                            [ENTER] OK
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
});

export { RetroDialog };
export default RetroDialog; 