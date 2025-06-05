import { lazy } from "preact/compat";

// Component exports for cleaner imports
export { Breadcrumb } from './Breadcrumb';
export { Sidebar } from './Sidebar';
export { FileItem } from './FileItem';
export { ContextMenu } from './ContextMenu';
export { EmptySpaceContextMenu } from './EmptySpaceContextMenu';
export { RetroDialog } from './RetroDialog';
export { InlineFolderEditor } from './InlineFolderEditor';
export { InspectMenu } from './InspectMenu';

// Lazy-loaded heavy components for better startup performance
export const VirtualizedFileList = lazy(() => import('./VirtualizedFileList').then(m => ({ default: m.VirtualizedFileList })));

// Performance Dashboard is also heavy and rarely used immediately
export const PerformanceDashboard = lazy(() => import('./PerformanceDashboard').then(m => ({ default: m.PerformanceDashboard }))); 