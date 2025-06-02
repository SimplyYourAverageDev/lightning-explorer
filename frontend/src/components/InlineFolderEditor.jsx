import { memo } from "preact/compat";

// Inline folder editor component with 8-bit retro styling
const InlineFolderEditor = memo(({ 
    tempFolderName,
    editInputRef,
    onKeyDown,
    onChange,
    onBlur
}) => {
    return (
        <div className="file-item creating-folder">
            <div className="file-icon folder">
                📁
            </div>
            <div className="file-details">
                <div className="file-name">
                    <input
                        ref={editInputRef}
                        type="text"
                        value={tempFolderName}
                        onChange={onChange}
                        onKeyDown={onKeyDown}
                        onBlur={onBlur}
                        className="folder-name-input"
                        maxLength={255}
                        spellCheck={false}
                        autoComplete="off"
                    />
                </div>
                <div className="file-meta">
                    <span>DIR • Creating...</span>
                </div>
            </div>
        </div>
    );
});

export { InlineFolderEditor };
export default InlineFolderEditor; 