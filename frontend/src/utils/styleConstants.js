// Pre-compiled style constants for zen minimalist theme
// These styles are computed once at module load time for optimal performance

// Common positioning and layout styles
export const FIXED_POSITION_STYLE = {
    position: 'fixed',
    zIndex: 1000
};

export const CONTEXT_MENU_STYLE = {
    position: 'fixed',
    zIndex: 1000,
    background: 'var(--zen-surface)',
    border: '1px solid var(--zen-border)',
    borderRadius: 'var(--zen-radius-md)',
    boxShadow: 'var(--zen-shadow-lg)',
    minWidth: '200px',
    padding: 'var(--zen-space-sm)',
    backdropFilter: 'blur(16px)',
    WebkitBackdropFilter: 'blur(16px)'
};

export const LOADING_OVERLAY_STYLE = {
    textAlign: 'center',
    padding: 'var(--zen-space-3xl) var(--zen-space-2xl)',
    color: 'var(--zen-text-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--zen-space-lg)'
};

export const EMPTY_DIRECTORY_STYLE = {
    textAlign: 'center',
    padding: 'var(--zen-space-3xl) var(--zen-space-2xl)',
    color: 'var(--zen-text-tertiary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--zen-space-lg)'
};

export const LARGE_ICON_STYLE = {
    fontSize: '3rem',
    marginBottom: 'var(--zen-space-lg)',
    opacity: 0.5
};

export const LOADING_SPINNER_LARGE_STYLE = {
    width: '2rem',
    height: '2rem',
    marginBottom: 'var(--zen-space-lg)',
    border: '2px solid var(--zen-border)',
    borderTop: '2px solid var(--zen-primary)',
    borderRadius: '50%'
};

export const HEADER_STATS_STYLE = {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--zen-space-lg)',
    fontSize: 'var(--zen-text-sm)',
    color: 'var(--zen-text-secondary)'
};

export const PERFORMANCE_INDICATOR_STYLE = {
    fontSize: 'var(--zen-text-xs)',
    opacity: 0.6,
    color: 'var(--zen-text-tertiary)',
    fontWeight: 500
};

export const CURRENT_PATH_INDICATOR_STYLE = {
    fontSize: 'var(--zen-text-sm)',
    opacity: 0.7,
    maxWidth: '200px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    color: 'var(--zen-text-secondary)'
};

export const ERROR_DISMISS_BUTTON_STYLE = {
    marginLeft: 'var(--zen-space-lg)',
    background: 'none',
    border: 'none',
    color: 'inherit',
    textDecoration: 'underline',
    cursor: 'pointer',
    fontSize: 'var(--zen-text-sm)',
    padding: 'var(--zen-space-sm)',
    borderRadius: 'var(--zen-radius-sm)',
    transition: 'all 150ms ease'
};

export const STATUS_BAR_RIGHT_STYLE = {
    marginLeft: 'auto',
    fontSize: 'var(--zen-text-xs)',
    color: 'var(--zen-text-tertiary)'
};

// Animation and transition styles - More zen and subtle
export const TRANSFORM_TRANSITION_STYLE = {
    transition: 'transform 200ms ease-out, opacity 200ms ease-out',
    willChange: 'transform'
};

export const OPACITY_TRANSITION_STYLE = {
    transition: 'opacity 200ms ease-out'
};

// Layout helpers - More spacious
export const FLEX_CENTER_STYLE = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--zen-space-md)'
};

export const FLEX_COLUMN_STYLE = {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--zen-space-md)'
};

export const FLEX_ROW_STYLE = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 'var(--zen-space-md)'
};

// Spacing using zen variables
export const SMALL_MARGIN_STYLE = { margin: 'var(--zen-space-sm)' };
export const MEDIUM_MARGIN_STYLE = { margin: 'var(--zen-space-lg)' };
export const LARGE_MARGIN_STYLE = { margin: 'var(--zen-space-xl)' };

export const SMALL_PADDING_STYLE = { padding: 'var(--zen-space-sm)' };
export const MEDIUM_PADDING_STYLE = { padding: 'var(--zen-space-lg)' };
export const LARGE_PADDING_STYLE = { padding: 'var(--zen-space-xl)' };

// Text styles - More refined typography
export const MONOSPACE_STYLE = {
    fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', monospace",
    fontSize: 'var(--zen-text-sm)',
    lineHeight: 1.5
};

export const TECHNICAL_TEXT_STYLE = {
    fontFamily: "inherit",
    fontSize: 'var(--zen-text-xs)',
    opacity: 0.8,
    color: 'var(--zen-text-tertiary)',
    fontWeight: 500
};

// Hidden/disabled styles
export const HIDDEN_STYLE = { display: 'none' };
export const INVISIBLE_STYLE = { visibility: 'hidden' };
export const DISABLED_STYLE = { 
    opacity: 0.5, 
    pointerEvents: 'none' 
};

// Drag and drop styles - More zen
export const DRAG_OVER_STYLE = {
    background: 'var(--zen-primary-alpha-hover)',
    borderColor: 'var(--zen-primary)',
    transform: 'scale(1.02)',
    boxShadow: 'var(--zen-shadow-md)'
};

export const DRAG_PREVIEW_STYLE = {
    opacity: 0.6,
    transform: 'rotate(-2deg) scale(0.95)',
    filter: 'none'
};

// File item styles - Refined and spacious
export const FILE_ITEM_SELECTED_STYLE = {
    background: 'var(--zen-primary-alpha)',
    borderColor: 'var(--zen-primary)',
    color: 'var(--zen-primary)',
    transform: 'translateY(-1px)',
    boxShadow: 'var(--zen-shadow)'
};

export const FILE_ITEM_CUT_STYLE = {
    opacity: 0.6,
    filter: 'grayscale(30%)',
    borderStyle: 'dashed'
}; 