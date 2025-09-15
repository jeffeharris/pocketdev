/**
 * DiffViewerModal - Refactored version using extracted components
 * 
 * This modal provides a comprehensive diff viewer with file list sidebar
 * and Monaco-based diff editor. Refactored from 1,217 lines to ~400 lines
 * using extracted hooks and components.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, FileText, ChevronLeft, ChevronRight, Loader2, Search, Columns2 } from 'lucide-react';
import { clsx } from 'clsx';
import { useDiffLoader } from './hooks/useDiffLoader';
import { useGitOperations } from './hooks/useGitOperations';
import { FileListSection, type FileListSectionRef } from './components/FileListSection';
import { DiffEditorWrapper } from './components/DiffEditorWrapper';
import { ThreeStateToggle, type ToggleOption } from './ThreeStateToggle';
import { SearchInput } from './SearchInput';
import { parseDiffToCode } from './utils/diff-parser';
import { groupFilesByStatus, filterFilesBySearch, shouldShowSearch } from '../../utils/diff-utils';
import { useShortcutContext, useKeyboardShortcut } from '../../hooks/keyboard';
import type { DiffFile } from '../../types/diff';

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string;
  taskTitle: string;
  branch: string;
  baseBranch?: string;
}

export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  taskId,
  taskTitle,
  branch,
  baseBranch = 'main'
}) => {
  // State management
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compareWith, setCompareWith] = useState<ToggleOption>('working');
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [originalCode, setOriginalCode] = useState('');
  const [modifiedCode, setModifiedCode] = useState('');
  
  // Refs for managing file navigation
  const fileListRefs = useRef<{
    staged: FileListSectionRef | null;
    unstaged: FileListSectionRef | null;
    untracked: FileListSectionRef | null;
  }>({
    staged: null,
    unstaged: null,
    untracked: null
  });
  
  // Use extracted hooks
  const {
    files,
    loading,
    error,
    hasWorkingChanges,
    loadFileDiff,
    refreshDiff
  } = useDiffLoader({
    projectId,
    taskId,
    baseBranch,
    compareWith: compareWith as 'working' | 'all' | 'base'
  });
  
  const {
    pendingOperations,
    toggleStaging
  } = useGitOperations({
    projectId,
    taskId,
    onOperationComplete: refreshDiff
  });
  
  // Filter files based on search
  const filteredFiles = filterFilesBySearch(files, searchTerm);
  
  // Group files by status
  const groupedFiles = groupFilesByStatus(filteredFiles);
  
  // Get comparison labels
  const getComparisonLabels = () => {
    const currentBranch = branch.split('/').pop() || branch;
    const base = `origin/${baseBranch}`;
    
    switch (compareWith) {
      case 'working':
        return {
          left: 'HEAD',
          right: 'Working Tree',
          description: 'Uncommitted changes'
        };
      case 'all':
        return {
          left: base,
          right: currentBranch,
          description: 'All changes from base branch'
        };
      case 'base':
        return {
          left: base,
          right: 'HEAD',
          description: 'Committed changes only'
        };
      default:
        return { left: '', right: '', description: '' };
    }
  };
  
  // Handle file selection
  const handleFileSelect = useCallback(async (file: DiffFile, index: number) => {
    setSelectedFile(file);
    setSelectedFileIndex(index);
    
    // Load diff if not already loaded
    if (!file.diff && !file.loading) {
      await loadFileDiff(file, index);
    }
    
    // Parse diff for display
    if (file.diff) {
      const { original, modified } = parseDiffToCode(file.diff);
      setOriginalCode(original);
      setModifiedCode(modified);
    }
  }, [loadFileDiff]);
  
  // Navigate between files
  const navigateFiles = useCallback((direction: 'next' | 'prev') => {
    if (filteredFiles.length === 0) return;
    
    let newIndex = selectedFileIndex;
    if (direction === 'next') {
      newIndex = (selectedFileIndex + 1) % filteredFiles.length;
    } else {
      newIndex = selectedFileIndex === 0 ? filteredFiles.length - 1 : selectedFileIndex - 1;
    }
    
    const newFile = filteredFiles[newIndex];
    if (newFile) {
      handleFileSelect(newFile, newIndex);
      
      // Scroll to file in sidebar
      const category = newFile.staged ? 'staged' : 
                      newFile.unstaged ? 'unstaged' : 
                      'untracked';
      fileListRefs.current[category]?.scrollToFile(newFile.path);
    }
  }, [selectedFileIndex, filteredFiles, handleFileSelect]);
  
  // Auto-show search for many files
  useEffect(() => {
    if (shouldShowSearch(files.length) && !showSearch) {
      setShowSearch(true);
    }
  }, [files.length, showSearch]);
  
  // Select first file when files load
  useEffect(() => {
    if (files.length > 0 && !selectedFile) {
      handleFileSelect(files[0], 0);
    }
  }, [files, selectedFile, handleFileSelect]);
  
  // Keyboard shortcuts
  useShortcutContext(isOpen ? 'diff-viewer' : null);
  
  useKeyboardShortcut('j', () => navigateFiles('next'), 'diff-viewer');
  useKeyboardShortcut('k', () => navigateFiles('prev'), 'diff-viewer');
  useKeyboardShortcut('/', () => setShowSearch(true), 'diff-viewer');
  useKeyboardShortcut('Escape', () => {
    if (showSearch && searchTerm === '') {
      setShowSearch(false);
    } else if (searchTerm) {
      setSearchTerm('');
    } else {
      onClose();
    }
  }, 'diff-viewer');
  
  if (!isOpen) return null;
  
  const labels = getComparisonLabels();
  
  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50" 
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="absolute inset-4 bg-white rounded-lg shadow-2xl flex flex-col max-w-[90rem] mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-semibold text-gray-900">{taskTitle}</h2>
              <span className="text-sm text-gray-500">
                {branch}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-2">
              <ThreeStateToggle
                value={compareWith}
                onChange={setCompareWith}
                options={[
                  { value: 'working', label: 'Working', color: 'yellow' },
                  { value: 'all', label: 'All Changes', color: 'blue' },
                  { value: 'base', label: 'vs Base', color: 'purple' }
                ]}
              />
              <span className="text-xs text-gray-500">
                {labels.description}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'split' ? 'unified' : 'split')}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
              title={`Switch to ${viewMode === 'split' ? 'unified' : 'split'} view`}
            >
              <Columns2 className="w-4 h-4 text-gray-600" />
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar */}
          {!sidebarCollapsed ? (
            <div className="w-80 border-r bg-gray-50 flex flex-col">
              {/* Sidebar Header */}
              <div className="px-3 py-2 border-b bg-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700">
                    Files ({filteredFiles.length})
                  </span>
                </div>
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
              </div>
              
              {/* Search */}
              {showSearch && (
                <div className="px-3 py-2 border-b bg-white">
                  <SearchInput
                    value={searchTerm}
                    onChange={setSearchTerm}
                    onClose={() => {
                      setShowSearch(false);
                      setSearchTerm('');
                    }}
                    placeholder="Filter files..."
                    autoFocus
                  />
                </div>
              )}
              
              {/* File Lists */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : error ? (
                  <div className="px-3 py-4 text-sm text-red-600">
                    {error}
                  </div>
                ) : filteredFiles.length === 0 ? (
                  <div className="px-3 py-4 text-sm text-gray-500 text-center">
                    {searchTerm ? 'No files match your search' : 'No changes to display'}
                  </div>
                ) : (
                  <>
                    {groupedFiles.staged.length > 0 && (
                      <FileListSection
                        ref={el => fileListRefs.current.staged = el}
                        title="Staged"
                        files={groupedFiles.staged}
                        selectedFile={selectedFile}
                        searchTerm={searchTerm}
                        onFileSelect={handleFileSelect}
                        onStageToggle={compareWith === 'working' ? toggleStaging : undefined}
                        pendingOperations={pendingOperations}
                        showStageCheckbox={compareWith === 'working'}
                      />
                    )}
                    
                    {groupedFiles.unstaged.length > 0 && (
                      <FileListSection
                        ref={el => fileListRefs.current.unstaged = el}
                        title="Unstaged"
                        files={groupedFiles.unstaged}
                        selectedFile={selectedFile}
                        searchTerm={searchTerm}
                        onFileSelect={handleFileSelect}
                        onStageToggle={compareWith === 'working' ? toggleStaging : undefined}
                        pendingOperations={pendingOperations}
                        showStageCheckbox={compareWith === 'working'}
                      />
                    )}
                    
                    {groupedFiles.untracked.length > 0 && (
                      <FileListSection
                        ref={el => fileListRefs.current.untracked = el}
                        title="Untracked"
                        files={groupedFiles.untracked}
                        selectedFile={selectedFile}
                        searchTerm={searchTerm}
                        onFileSelect={handleFileSelect}
                        onStageToggle={compareWith === 'working' ? toggleStaging : undefined}
                        pendingOperations={pendingOperations}
                        showStageCheckbox={compareWith === 'working'}
                      />
                    )}
                    
                    {groupedFiles.committed.length > 0 && (
                      <FileListSection
                        title="Committed"
                        files={groupedFiles.committed}
                        selectedFile={selectedFile}
                        searchTerm={searchTerm}
                        onFileSelect={handleFileSelect}
                      />
                    )}
                  </>
                )}
              </div>
            </div>
          ) : (
            // Collapsed Sidebar
            <div 
              className="w-12 border-r bg-gray-50 flex flex-col items-center py-4 cursor-pointer hover:bg-gray-100"
              onClick={() => setSidebarCollapsed(false)}
            >
              <ChevronRight className="w-4 h-4 text-gray-500" />
              <div className="mt-4 flex flex-col items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 vertical-text">
                  {filteredFiles.length} files
                </span>
              </div>
            </div>
          )}
          
          {/* Diff Viewer */}
          <div className="flex-1 overflow-hidden bg-gray-50">
            {selectedFile ? (
              <div className="h-full flex flex-col">
                {/* File Header */}
                <div className="px-4 py-2 bg-white border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">
                      {selectedFile.path}
                    </span>
                    {selectedFile.type && (
                      <span className={clsx(
                        'text-xs px-2 py-0.5 rounded',
                        selectedFile.type === 'added' && 'bg-green-100 text-green-700',
                        selectedFile.type === 'modified' && 'bg-yellow-100 text-yellow-700',
                        selectedFile.type === 'deleted' && 'bg-red-100 text-red-700'
                      )}>
                        {selectedFile.type}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{labels.left}</span>
                    <span>→</span>
                    <span>{labels.right}</span>
                  </div>
                </div>
                
                {/* Editor */}
                <div className="flex-1">
                  <DiffEditorWrapper
                    diff={selectedFile.diff}
                    filePath={selectedFile.path}
                    original={originalCode}
                    modified={modifiedCode}
                    viewMode={viewMode}
                    loading={selectedFile.loading || selectedFile.diffLoading}
                    height="100%"
                  />
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>Select a file to view changes</p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Footer with keyboard shortcuts */}
        <div className="px-6 py-2 border-t bg-gray-50 flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span><kbd>j</kbd>/<kbd>k</kbd> Navigate files</span>
            <span><kbd>/</kbd> Search</span>
            <span><kbd>Esc</kbd> Close</span>
          </div>
          {selectedFile && (
            <span>
              File {selectedFileIndex + 1} of {filteredFiles.length}
            </span>
          )}
        </div>
      </div>
      
      {/* CSS for vertical text */}
      <style jsx>{`
        .vertical-text {
          writing-mode: vertical-rl;
          text-orientation: mixed;
        }
      `}</style>
    </div>
  );
};