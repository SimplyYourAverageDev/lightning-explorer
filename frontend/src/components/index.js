import { lazy } from "preact/compat";

// Core components needed for initial screen - bundled synchronously
export { Breadcrumb } from './Breadcrumb';
export { Sidebar } from './Sidebar';
export { FileItem } from './FileItem';

// Components that are not immediately visible are lazy-loaded
export const ContextMenu = lazy(() => import('./ContextMenu').then(m => ({ default: m.ContextMenu })));
export const EmptySpaceContextMenu = lazy(() => import('./EmptySpaceContextMenu').then(m => ({ default: m.EmptySpaceContextMenu })));
export const DriveContextMenu = lazy(() => import('./DriveContextMenu').then(m => ({ default: m.DriveContextMenu })));
export const RetroDialog = lazy(() => import('./RetroDialog').then(m => ({ default: m.RetroDialog })));

// VirtualizedFileList is critical for large directories - bundle synchronously for better performance

// Only truly non-critical, rarely used components are lazy-loaded
export const InspectMenu = lazy(() => import('./InspectMenu').then(m => ({ default: m.InspectMenu })));

// StreamingVirtualizedFileList is critical for the main view – bundle synchronously to avoid Suspense flashes
export { StreamingVirtualizedFileList } from './StreamingVirtualizedFileList';

// App shell components (synchronous)
export { HeaderBar } from './HeaderBar';
export { ExplorerToolbar } from './ExplorerToolbar';
export { ExplorerStatusBar } from './ExplorerStatusBar';

// Settings components (lazy-loaded since they're not immediately visible)
export { SettingsIcon } from './SettingsIcon';
export const SettingsModal = lazy(() => import('./SettingsModal').then(m => ({ default: m.SettingsModal }))); 