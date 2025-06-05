import { Suspense } from "preact/compat";
import {
    Breadcrumb,
    Sidebar,
    FileItem,
    ContextMenu,
    EmptySpaceContextMenu,
    RetroDialog,
    VirtualizedFileList,
    InlineFolderEditor,
    InspectMenu,
    PerformanceDashboard
} from "../components";
import {
    HEADER_STATS_STYLE,
    PERFORMANCE_INDICATOR_STYLE,
    ERROR_DISMISS_BUTTON_STYLE,
    STATUS_BAR_RIGHT_STYLE,
    LOADING_OVERLAY_STYLE,
    LARGE_ICON_STYLE,
    LOADING_SPINNER_LARGE_STYLE,
    EMPTY_DIRECTORY_STYLE
} from "../utils/styleConstants";

// Header Component
export const AppHeader = ({ 
    isInspectMode, 
    showLoadingIndicator, 
    directoryContents, 
    fileUtilsModule, 
    filteredDirectories, 
    filteredFiles, 
    showHiddenFiles, 
    selectedFiles, 
    isAppInitialized, 
    navigationStats 
}) => (
    <header className="app-header">
        <div className="app-title">
            Files
            {isInspectMode && (
                <span className="inspect-mode-indicator" style={{
                    marginLeft: '1rem',
                    padding: '0.25rem 0.5rem',
                    background: '#ff6b35',
                    color: 'white',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 'bold'
                }}>
                    🔍 INSPECT MODE (F7)
                </span>
            )}
        </div>
        <div style={HEADER_STATS_STYLE}>
            {showLoadingIndicator && <div className="loading-spinner"></div>}
            <span className="text-technical">
                {directoryContents && fileUtilsModule ? 
                    `${filteredDirectories.length} dirs • ${filteredFiles.length} files${!showHiddenFiles ? ' (hidden filtered)' : ''}${selectedFiles.size > 0 ? ` • ${selectedFiles.size} selected` : ''}` : 
                    (isAppInitialized ? 'Loading...' : 'Ready')
                }
            </span>
            {navigationStats.totalNavigations > 0 && (
                <span className="text-technical" style={PERFORMANCE_INDICATOR_STYLE}>
                    {navigationStats.lastNavigationTime === 0 ? 
                        'Measuring...' : 
                        `${Math.round(navigationStats.lastNavigationTime)}ms fresh data`
                    }
                    {` (${navigationStats.totalNavigations} real-time loads)`}
                </span>
            )}
        </div>
    </header>
);

// Error Display Component
export const ErrorDisplay = ({ error, setError }) => (
    error && (
        <div className="error-message">
            <strong>⚠️ Error:</strong> {error}
            <button onClick={() => setError('')} style={ERROR_DISMISS_BUTTON_STYLE}>
                Dismiss
            </button>
        </div>
    )
);

// Toolbar Component
export const Toolbar = ({ 
    handleNavigateUp, 
    currentPath, 
    handleRefresh, 
    handleOpenInExplorer, 
    showHiddenFiles, 
    setShowHiddenFiles 
}) => (
    <div className="toolbar">
        <button className="toolbar-btn" onClick={handleNavigateUp} disabled={!currentPath}>
            ⬆️ Up
        </button>
        <button className="toolbar-btn" onClick={handleRefresh} disabled={!currentPath}>
            🔄 Refresh
        </button>
        <button className="toolbar-btn" onClick={handleOpenInExplorer} disabled={!currentPath}>
            🖥️ Open in Explorer
        </button>
        <button 
            className={`toolbar-btn ${showHiddenFiles ? 'active' : ''}`}
            onClick={() => setShowHiddenFiles(!showHiddenFiles)}
        >
            {showHiddenFiles ? '👁️' : '🙈'} Hidden
        </button>
    </div>
);

// File List Content Component
export const FileListContent = ({
    showLoadingIndicator,
    directoryContents,
    fileUtilsModule,
    allFiles,
    selectedFiles,
    handleFileSelect,
    handleFileOpen,
    handleContextMenu,
    clipboardFiles,
    clipboardOperation,
    dragState,
    handleDragStart,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    handleDrop,
    creatingFolder,
    tempFolderName,
    editInputRef,
    handleKeyDown,
    handleInputChange,
    handleInputBlur,
    handleEmptySpaceContextMenu,
    isInspectMode,
    isAppInitialized,
    closeContextMenu,
    closeEmptySpaceContextMenu
}) => {
    if (showLoadingIndicator) {
        return (
            <div className="loading-overlay">
                <div style={LOADING_OVERLAY_STYLE}>
                    <div className="loading-spinner" style={LOADING_SPINNER_LARGE_STYLE}></div>
                    <div className="text-technical">Loading directory...</div>
                </div>
            </div>
        );
    }

    if (!directoryContents || !fileUtilsModule) {
        return (
            <div style={EMPTY_DIRECTORY_STYLE}>
                <div style={LARGE_ICON_STYLE}>📁</div>
                <div className="text-technical">
                    {isAppInitialized ? 'Loading...' : 'Ready'}
                </div>
            </div>
        );
    }

    if (allFiles.length > 20) {
        return (
            <Suspense fallback={
                <div className="loading-overlay">
                    <div style={LOADING_OVERLAY_STYLE}>
                        <div className="loading-spinner" style={LOADING_SPINNER_LARGE_STYLE}></div>
                        <div className="text-technical">Loading file list...</div>
                    </div>
                </div>
            }>
                <VirtualizedFileList
                    files={allFiles}
                    selectedFiles={selectedFiles}
                    onFileSelect={handleFileSelect}
                    onFileOpen={handleFileOpen}
                    onContextMenu={handleContextMenu}
                    isLoading={false}
                    clipboardFiles={clipboardFiles}
                    clipboardOperation={clipboardOperation}
                    dragState={dragState}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    creatingFolder={creatingFolder}
                    tempFolderName={tempFolderName}
                    editInputRef={editInputRef}
                    onFolderKeyDown={handleKeyDown}
                    onFolderInputChange={handleInputChange}
                    onFolderInputBlur={handleInputBlur}
                    onEmptySpaceContextMenu={handleEmptySpaceContextMenu}
                    isInspectMode={isInspectMode}
                />
            </Suspense>
        );
    }

    return (
        <div 
            className="file-list custom-scrollbar"
            onContextMenu={(e) => {
                if (e.target === e.currentTarget || !e.target.closest('.file-item')) {
                    e.preventDefault();
                    closeContextMenu();
                    closeEmptySpaceContextMenu();
                    handleEmptySpaceContextMenu(e);
                }
            }}
        >
            {creatingFolder && (
                <InlineFolderEditor
                    tempFolderName={tempFolderName}
                    editInputRef={editInputRef}
                    onKeyDown={handleKeyDown}
                    onChange={handleInputChange}
                    onBlur={handleInputBlur}
                />
            )}
            
            {allFiles.map((file, index) => (
                <FileItem
                    key={file.path}
                    file={file}
                    fileIndex={index}
                    onSelect={handleFileSelect}
                    onOpen={handleFileOpen}
                    onContextMenu={handleContextMenu}
                    isLoading={false}
                    isSelected={selectedFiles.has(index)}
                    isCut={clipboardOperation === 'cut' && clipboardFiles.includes(file.path)}
                    isDragOver={dragState.dragOverFolder === file.path}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    isInspectMode={isInspectMode}
                />
            ))}
            
            {allFiles.length === 0 && !creatingFolder && (
                <div style={EMPTY_DIRECTORY_STYLE}>
                    <div style={LARGE_ICON_STYLE}>📁</div>
                    <div className="text-technical">Directory is empty</div>
                </div>
            )}
        </div>
    );
};

// Status Bar Component
export const StatusBar = ({ 
    currentPath, 
    selectedFiles, 
    clipboardFiles, 
    clipboardOperation, 
    dragState 
}) => (
    <div className="status-bar">
        <span>
            Path: {currentPath || 'Not selected'} 
            {selectedFiles.size > 0 && ` • ${selectedFiles.size} item${selectedFiles.size === 1 ? '' : 's'} selected`}
            {clipboardFiles.length > 0 && ` • ${clipboardFiles.length} item${clipboardFiles.length === 1 ? '' : 's'} ${clipboardOperation === 'cut' ? 'cut' : 'copied'}`}
            {dragState.isDragging && ` • Dragging ${dragState.draggedFiles.length} item${dragState.draggedFiles.length === 1 ? '' : 's'} (${dragState.dragOperation === 'copy' ? 'Hold Ctrl to copy' : 'Release Ctrl to move'})`}
        </span>
        <span style={STATUS_BAR_RIGHT_STYLE}>
            Lightning Explorer • Real-time updates • Internal drag & drop • Drag to folders to move/copy
        </span>
    </div>
);

// Context Menus and Dialogs Component
export const ContextMenusAndDialogs = ({
    contextMenu,
    closeContextMenu,
    handleContextCopy,
    handleContextCut,
    handleContextRename,
    handleContextHide,
    handlePermanentDelete,
    emptySpaceContextMenu,
    closeEmptySpaceContextMenu,
    handleOpenPowerShell,
    handleCreateFolder,
    dialog,
    closeDialog,
    inspectMenu,
    closeInspectMenu,
    benchmarkResults,
    navigationStats,
    serializationMode
}) => (
    <>
        <ContextMenu
            visible={contextMenu.visible}
            x={contextMenu.x}
            y={contextMenu.y}
            files={contextMenu.files}
            onClose={closeContextMenu}
            onCopy={handleContextCopy}
            onCut={handleContextCut}
            onRename={handleContextRename}
            onHide={handleContextHide}
            onPermanentDelete={handlePermanentDelete}
        />
        
        <EmptySpaceContextMenu
            visible={emptySpaceContextMenu.visible}
            x={emptySpaceContextMenu.x}
            y={emptySpaceContextMenu.y}
            onClose={closeEmptySpaceContextMenu}
            onOpenPowerShell={handleOpenPowerShell}
            onCreateFolder={handleCreateFolder}
        />
        
        <RetroDialog
            isOpen={dialog.isOpen}
            type={dialog.type}
            title={dialog.title}
            message={dialog.message}
            defaultValue={dialog.defaultValue}
            onConfirm={dialog.onConfirm}
            onCancel={dialog.onCancel}
            onClose={closeDialog}
        />
        
        <InspectMenu
            visible={inspectMenu.visible}
            x={inspectMenu.x}
            y={inspectMenu.y}
            element={inspectMenu.element}
            onClose={closeInspectMenu}
        />
        
        <Suspense fallback={null}>
            <PerformanceDashboard
                benchmarkResults={benchmarkResults}
                navigationStats={navigationStats}
                serializationMode={serializationMode}
            />
        </Suspense>
    </>
); 