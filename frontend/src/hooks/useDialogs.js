import { useState, useCallback } from "preact/hooks";

export function useDialogs() {
    const [dialog, setDialog] = useState({
        isOpen: false,
        type: 'alert',
        title: '',
        message: '',
        defaultValue: '',
        onConfirm: () => {},
        onCancel: () => {},
        metadata: null // Additional metadata for special behaviors
    });

    const showDialog = useCallback((type, title, message, defaultValue = '', onConfirm = () => {}, onCancel = () => {}, metadata = null) => {
        setDialog({
            isOpen: true,
            type,
            title,
            message,
            defaultValue,
            onConfirm: (value) => {
                setDialog(prev => ({ ...prev, isOpen: false }));
                onConfirm(value);
            },
            onCancel: () => {
                setDialog(prev => ({ ...prev, isOpen: false }));
                onCancel();
            },
            metadata
        });
    }, []);

    const closeDialog = useCallback(() => {
        setDialog(prev => ({ ...prev, isOpen: false }));
    }, []);

    return {
        dialog,
        showDialog,
        closeDialog
    };
} 