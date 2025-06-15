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

// StreamingVirtualizedFileList is large but can still be code-split; initial mount will trigger Suspense fallback briefly.
export const StreamingVirtualizedFileList = lazy(() => import('./StreamingVirtualizedFileList').then(m => ({ default: m.StreamingVirtualizedFileList }))); 

// App shell components (synchronous)
export { HeaderBar } from './HeaderBar';
export { ExplorerToolbar } from './ExplorerToolbar';
export { ExplorerStatusBar } from './ExplorerStatusBar'; 