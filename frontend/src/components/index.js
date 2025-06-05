import { lazy } from "preact/compat";

// Core components needed for initial screen - bundled synchronously
export { Breadcrumb } from './Breadcrumb';
export { Sidebar } from './Sidebar';
export { FileItem } from './FileItem';
export { ContextMenu } from './ContextMenu';
export { EmptySpaceContextMenu } from './EmptySpaceContextMenu';
export { RetroDialog } from './RetroDialog';
export { InlineFolderEditor } from './InlineFolderEditor';

// VirtualizedFileList is critical for large directories - bundle synchronously for better performance
export { VirtualizedFileList } from './VirtualizedFileList';

// Only truly non-critical, rarely used components are lazy-loaded
export const InspectMenu = lazy(() => import('./InspectMenu').then(m => ({ default: m.InspectMenu })));
export const PerformanceDashboard = lazy(() => import('./PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard }))); 