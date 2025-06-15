import { useState, useCallback } from "preact/hooks";

export function useDriveContextMenu(showDialog, showErrorNotification, onDriveEjected = null) {
    // Drive context menu state
    const [driveContextMenu, setDriveContextMenu] = useState({ 
        visible: false, 
        x: 0, 
        y: 0, 
        drive: null 
    });

    // Handle drive context menu
    const handleDriveContextMenu = useCallback((event, drive) => {
        event.preventDefault();
        event.stopPropagation();
        
        setDriveContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            drive: drive
        });
        
        return true;
    }, []);

    // Close drive context menu
    const closeDriveContextMenu = useCallback(() => {
        setDriveContextMenu({ visible: false, x: 0, y: 0, drive: null });
    }, []);

    // Handle drive eject
    const handleDriveEject = useCallback(async () => {
        if (!driveContextMenu.drive) return;
        
        const drive = driveContextMenu.drive;
        closeDriveContextMenu();
        
        // Show confirmation dialog
        showDialog(
            'confirm',
            'EJECT DRIVE',
            `Safely eject "${drive.name}"?\n\nMake sure no programs are using files on this drive.`,
            '',
            async () => {
                try {
                    // Dynamically import the backend API
                    const { EjectDrive } = await import('../../wailsjs/go/backend/App');
                    const success = await EjectDrive(drive.path);
                    
                    if (success) {
                        // Show success notification
                        showErrorNotification(`Successfully ejected ${drive.name}. It is now safe to remove the drive.`, null, true);
                        if (onDriveEjected) {
                            onDriveEjected(drive);
                        }
                    } else {
                        showErrorNotification(`Failed to eject ${drive.name}. Make sure no programs are using the drive.`, null, false);
                    }
                } catch (err) {
                    console.error('❌ Error ejecting drive:', err);
                    showErrorNotification(`Error ejecting ${drive.name}: ${err.message}`, null, false);
                }
            }
        );
    }, [driveContextMenu.drive, closeDriveContextMenu, showDialog, showErrorNotification, onDriveEjected]);

    // Handle open drive in explorer
    const handleDriveOpenInExplorer = useCallback(async () => {
        if (!driveContextMenu.drive) return;
        
        const drive = driveContextMenu.drive;
        closeDriveContextMenu();
        
        try {
            // Dynamically import the backend API
            const { OpenInSystemExplorer } = await import('../../wailsjs/go/backend/App');
            await OpenInSystemExplorer(drive.path);
        } catch (err) {
            console.error('❌ Error opening drive in explorer:', err);
            showErrorNotification(`Error opening ${drive.name} in explorer: ${err.message}`, null, true);
        }
    }, [driveContextMenu.drive, closeDriveContextMenu, showErrorNotification]);

    // Handle drive properties
    const handleDriveProperties = useCallback(async () => {
        if (!driveContextMenu.drive) return;
        
        const drive = driveContextMenu.drive;
        closeDriveContextMenu();
        
        try {
            // Dynamically import the backend API
            const { ShowDriveProperties } = await import('../../wailsjs/go/backend/App');
            await ShowDriveProperties(drive.path);
        } catch (err) {
            console.error('❌ Error showing drive properties:', err);
            // For now, just show a simple info dialog as fallback
            showDialog(
                'info',
                'DRIVE PROPERTIES',
                `Drive: ${drive.name}\nPath: ${drive.path}\nLetter: ${drive.letter}`,
                '',
                null
            );
        }
    }, [driveContextMenu.drive, closeDriveContextMenu, showDialog, showErrorNotification]);

    return {
        driveContextMenu,
        handleDriveContextMenu,
        closeDriveContextMenu,
        handleDriveEject,
        handleDriveOpenInExplorer,
        handleDriveProperties
    };
} 