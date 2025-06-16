import { useState, useEffect, useRef } from "preact/hooks";
import { memo } from "preact/compat";
import { CaretDownIcon, CaretUpIcon, SpinnerIcon } from '@phosphor-icons/react';

// A custom, theme-consistent toggle switch
const BrutalToggle = ({ checked, onChange, disabled }) => (
    <label className="brut-toggle">
        <input type="checkbox" checked={checked} onChange={onChange} disabled={disabled} />
        <div className="brut-toggle-track">
            <div className="brut-toggle-thumb" />
        </div>
    </label>
);

// A custom, theme-consistent select dropdown
const BrutalSelect = ({ value, onChange, options, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const wrapperRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div className="brut-select-wrapper" ref={wrapperRef}>
            <button className="brut-select-trigger" onClick={() => setIsOpen(p => !p)} disabled={disabled}>
                <span>{value}</span>
                {isOpen ? <CaretUpIcon size={16} weight="bold" /> : <CaretDownIcon size={16} weight="bold" />}
            </button>
            {isOpen && (
                <div className="brut-select-options">
                    {options.map(option => (
                        <div
                            key={option.value}
                            className={`brut-select-option ${value === option.value ? 'selected' : ''}`}
                            onClick={() => handleSelect(option.value)}
                        >
                            {option.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


export const SettingsModal = memo(({ isOpen, onClose, onSave }) => {
    const [settings, setSettings] = useState({
        backgroundStartup: true,
        theme: "system",
        showHiddenFiles: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Load settings when modal opens
    useEffect(() => {
        if (isOpen) {
            loadSettings();
        }
    }, [isOpen]);

    const loadSettings = async () => {
        try {
            setLoading(true);
            setError("");
            const { GetSettings } = await import('../../wailsjs/go/backend/App');
            const currentSettings = await GetSettings();
            setSettings(currentSettings);
        } catch (err) {
            console.error('Failed to load settings:', err);
            setError('Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            setError("");
            const { SaveSettings } = await import('../../wailsjs/go/backend/App');
            await SaveSettings(settings);
            
            if (onSave) {
                onSave(settings);
            }
            
            onClose();
        } catch (err) {
            console.error('Failed to save settings:', err);
            setError('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({ ...prev, [key]: value }));
    };

    if (!isOpen) return null;

    return (
        <div className="brut-modal-overlay" onClick={onClose}>
            <div className="brut-modal" onClick={(e) => e.stopPropagation()}>
                <div className="brut-modal-header">
                    <h2 className="brut-modal-title">Settings</h2>
                    <button 
                        className="brut-modal-close"
                        onClick={onClose}
                        aria-label="Close settings"
                    >
                        ✕
                    </button>
                </div>

                <div className="brut-modal-content">
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                           <SpinnerIcon size={32} className="spinning" />
                        </div>
                    ) : (
                        <>
                            {error && <div className="error-notification-message">{error}</div>}

                            <div className="settings-section">
                                <h3 className="settings-section-title">Startup</h3>
                                <div className="settings-item">
                                    <div className="settings-item-info">
                                        <label className="settings-label">Background Startup</label>
                                        <p className="settings-description">
                                            Keep Lightning Explorer running in the background for instant startup. 
                                            When enabled, closing the window will hide it instead of quitting.
                                        </p>
                                    </div>
                                    <BrutalToggle
                                        checked={settings.backgroundStartup}
                                        onChange={(e) => handleSettingChange('backgroundStartup', e.target.checked)}
                                        disabled={saving}
                                    />
                                </div>
                            </div>

                            <div className="settings-section">
                                <h3 className="settings-section-title">Appearance</h3>
                                <div className="settings-item">
                                    <div className="settings-item-info">
                                        <label className="settings-label">Theme</label>
                                        <p className="settings-description">
                                            Choose your preferred theme. Requires app restart to apply fully.
                                        </p>
                                    </div>
                                    <BrutalSelect
                                        value={settings.theme}
                                        onChange={(value) => handleSettingChange('theme', value)}
                                        options={[
                                            { value: 'system', label: 'System' },
                                            { value: 'light', label: 'Light' },
                                            { value: 'dark', label: 'Dark' }
                                        ]}
                                        disabled={saving}
                                    />
                                </div>
                                <div className="settings-item">
                                    <div className="settings-item-info">
                                        <label className="settings-label">Show Hidden Files</label>
                                        <p className="settings-description">
                                            Show hidden files and folders by default across all directories.
                                        </p>
                                    </div>
                                    <BrutalToggle
                                        checked={settings.showHiddenFiles}
                                        onChange={(e) => handleSettingChange('showHiddenFiles', e.target.checked)}
                                        disabled={saving}
                                    />
                                </div>
                            </div>
                        </>
                    )}
                </div>

                <div className="brut-modal-footer">
                    <button 
                        className="brut-btn secondary"
                        onClick={onClose}
                        disabled={saving}
                    >
                        Cancel
                    </button>
                    <button 
                        className="brut-btn primary"
                        onClick={handleSave}
                        disabled={loading || saving}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </div>
        </div>
    );
});

SettingsModal.displayName = "SettingsModal";