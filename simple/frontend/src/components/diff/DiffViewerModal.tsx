import { useState, useEffect } from 'react';
import { X, FileText, GitBranch, Plus, Minus, Columns2, FileCode, ChevronLeft, ChevronRight } from 'lucide-react';
import { api } from '../../services/api';
import { DiffEditor } from '@monaco-editor/react';

interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  diff?: string;
  loading?: boolean;
}

interface DiffViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  taskId: string;
  taskTitle: string;
  branch: string;
}

/**
 * DiffViewerModal - Monaco-based diff viewer with split/unified toggle
 * 
 * IMPORTANT: Monaco DiffEditor requires sufficient width for split view
 * - Minimum width for split view: ~800-900px (approximate)
 * - Below this width, Monaco automatically falls back to unified view
 * - Now using max-w-[90rem] (1440px) for even better split view experience
 * - Previous max-w-7xl (80rem = 1280px) worked but this gives more room
 * - Sidebar is collapsible to maximize diff viewer space when needed
 * 
 * For mobile/responsive design considerations:
 * - On narrow screens, force unified view regardless of user selection
 * - Consider using a media query or viewport check to disable split toggle
 * - Monaco calculates this internally based on available width (pixel-based, not percentage)
 * - The width requirement depends on font size and minimap settings
 */
export const DiffViewerModal: React.FC<DiffViewerModalProps> = ({
  isOpen,
  onClose,
  projectId,
  taskId,
  taskTitle,
  branch
}) => {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<DiffFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [originalCode, setOriginalCode] = useState<string>('');
  const [modifiedCode, setModifiedCode] = useState<string>('');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [canUseSplitView, setCanUseSplitView] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedFileIndex, setSelectedFileIndex] = useState(0);


  // Check viewport width for split view capability
  useEffect(() => {
    const checkViewportWidth = () => {
      // Monaco needs ~900px minimum for split view to work well
      const minWidthForSplit = 900;
      const viewportWidth = window.innerWidth;
      const modalPadding = 32; // p-4 on each side
      const availableWidth = viewportWidth - modalPadding;
      
      const canSplit = availableWidth >= minWidthForSplit;
      setCanUseSplitView(canSplit);
      
      // If we can't use split view, force unified mode
      if (!canSplit && viewMode === 'split') {
        setViewMode('unified');
      }
    };

    checkViewportWidth();
    window.addEventListener('resize', checkViewportWidth);
    
    return () => window.removeEventListener('resize', checkViewportWidth);
  }, [viewMode]);

  // Load diff data when modal opens
  useEffect(() => {
    if (isOpen && taskId) {
      loadDiffData();
    } else if (!isOpen) {
      // Clear data when modal closes
      setFiles([]);
      setSelectedFile(null);
      setOriginalCode('');
      setModifiedCode('');
      setError(null);
    }
  }, [isOpen, taskId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Toggle view mode with 'v' key (only if split view is available)
      if (e.key === 'v' && !e.ctrlKey && !e.metaKey && canUseSplitView) {
        setViewMode(prev => prev === 'split' ? 'unified' : 'split');
      }
      
      // Toggle sidebar with 's' key
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        setSidebarCollapsed(prev => !prev);
      }
      
      // Navigate files with arrow keys
      if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
        e.preventDefault();
        const direction = e.key === 'ArrowUp' ? -1 : 1;
        const newIndex = Math.max(0, Math.min(files.length - 1, selectedFileIndex + direction));
        if (newIndex !== selectedFileIndex && files[newIndex]) {
          setSelectedFile(files[newIndex]);
          setSelectedFileIndex(newIndex);
        }
      }
      
      // Close modal with Escape
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, canUseSplitView, files, selectedFileIndex]);

  // Process diff when file is selected
  useEffect(() => {
    if (selectedFile?.diff) {
      processDiff(selectedFile.diff);
    } else if (selectedFile && !selectedFile.diff) {
      setOriginalCode('');
      setModifiedCode('// No diff content available for this file');
    } else {
      // Clear codes when no file is selected
      setOriginalCode('');
      setModifiedCode('');
    }
  }, [selectedFile]);


  const loadDiffData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getTaskDiff(projectId, taskId);
      const files: DiffFile[] = response.files || [];
      
      // Mark all files as needing to load their diff content
      const filesWithLoadingState = files.map(file => ({
        ...file,
        loading: !file.diff, // Only mark as loading if diff isn't already present
      }));
      
      setFiles(filesWithLoadingState);
      
      if (filesWithLoadingState.length > 0) {
        // Load the first file immediately
        const firstFile = filesWithLoadingState[0];
        setSelectedFile(firstFile);
        setSelectedFileIndex(0);
        
        // If first file needs diff content, load it
        if (!firstFile.diff) {
          await loadFileDiff(firstFile.path, 0);
        }
        
        // Load remaining files in the background
        filesWithLoadingState.slice(1).forEach((file, index) => {
          if (!file.diff) {
            loadFileDiff(file.path, index + 1);
          }
        });
      } else {
        setSelectedFile(null);
        setSelectedFileIndex(0);
      }
    } catch (error: any) {
      console.error('Failed to load diff:', error);
      setError(error.message || 'Failed to load changes');
      setFiles([]);
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  };
  
  const loadFileDiff = async (filePath: string, fileIndex: number) => {
    try {
      // Simulate API call to load individual file diff
      // In a real implementation, this would be a separate API endpoint
      const response = await api.getFileDiff(projectId, taskId, filePath);
      
      setFiles(prevFiles => {
        const newFiles = [...prevFiles];
        if (newFiles[fileIndex]) {
          newFiles[fileIndex] = {
            ...newFiles[fileIndex],
            diff: response.diff,
            loading: false
          };
        }
        return newFiles;
      });
      
      // Update selected file if it's the one we just loaded
      setSelectedFile(prev => {
        if (prev && prev.path === filePath) {
          return {
            ...prev,
            diff: response.diff,
            loading: false
          };
        }
        return prev;
      });
    } catch (error) {
      console.error(`Failed to load diff for ${filePath}:`, error);
      // Mark the file as failed to load
      setFiles(prevFiles => {
        const newFiles = [...prevFiles];
        if (newFiles[fileIndex]) {
          newFiles[fileIndex] = {
            ...newFiles[fileIndex],
            loading: false
          };
        }
        return newFiles;
      });
    }
  };

  const processDiff = (diff: string) => {
    // Clear previous state first to avoid stale references
    setOriginalCode('');
    setModifiedCode('');
    
    // Extract original and modified code from the diff
    const lines = diff.split('\n');
    const original: string[] = [];
    const modified: string[] = [];
    let inHunk = false;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        inHunk = true;
        continue;
      }
      
      if (!inHunk) continue;

      if (line.startsWith('-')) {
        // Removed line - goes to original only
        original.push(line.substring(1));
      } else if (line.startsWith('+')) {
        // Added line - goes to modified only
        modified.push(line.substring(1));
      } else if (line.startsWith(' ')) {
        // Context line - goes to both
        const contextLine = line.substring(1);
        original.push(contextLine);
        modified.push(contextLine);
      }
    }

    setOriginalCode(original.join('\n'));
    setModifiedCode(modified.join('\n'));
  };

  // Get language from file extension
  const getLanguageFromPath = (path: string): string => {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      'js': 'javascript',
      'jsx': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'json': 'json',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'py': 'python',
      'java': 'java',
      'go': 'go',
      'rs': 'rust',
      'md': 'markdown',
      'yml': 'yaml',
      'yaml': 'yaml',
      'xml': 'xml',
      'sh': 'shell',
      'bash': 'shell'
    };
    return langMap[ext] || 'plaintext';
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'added':
        return <Plus className="w-4 h-4 text-green-600" />;
      case 'deleted':
        return <Minus className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-blue-600" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[90rem] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Changes in {taskTitle}</h2>
            <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
              <GitBranch className="w-4 h-4" />
              <span>{branch}</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File List Sidebar */}
          <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} transition-all duration-200 border-r border-gray-200 overflow-y-auto bg-gray-50 flex flex-col`}>
            {!sidebarCollapsed ? (
              <div className="flex-1 p-4">
                <div className="flex items-center justify-between mb-3 min-w-0">
                  <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Changes ({files.length} {files.length === 1 ? 'file' : 'files'})
                  </h3>
                  <button
                    onClick={() => setSidebarCollapsed(true)}
                    className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0 ml-2"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft className="w-4 h-4 text-gray-500" />
                  </button>
                </div>
                {files.length === 0 && !loading && (
                  <div className="text-sm text-gray-500">
                    {error ? 'Failed to load changes' : 'No changes to display'}
                  </div>
                )}
                <div className="space-y-1">
                  {files.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => {
                        setSelectedFile(file);
                        setSelectedFileIndex(files.indexOf(file));
                      }}
                      className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                        selectedFile?.path === file.path
                          ? 'bg-white shadow-sm border border-gray-200 text-gray-900'
                          : 'hover:bg-white hover:shadow-sm text-gray-700'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          {getFileIcon(file.type)}
                          <span className="truncate">{file.path}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-green-600">+{file.additions}</span>
                          <span className="text-red-600">-{file.deletions}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div 
                className="flex flex-col items-center py-4 gap-4 cursor-pointer hover:bg-gray-100 h-full"
                onClick={() => setSidebarCollapsed(false)}
                title="Expand sidebar"
              >
                <button
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                </button>
                <div className="flex flex-col items-center gap-2 select-none">
                  <FileText className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-500 vertical-text">{files.length} {files.length === 1 ? 'file' : 'files'}</span>
                </div>
                {selectedFile && (
                  <div className="flex flex-col items-center gap-1 select-none mt-2 pt-2 border-t border-gray-200">
                    <span className="text-xs text-gray-600 font-medium">{selectedFileIndex + 1}</span>
                    <span className="text-xs text-gray-400">of</span>
                    <span className="text-xs text-gray-600 font-medium">{files.length}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Diff Viewer */}
          <div className="flex-1 overflow-auto bg-gray-50">
            {loading ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                Loading diff...
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <p className="text-red-600 mb-2">{error}</p>
                  <button
                    onClick={() => loadDiffData()}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Try again
                  </button>
                </div>
              </div>
            ) : files.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-500">
                <div className="text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p>No changes to display</p>
                  <p className="text-sm mt-1">Your working tree is clean</p>
                </div>
              </div>
            ) : selectedFile ? (
              <div className="flex flex-col h-full">
                <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
                  <h3 className="font-mono text-sm text-gray-700">{selectedFile.path}</h3>
                  {canUseSplitView ? (
                    <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg p-0.5">
                      <button
                        onClick={() => setViewMode('split')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                          viewMode === 'split'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="Split view - Side by side comparison"
                      >
                        <Columns2 className="w-3.5 h-3.5" />
                        <span>Split</span>
                      </button>
                      <button
                        onClick={() => setViewMode('unified')}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-200 ${
                          viewMode === 'unified'
                            ? 'bg-white text-gray-900 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        title="Unified view - Inline diff"
                      >
                        <FileCode className="w-3.5 h-3.5" />
                        <span>Unified</span>
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-500">Unified view</span>
                  )}
                </div>
                <div className="flex-1 relative">
                  {/* Loading overlay for smooth transitions */}
                  {loading && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                      <div className="text-gray-500">Loading...</div>
                    </div>
                  )}
                  {!loading && originalCode !== undefined && modifiedCode !== undefined && (
                    <DiffEditor
                      key={`${selectedFile.path}-${viewMode}`}
                      height="100%"
                      language={getLanguageFromPath(selectedFile.path)}
                      original={originalCode}
                      modified={modifiedCode}
                      theme="vs"
                      options={{
                        readOnly: true,
                        renderSideBySide: viewMode === 'split',
                        enableSplitViewResizing: true,
                        renderOverviewRuler: true,
                        minimap: {
                          enabled: true,
                          showSlider: 'always',
                          renderCharacters: false,
                          maxColumn: 200,
                          side: 'right'
                        },
                        scrollbar: {
                          vertical: 'visible',
                          horizontal: 'visible',
                          useShadows: true,
                          verticalHasArrows: false,
                          horizontalHasArrows: false,
                          verticalScrollbarSize: 14,
                          horizontalScrollbarSize: 14,
                          arrowSize: 30
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                Select a file to view changes
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between items-center">
          <div className="text-xs text-gray-500">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">↑</kbd>
              <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">↓</kbd>
              <span>Navigate files</span>
            </span>
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">S</kbd>
              <span>Toggle sidebar</span>
            </span>
            {canUseSplitView && (
              <>
                <span className="mx-2">·</span>
                <span className="inline-flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">V</kbd>
                  <span>Toggle view</span>
                </span>
              </>
            )}
            <span className="mx-2">·</span>
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-300 rounded">Esc</kbd>
              <span>Close</span>
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>

    </div>
  );
};