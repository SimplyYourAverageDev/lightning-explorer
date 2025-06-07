import { useState, useCallback } from "preact/hooks";
import { CopyFilePathsToClipboard } from "../../wailsjs/go/backend/App";

export const useClipboard = () => {
    const [clipboardFiles, setClipboardFiles] = useState([]);
    const [clipboardOperation, setClipboardOperation] = useState(''); // 'copy' or 'cut'

    const handleCopy = useCallback((filePaths) => {
        setClipboardFiles(filePaths);
        setClipboardOperation('copy');
        CopyFilePathsToClipboard(filePaths).then(success => {
            if (!success) {
                console.warn("⚠️ Lightning Explorer: failed to set OS clipboard with file list");
            }
        }).catch(err => {
            console.warn("⚠️ Lightning Explorer: error setting OS clipboard:", err);
        });
        console.log('📋 Copied to internal & OS clipboard:', filePaths);
        console.log(`📄 ${filePaths.length} item${filePaths.length === 1 ? '' : 's'} copied`);
    }, []);

    const handleCut = useCallback((filePaths) => {
        setClipboardFiles(filePaths);
        setClipboardOperation('cut');
        CopyFilePathsToClipboard(filePaths).then(success => {
            if (!success) {
                console.warn("⚠️ Lightning Explorer: failed to set OS clipboard with file list");
            }
        }).catch(err => {
            console.warn("⚠️ Lightning Explorer: error setting OS clipboard:", err);
        });
        console.log('✂️ Cut to internal & OS clipboard:', filePaths);
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