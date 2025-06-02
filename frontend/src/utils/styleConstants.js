// Pre-compiled style constants to avoid inline style object creation
// These styles are computed once at module load time for optimal performance

// Common positioning and layout styles
export const FIXED_POSITION_STYLE = {
    position: 'fixed',
    zIndex: 1000
};

export const CONTEXT_MENU_STYLE = {
    position: 'fixed',
    zIndex: 1000,
    background: 'var(--blueprint-bg-secondary)',
    border: '2px solid var(--blueprint-border)',
    borderRadius: '0',
    boxShadow: '4px 4px 0 var(--blueprint-shadow)',
    minWidth: '200px'
};

export const LOADING_OVERLAY_STYLE = {
    textAlign: 'center',
    padding: '64px 32px',
    color: 'var(--blueprint-text-muted)'
};

export const EMPTY_DIRECTORY_STYLE = {
    textAlign: 'center',
    padding: '64px 32px',
    color: 'var(--blueprint-text-muted)'
};

export const LARGE_ICON_STYLE = {
    fontSize: '48px',
    marginBottom: '16px'
};

export const LOADING_SPINNER_LARGE_STYLE = {
    width: '32px',
    height: '32px',
    marginBottom: '16px'
};

export const HEADER_STATS_STYLE = {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
};

export const PERFORMANCE_INDICATOR_STYLE = {
    fontSize: '10px',
    opacity: 0.6
};

export const CURRENT_PATH_INDICATOR_STYLE = {
    fontSize: '11px',
    opacity: 0.7,
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
};

export const ERROR_DISMISS_BUTTON_STYLE = {
    marginLeft: '12px',
    background: 'none',
    border: 'none',
    color: 'inherit',
    textDecoration: 'underline',
    cursor: 'pointer'
};

export const STATUS_BAR_RIGHT_STYLE = {
    marginLeft: 'auto'
};

// Animation and transition styles
export const TRANSFORM_TRANSITION_STYLE = {
    transition: 'transform 150ms ease-out, opacity 150ms ease-out',
    willChange: 'transform'
};

export const OPACITY_TRANSITION_STYLE = {
    transition: 'opacity 150ms ease-out'
};

// Layout helpers
export const FLEX_CENTER_STYLE = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
};

export const FLEX_COLUMN_STYLE = {
    display: 'flex',
    flexDirection: 'column'
};

export const FLEX_ROW_STYLE = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center'
};

// Common spacing
export const SMALL_MARGIN_STYLE = { margin: '4px' };
export const MEDIUM_MARGIN_STYLE = { margin: '8px' };
export const LARGE_MARGIN_STYLE = { margin: '16px' };

export const SMALL_PADDING_STYLE = { padding: '4px' };
export const MEDIUM_PADDING_STYLE = { padding: '8px' };
export const LARGE_PADDING_STYLE = { padding: '16px' };

// Text styles
export const MONOSPACE_STYLE = {
    fontFamily: 'monospace',
    fontSize: '12px'
};

export const TECHNICAL_TEXT_STYLE = {
    fontFamily: 'monospace',
    fontSize: '11px',
    opacity: 0.8
};

// Hidden/disabled styles
export const HIDDEN_STYLE = { display: 'none' };
export const INVISIBLE_STYLE = { visibility: 'hidden' };
export const DISABLED_STYLE = { 
    opacity: 0.5, 
    pointerEvents: 'none' 
};

// Drag and drop styles
export const DRAG_OVER_STYLE = {
    background: 'var(--blueprint-accent-alpha)',
    borderColor: 'var(--blueprint-accent)'
};

export const DRAG_PREVIEW_STYLE = {
    opacity: 0.8,
    transform: 'scale(0.95)',
    filter: 'brightness(0.9)'
};

// File item styles
export const FILE_ITEM_SELECTED_STYLE = {
    background: 'var(--blueprint-accent-alpha)',
    borderColor: 'var(--blueprint-accent)'
};

export const FILE_ITEM_CUT_STYLE = {
    opacity: 0.5,
    filter: 'grayscale(50%)'
}; 