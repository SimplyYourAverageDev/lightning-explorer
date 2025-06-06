import { lazy } from "preact/compat";

// Core components needed for initial screen - bundled synchronously
export { Breadcrumb } from './Breadcrumb';
export { Sidebar } from './Sidebar';
export { FileItem } from './FileItem';

// Components that are not immediately visible are lazy-loaded
export const ContextMenu = lazy(() => import('./ContextMenu').then(m => ({ default: m.ContextMenu })));
export const EmptySpaceContextMenu = lazy(() => import('./EmptySpaceContextMenu').then(m => ({ default: m.EmptySpaceContextMenu })));
export const RetroDialog = lazy(() => import('./RetroDialog').then(m => ({ default: m.RetroDialog })));
export const InlineFolderEditor = lazy(() => import('./InlineFolderEditor').then(m => ({ default: m.InlineFolderEditor })));

// VirtualizedFileList is critical for large directories - bundle synchronously for better performance
export { VirtualizedFileList } from './VirtualizedFileList';

// Only truly non-critical, rarely used components are lazy-loaded
export const InspectMenu = lazy(() => import('./InspectMenu').then(m => ({ default: m.InspectMenu })));
export const PerformanceDashboard = lazy(() => import('./PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard }))); 