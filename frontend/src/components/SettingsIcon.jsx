import { memo } from "preact/compat";
import { GearIcon } from '@phosphor-icons/react';

// Neobrutalism-styled Settings Icon Component
export const SettingsIcon = memo(({ size = 20, className = "", onClick }) => {
    return (
        <button
            className={`settings-icon-button ${className}`}
            onClick={onClick}
            aria-label="Settings"
            title="Settings"
        >
            <GearIcon size={size} weight="bold" />
        </button>
    );
});

SettingsIcon.displayName = "SettingsIcon"; 