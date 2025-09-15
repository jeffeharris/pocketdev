# DiffViewerModal Refactoring Example

This document demonstrates how to use the new extracted components and hooks to refactor DiffViewerModal from 1,217 lines to ~300 lines.

## New Structure Created

```
components/diff/
├── utils/
│   ├── monaco-config.ts      # Monaco editor configurations
│   └── diff-parser.ts        # Diff parsing utilities
├── hooks/
│   ├── useDiffLoader.ts      # Manages diff loading and caching
│   └── useGitOperations.ts   # Handles staging/unstaging
└── components/
    ├── FileListSection.tsx    # Reusable file list component
    └── DiffEditorWrapper.tsx  # Monaco DiffEditor wrapper
```

## Example: Simplified DiffViewerModal

```tsx
import { useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDiffLoader } from './hooks/useDiffLoader';
import { useGitOperations } from './hooks/useGitOperations';
import { FileListSection } from './components/FileListSection';
import { DiffEditorWrapper } from './components/DiffEditorWrapper';
import { groupFilesByStatus } from '../../utils/diff-utils';

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  taskId,
  taskTitle,
  branch,
  baseBranch = 'main'
}) => {
  const [selectedFile, setSelectedFile] = useState(null);
  const [compareWith, setCompareWith] = useState('working');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState('split');
  
  // Use extracted hooks
  const {
    files,
    loading,
    error,
    loadFileDiff,
    refreshDiff
  } = useDiffLoader({ projectId, taskId, baseBranch, compareWith });
  
  const {
    pendingOperations,
    toggleStaging
  } = useGitOperations({ 
    projectId, 
    taskId,
    onOperationComplete: refreshDiff
  });
  
  // Group files by status
  const groupedFiles = groupFilesByStatus(files);
  
  // Handle file selection
  const handleFileSelect = async (file, index) => {
    setSelectedFile(file);
    if (!file.diff) {
      await loadFileDiff(file, index);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose} />
      
      <div className="absolute inset-4 bg-white rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">{taskTitle}</h2>
            <p className="text-sm text-gray-600">{branch}</p>
          </div>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          {!sidebarCollapsed ? (
            <div className="w-80 border-r overflow-y-auto">
              <FileListSection
                title="Staged"
                files={groupedFiles.staged}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onStageToggle={toggleStaging}
                pendingOperations={pendingOperations}
                showStageCheckbox
              />
              
              <FileListSection
                title="Unstaged"
                files={groupedFiles.unstaged}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
                onStageToggle={toggleStaging}
                pendingOperations={pendingOperations}
                showStageCheckbox
              />
              
              <FileListSection
                title="Untracked"
                files={groupedFiles.untracked}
                selectedFile={selectedFile}
                onFileSelect={handleFileSelect}
              />
            </div>
          ) : (
            <div className="w-12 border-r flex items-center justify-center cursor-pointer"
                 onClick={() => setSidebarCollapsed(false)}>
              <ChevronRight className="w-4 h-4" />
            </div>
          )}
          
          {/* Diff Viewer */}
          <div className="flex-1 overflow-hidden">
            {selectedFile ? (
              <DiffEditorWrapper
                diff={selectedFile.diff}
                filePath={selectedFile.path}
                viewMode={viewMode}
                loading={selectedFile.loading}
                height="100%"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a file to view changes
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
```

## Benefits Achieved

### Before (1,217 lines)
- 37 React hooks in one component
- 9 useEffect hooks
- Duplicate file list rendering 3 times
- Mixed responsibilities (modal, files, diff, git ops, search, etc.)
- Hard to test individual features

### After (~300 lines)
- Only 4-5 hooks in main component
- 1-2 useEffect hooks
- File list rendering extracted to reusable component
- Clear separation of concerns
- Each piece independently testable

## Line Count Breakdown

- **DiffViewerModal.tsx**: ~300 lines (main orchestrator)
- **FileListSection.tsx**: 180 lines (reusable)
- **DiffEditorWrapper.tsx**: 160 lines (reusable)
- **useDiffLoader.ts**: 150 lines (reusable hook)
- **useGitOperations.ts**: 120 lines (reusable hook)
- **monaco-config.ts**: 180 lines (shared config)
- **diff-parser.ts**: 220 lines (utilities)

Total: ~1,310 lines but:
- Much better organized
- Each piece is reusable
- Can be tested independently
- Follows single responsibility principle
- Easier to maintain and modify

## How to Apply to PrototypeMergeConflict

The same components can be reused:

```tsx
import { DiffEditorWrapper } from '../components/diff/components/DiffEditorWrapper';
import { getEditorOptions } from '../components/diff/utils/monaco-config';
import { parseConflictSections } from '../components/diff/utils/diff-parser';

// Use DiffEditorWrapper for the three-way comparison
<DiffEditorWrapper
  original={baseContent}
  modified={currentContent}
  title="Current Changes"
  titleColor="green"
  height="300px"
  viewMode="split"
/>

<DiffEditorWrapper
  original={baseContent}
  modified={incomingContent}
  title="Incoming Changes"
  titleColor="red"
  height="300px"
  viewMode="split"
/>
```

## Next Steps

1. Complete the full refactoring of DiffViewerModal using these components
2. Apply similar patterns to PrototypeMergeConflict
3. Add unit tests for each extracted component
4. Consider further extractions (DiffHeader, DiffSidebar as complete components)