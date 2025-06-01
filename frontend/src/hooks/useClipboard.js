import { useState, useCallback } from "preact/hooks";

export const useClipboard = () => {
    const [clipboardFiles, setClipboardFiles] = useState([]);
    const [clipboardOperation, setClipboardOperation] = useState(''); // 'copy' or 'cut'

    const handleCopy = useCallback((filePaths) => {
        setClipboardFiles(filePaths);
        setClipboardOperation('copy');
        
        console.log('📋 Copied to clipboard:', filePaths);
        console.log(`📄 ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} copied`);
    }, []);

    const handleCut = useCallback((filePaths) => {
        setClipboardFiles(filePaths);
        setClipboardOperation('cut');
        
        console.log('✂️ Cut to clipboard:', filePaths);
        console.log(`✂️ ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} cut`);
    }, []);

    const clearClipboard = useCallback(() => {
        setClipboardFiles([]);
        setClipboardOperation('');
    }, []);

    const isPasteAvailable = useCallback(() => {
        return clipboardFiles.length > 0 && clipboardOperation !== '';
    }, [clipboardFiles.length, clipboardOperation]);

    return {
        clipboardFiles,
        clipboardOperation,
        handleCopy,
        handleCut,
        clearClipboard,
        isPasteAvailable
    };
}; 