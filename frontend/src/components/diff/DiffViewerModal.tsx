import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { X, FileText, GitBranch, Columns2, FileCode, ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { api } from '../../services/api';
import { DiffEditor } from '@monaco-editor/react';
import { ThreeStateToggle, type ToggleOption } from './ThreeStateToggle';
import { StatusIcon } from './StatusIcon';
import { SearchInput, HighlightedPath } from './SearchInput';

interface DiffFile {
  path: string;
  additions: number;
  deletions: number;
  type: 'added' | 'modified' | 'deleted' | 'renamed';
  diff?: string;
  loading?: boolean;
  diffLoading?: boolean; // Track diff content loading separately
  status?: string; // Git status code like 'MM', 'A ', etc.
  category?: 'staged' | 'unstaged' | 'untracked' | 'committed';
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
  const [compareWith, setCompareWith] = useState<ToggleOption>('working');
  const [hasWorkingChanges, setHasWorkingChanges] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  
  // Track if user has manually toggled search
  const hasManuallyToggledSearch = useRef(false);
  
  // Track pending staging operations per file
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  
  // Toast state
  const [toast, setToast] = useState<{message: string, type: 'success' | 'error'} | null>(null);
  
  // Cache for diff data
  const diffCache = useRef<{
    allData?: { files: DiffFile[]; hasWorkingChanges: boolean; summary?: Record<string, unknown> };
  }>({});
  
  // Cache for individual file diffs
  const fileDiffCache = useRef<{
    [key: string]: string; // key format: "compareMode:filePath"
  }>({});


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

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

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
      // Reset comparison mode to working
      setCompareWith('working');
      // Reset search state
      setSearchTerm('');
      setShowSearch(false);
      hasManuallyToggledSearch.current = false;
      // Clear pending operations
      setPendingOperations(new Set());
      // Clear toast
      setToast(null);
      // Clear caches when modal closes
      diffCache.current = {};
      fileDiffCache.current = {};
    }
    
    // Cleanup function to prevent Monaco disposal errors
    return () => {
      if (!isOpen) {
        setOriginalCode('');
        setModifiedCode('');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, taskId]);

  // Re-apply filters when compareWith changes
  useEffect(() => {
    if (diffCache.current.allData && isOpen) {
      applyFilters(diffCache.current.allData);
    }
  }, [compareWith]); // applyFilters is stable due to useCallback

  // Load first file's diff when a file is selected and hasn't been loaded yet
  useEffect(() => {
    if (selectedFile && !selectedFile.diff && selectedFile.loading !== false && files.length > 0) {
      const fileIndex = files.findIndex(f => f.path === selectedFile.path);
      if (fileIndex !== -1) {
        // This will run after loadFileDiff is defined
        const timer = setTimeout(() => {
          loadFileDiff(selectedFile.path, fileIndex);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [selectedFile?.path, files.length]); // Intentionally not including loadFileDiff to avoid issues

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      
      // Skip shortcuts if user is typing in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }
      
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
    } else if (selectedFile && !selectedFile.diff && selectedFile.loading !== false) {
      // File is loading, keep previous state to avoid flashing
      // Don't change originalCode/modifiedCode
    } else if (selectedFile && selectedFile.diff === undefined && selectedFile.loading === false) {
      // File failed to load
      setOriginalCode('');
      setModifiedCode('');
    } else if (!selectedFile) {
      // Only clear when no file is selected
      setOriginalCode('');
      setModifiedCode('');
    }
  }, [selectedFile?.path, selectedFile?.diff, selectedFile?.loading]);

  // Group files by category
  const groupedFiles = useMemo(() => {
    let result = files;
    
    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      result = result.filter(file => 
        file.path.toLowerCase().includes(search)
      );
    }
    
    // Group by category for working/all modes
    if (compareWith === 'working' || compareWith === 'all') {
      const staged = result.filter(f => f.category === 'staged');
      const unstaged = result.filter(f => f.category === 'unstaged' || f.category === 'untracked');
      const committed = result.filter(f => f.category === 'committed');
      
      return {
        staged,
        unstaged,
        committed,
        hasGroups: staged.length > 0 && unstaged.length > 0
      };
    }
    
    // For base mode, just return all files as one group
    return {
      staged: [],
      unstaged: [],
      committed: result,
      hasGroups: false
    };
  }, [files, searchTerm, compareWith]);
  
  const filteredFiles = [...groupedFiles.staged, ...groupedFiles.unstaged, ...groupedFiles.committed];

  // Auto-show search when many files (only if user hasn't manually toggled)
  useEffect(() => {
    if (!hasManuallyToggledSearch.current && files.length > 10 && !showSearch) {
      setShowSearch(true);
    }
  }, [files.length, showSearch]); // Now safe to include showSearch

  // Apply filters based on current view mode
  const applyFilters = useCallback((allData: { files: DiffFile[]; hasWorkingChanges: boolean; summary?: Record<string, unknown> }) => {
    let filteredFiles = allData.files;
    
    // Filter based on compareWith mode
    if (compareWith === 'working') {
      // Show only uncommitted changes (staged, unstaged, untracked)
      filteredFiles = filteredFiles.filter(file => 
        file.category === 'staged' || file.category === 'unstaged' || file.category === 'untracked'
      );
    } else if (compareWith === 'base') {
      // Show only committed changes
      filteredFiles = filteredFiles.filter(file => file.category === 'committed');
    }
    // For 'all' mode, show everything (no filter)
    
    // Process files inline to avoid circular dependency
    if (filteredFiles.length > 0) {
      
      // Set files immediately
      setFiles(filteredFiles);
      
      // Select the first file
      const firstFile = filteredFiles[0];
      setSelectedFile(firstFile);
      setSelectedFileIndex(0);
      
      // First file diff will be loaded by the click handler when modal is first opened
    } else {
      setFiles([]);
      setSelectedFile(null);
      setSelectedFileIndex(0);
    }
  }, [compareWith]);

  // Helper to update git status codes for icon changes
  const getUpdatedGitStatus = (currentStatus: string, action: 'stage' | 'unstage'): string => {
    if (action === 'stage') {
      switch (currentStatus) {
        case '??': return 'A ';  // Untracked → Staged new file
        case ' M': return 'M ';  // Modified → Staged modified
        case ' D': return 'D ';  // Deleted → Staged deleted
        case 'MM': return 'M ';  // Modified staged+unstaged → All staged
        default: return currentStatus;
      }
    } else { // unstage
      switch (currentStatus) {
        case 'A ': return '??';  // Staged new → Untracked
        case 'M ': return ' M';  // Staged modified → Unstaged modified
        case 'D ': return ' D';  // Staged deleted → Unstaged deleted
        default: return currentStatus;
      }
    }
  };

  // Handle staging/unstaging files
  const handleStageToggle = async (file: DiffFile) => {
    const filePath = file.path;
    
    // Only prevent clicks on THIS file
    if (pendingOperations.has(filePath)) return;
    
    setPendingOperations(prev => new Set(prev).add(filePath));
    
    // Optimistically update git status (StatusIcon will auto-update)
    const action = file.category === 'staged' ? 'unstage' : 'stage';
    const newStatus = getUpdatedGitStatus(file.status || '', action);
    const newCategory: 'staged' | 'unstaged' | 'untracked' = action === 'stage' ? 'staged' : 
                       (file.status === 'A ' ? 'untracked' : 'unstaged');
    
    const optimisticFiles = files.map(f => 
      f.path === filePath 
        ? { ...f, status: newStatus, category: newCategory }
        : f
    );
    setFiles(optimisticFiles);
    
    try {
      const result = action === 'unstage'
        ? await api.unstageFile(projectId, taskId, filePath)
        : await api.stageFile(projectId, taskId, filePath);
        
      if (result.success) {
        // Success - reload for consistency
        await loadDiffData(true);
        // No success toast - visual feedback is enough
      } else {
        // Revert on error
        setFiles(files);
        setToast({ message: result.error || `Failed to ${action} file`, type: 'error' });
      }
    } catch {
      setFiles(files);
      setToast({ message: 'Network error while staging file', type: 'error' });
    } finally {
      setPendingOperations(prev => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    }
  };

  const loadDiffData = useCallback(async (forceReload = false) => {
    // Always get all changes and filter client-side
    if (!forceReload && diffCache.current.allData) {
      applyFilters(diffCache.current.allData);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Always fetch all changes
      const response = await api.getAllChanges(projectId, taskId);
      const files: DiffFile[] = response.files || [];
      
      // Cache the full response
      diffCache.current.allData = {
        files,
        hasWorkingChanges: (response.summary?.total || 0) > (response.summary?.committed || 0),
        summary: response.summary
      };
      
      setHasWorkingChanges((response.summary?.total || 0) > (response.summary?.committed || 0));
      
      // Apply filters based on current compareWith value
      applyFilters(diffCache.current.allData);
    } catch (error) {
      console.error('Failed to load diff:', error);
      setError((error as Error).message || 'Failed to load changes');
      setFiles([]);
      setSelectedFile(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, taskId, applyFilters]);

  
  const updateFileWithDiff = useCallback((fileIndex: number, filePath: string, diff: string) => {
    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      if (newFiles[fileIndex]) {
        newFiles[fileIndex] = {
          ...newFiles[fileIndex],
          diff: diff,
          loading: false,
          diffLoading: false
        };
      }
      return newFiles;
    });
    
    // Update selected file if it's the one we just loaded
    setSelectedFile(prev => {
      if (prev && prev.path === filePath) {
        const updated = {
          ...prev,
          diff: diff,
          loading: false,
          diffLoading: false
        };
        // Trigger diff processing immediately
        setTimeout(() => processDiff(diff), 0);
        return updated;
      }
      return prev;
    });
  }, []);

  const loadFileDiff = useCallback(async (filePath: string, fileIndex: number) => {
    // Cache by both file path AND compareWith mode since they return different diffs
    const cacheKey = `${compareWith}:${filePath}`;
    
    // Check cache first
    if (fileDiffCache.current[cacheKey]) {
      updateFileWithDiff(fileIndex, filePath, fileDiffCache.current[cacheKey]);
      return;
    }
    
    try {
      const response = await api.getFileDiff(projectId, taskId, filePath, compareWith);
      
      // Cache the diff
      fileDiffCache.current[cacheKey] = response.diff;
      
      updateFileWithDiff(fileIndex, filePath, response.diff);
    } catch (error) {
      console.error(`Failed to load diff for ${filePath}:`, error);
      // Mark the file as failed to load
      setFiles(prevFiles => {
        const newFiles = [...prevFiles];
        if (newFiles[fileIndex]) {
          newFiles[fileIndex] = {
            ...newFiles[fileIndex],
            loading: false,
            diff: `// Failed to load diff for ${filePath}`
          };
        }
        return newFiles;
      });
    }
  }, [compareWith, projectId, taskId, updateFileWithDiff]);

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-[90rem] h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
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
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`mx-6 mt-2 px-4 py-2 rounded-md flex items-center justify-between ${
            toast.type === 'error' 
              ? 'bg-red-50 text-red-800 border border-red-200' 
              : 'bg-green-50 text-green-800 border border-green-200'
          }`}>
            <span className="text-sm">{toast.message}</span>
            <button
              onClick={() => setToast(null)}
              className="ml-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* File List Sidebar */}
          <div className={`${sidebarCollapsed ? 'w-12' : 'w-80'} transition-all duration-200 border-r border-gray-200 overflow-y-auto bg-gray-50 flex flex-col`}>
            {!sidebarCollapsed ? (
              <div className="flex-1 p-4">
                <div className="mb-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <h3 className="text-sm font-medium text-gray-700 whitespace-nowrap">
                      Changes ({filteredFiles.length})
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          hasManuallyToggledSearch.current = true;
                          setShowSearch(!showSearch);
                        }}
                        className={`p-1 hover:bg-gray-200 rounded transition-colors ${
                          showSearch ? 'bg-gray-200' : ''
                        }`}
                        title="Search files"
                      >
                        <Search className="w-4 h-4 text-gray-500" />
                      </button>
                      <button
                        onClick={() => setSidebarCollapsed(true)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Collapse sidebar"
                      >
                        <ChevronLeft className="w-4 h-4 text-gray-500" />
                      </button>
                    </div>
                  </div>
                  {/* Three-state toggle in its own row */}
                  <div className="mb-3">
                    <ThreeStateToggle
                      value={compareWith}
                      onChange={(value) => {
                        setCompareWith(value);
                      }}
                      disabledOptions={!hasWorkingChanges ? ['working'] : []}
                    />
                  </div>
                </div>
                
                {/* Search input */}
                {showSearch && (
                  <div className="mb-3">
                    <SearchInput
                      value={searchTerm}
                      onChange={setSearchTerm}
                      placeholder="Search files..."
                      autoFocus
                      totalItems={files.length}
                      minItemsToShow={0} // Always show when toggled
                    />
                  </div>
                )}
                
                {filteredFiles.length === 0 && !loading && (
                  <div className="text-sm text-gray-500">
                    {error ? 'Failed to load changes' : 
                     searchTerm ? `No files match "${searchTerm}"` : 
                     'No changes to display'}
                  </div>
                )}
                
                {/* Skeleton loader */}
                {loading && files.length === 0 && (
                  <div className="space-y-1">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="px-3 py-2.5 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-gray-200 rounded" />
                              <div className="h-4 bg-gray-200 rounded w-32" />
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-3 w-8 bg-gray-200 rounded" />
                              <div className="h-3 w-8 bg-gray-200 rounded" />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="space-y-1">
                  {/* Staged files */}
                  {groupedFiles.staged.length > 0 && (
                    <>
                      {groupedFiles.hasGroups && (
                        <div className="text-xs text-gray-500 font-medium px-3 py-1">Staged</div>
                      )}
                      {groupedFiles.staged.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => {
                            const fileIndex = filteredFiles.indexOf(file);
                            setSelectedFile(file);
                            setSelectedFileIndex(fileIndex);
                            
                            // Load diff if not already loaded
                            if (!file.diff && file.loading !== false) {
                              loadFileDiff(file.path, fileIndex);
                            }
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                            selectedFile?.path === file.path
                              ? 'bg-white shadow-sm border border-gray-200 text-gray-900'
                              : 'hover:bg-white hover:shadow-sm text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <StatusIcon 
                                gitStatus={file.status || '  '} 
                                size="sm"
                                category={file.category}
                                onClick={
                                  (file.category === 'staged' || file.category === 'unstaged' || file.category === 'untracked')
                                  && (compareWith === 'working' || compareWith === 'all')
                                    ? (e) => {
                                        e.stopPropagation();
                                        handleStageToggle(file);
                                      }
                                    : undefined
                                }
                                isLoading={pendingOperations.has(file.path)}
                                disabled={pendingOperations.has(file.path)}
                              />
                              {searchTerm ? (
                                <HighlightedPath 
                                  path={file.path} 
                                  searchTerm={searchTerm}
                                  className="truncate"
                                  maxLength={40}
                                />
                              ) : (
                                <span className="truncate">{file.path}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600">+{file.additions}</span>
                              <span className="text-red-600">-{file.deletions}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  
                  {/* Divider between staged and unstaged */}
                  {groupedFiles.hasGroups && groupedFiles.unstaged.length > 0 && (
                    <div className="my-2 border-t border-gray-200"></div>
                  )}
                  
                  {/* Unstaged files */}
                  {groupedFiles.unstaged.length > 0 && (
                    <>
                      {groupedFiles.hasGroups && (
                        <div className="text-xs text-gray-500 font-medium px-3 py-1">Unstaged</div>
                      )}
                      {groupedFiles.unstaged.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => {
                            const fileIndex = filteredFiles.indexOf(file);
                            setSelectedFile(file);
                            setSelectedFileIndex(fileIndex);
                            
                            // Load diff if not already loaded
                            if (!file.diff && file.loading !== false) {
                              loadFileDiff(file.path, fileIndex);
                            }
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                            selectedFile?.path === file.path
                              ? 'bg-white shadow-sm border border-gray-200 text-gray-900'
                              : 'hover:bg-white hover:shadow-sm text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <StatusIcon 
                                gitStatus={file.status || '  '} 
                                size="sm"
                                category={file.category}
                                onClick={
                                  (file.category === 'staged' || file.category === 'unstaged' || file.category === 'untracked')
                                  && (compareWith === 'working' || compareWith === 'all')
                                    ? (e) => {
                                        e.stopPropagation();
                                        handleStageToggle(file);
                                      }
                                    : undefined
                                }
                                isLoading={pendingOperations.has(file.path)}
                                disabled={pendingOperations.has(file.path)}
                              />
                              {searchTerm ? (
                                <HighlightedPath 
                                  path={file.path} 
                                  searchTerm={searchTerm}
                                  className="truncate"
                                  maxLength={40}
                                />
                              ) : (
                                <span className="truncate">{file.path}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600">+{file.additions}</span>
                              <span className="text-red-600">-{file.deletions}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                  
                  {/* Committed files (for 'all' mode) */}
                  {groupedFiles.committed.length > 0 && compareWith === 'all' && (
                    <>
                      {(groupedFiles.staged.length > 0 || groupedFiles.unstaged.length > 0) && (
                        <>
                          <div className="my-2 border-t border-gray-200"></div>
                          <div className="text-xs text-gray-500 font-medium px-3 py-1">Committed</div>
                        </>
                      )}
                      {groupedFiles.committed.map((file) => (
                        <button
                          key={file.path}
                          onClick={() => {
                            const fileIndex = filteredFiles.indexOf(file);
                            setSelectedFile(file);
                            setSelectedFileIndex(fileIndex);
                            
                            // Load diff if not already loaded
                            if (!file.diff && file.loading !== false) {
                              loadFileDiff(file.path, fileIndex);
                            }
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
                            selectedFile?.path === file.path
                              ? 'bg-white shadow-sm border border-gray-200 text-gray-900'
                              : 'hover:bg-white hover:shadow-sm text-gray-700'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 min-w-0">
                              <StatusIcon 
                                gitStatus={file.status || '  '} 
                                size="sm"
                                category={file.category}
                              />
                              {searchTerm ? (
                                <HighlightedPath 
                                  path={file.path} 
                                  searchTerm={searchTerm}
                                  className="truncate"
                                  maxLength={40}
                                />
                              ) : (
                                <span className="truncate">{file.path}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-green-600">+{file.additions}</span>
                              <span className="text-red-600">-{file.deletions}</span>
                            </div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center h-full">
                <div 
                  className="flex flex-col items-center py-4 gap-4 cursor-pointer hover:bg-gray-100 flex-1 w-full"
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
                    <span className="text-xs text-gray-500 vertical-text">{filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}</span>
                  </div>
                  {selectedFile && (
                    <div className="flex flex-col items-center gap-1 select-none mt-2 pt-2 border-t border-gray-200">
                      <span className="text-xs text-gray-600 font-medium">{selectedFileIndex + 1}</span>
                      <span className="text-xs text-gray-400">of</span>
                      <span className="text-xs text-gray-600 font-medium">{filteredFiles.length}</span>
                    </div>
                  )}
                </div>
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
                  {compareWith === 'working' ? (
                    <>
                      <p className="text-lg font-medium text-gray-700">✓ Working tree is clean</p>
                      <p className="text-sm mt-1">All changes have been committed</p>
                    </>
                  ) : compareWith === 'all' ? (
                    <>
                      <p className="text-lg font-medium text-gray-700">✓ Your branch is up to date</p>
                      <p className="text-sm mt-1">No changes with origin/{branch.split('/').pop()}</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-medium text-gray-700">✓ No changes to merge</p>
                      <p className="text-sm mt-1">Your branch matches origin/{branch.split('/').pop()}</p>
                    </>
                  )}
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
                  {!loading && originalCode !== undefined && modifiedCode !== undefined && !selectedFile.loading && (
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
                  {selectedFile?.loading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white">
                      <div className="flex flex-col items-center gap-2 text-gray-500">
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span className="text-sm">Loading diff...</span>
                      </div>
                    </div>
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