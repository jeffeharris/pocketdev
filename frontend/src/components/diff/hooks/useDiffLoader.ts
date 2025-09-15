/**
 * useDiffLoader Hook
 * 
 * Manages diff loading, caching, and state for the DiffViewerModal.
 * Encapsulates all diff fetching logic and provides a simple interface.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useService } from '../../../services';
import type { DiffFile } from '../../../types/diff';

export interface UseDiffLoaderOptions {
  projectId: string;
  taskId: string;
  baseBranch?: string;
  compareWith: 'working' | 'all' | 'base';
}

export interface UseDiffLoaderResult {
  files: DiffFile[];
  loading: boolean;
  error: string | null;
  hasWorkingChanges: boolean;
  loadDiffData: () => Promise<void>;
  loadFileDiff: (file: DiffFile, index: number) => Promise<void>;
  refreshDiff: () => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for managing diff loading and caching
 */
export function useDiffLoader({
  projectId,
  taskId,
  baseBranch = 'main',
  compareWith
}: UseDiffLoaderOptions): UseDiffLoaderResult {
  const gitService = useService('git');
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasWorkingChanges, setHasWorkingChanges] = useState(true);
  
  // Cache for loaded diffs to avoid refetching
  const diffCache = useRef<Map<string, string>>(new Map());
  
  /**
   * Update a specific file with diff content
   */
  const updateFileWithDiff = useCallback((index: number, diff: string) => {
    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      if (newFiles[index]) {
        newFiles[index] = {
          ...newFiles[index],
          diff,
          loading: false,
          diffLoading: false
        };
      }
      return newFiles;
    });
    
    // Cache the diff
    const file = files[index];
    if (file) {
      diffCache.current.set(file.path, diff);
    }
  }, [files]);
  
  /**
   * Load the file list based on comparison mode
   */
  const loadDiffData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      let response: any;
      
      switch (compareWith) {
        case 'working':
          response = await gitService.getWorkingChanges(projectId, taskId);
          break;
        case 'all':
          response = await gitService.getAllChanges(projectId, taskId, baseBranch);
          break;
        case 'base':
          response = await gitService.getBaseComparison(projectId, taskId, baseBranch);
          break;
        default:
          response = await gitService.getWorkingChanges(projectId, taskId);
      }
      
      if (response.files) {
        // Mark all files as needing diff loading
        const filesWithLoadingState = response.files.map((file: DiffFile) => ({
          ...file,
          loading: false,
          diffLoading: true,
          diff: diffCache.current.get(file.path) || undefined
        }));
        
        setFiles(filesWithLoadingState);
        setHasWorkingChanges(response.hasWorkingChanges ?? true);
      } else {
        setFiles([]);
        setHasWorkingChanges(false);
      }
    } catch (err) {
      console.error('Failed to load diff data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load diff data');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [compareWith, projectId, taskId, baseBranch, gitService]);
  
  /**
   * Load diff content for a specific file
   */
  const loadFileDiff = useCallback(async (file: DiffFile, index: number) => {
    // Check cache first
    const cached = diffCache.current.get(file.path);
    if (cached) {
      updateFileWithDiff(index, cached);
      return;
    }
    
    // Mark as loading
    setFiles(prevFiles => {
      const newFiles = [...prevFiles];
      if (newFiles[index]) {
        newFiles[index] = {
          ...newFiles[index],
          diffLoading: true
        };
      }
      return newFiles;
    });
    
    try {
      let diff: string = '';
      
      // Handle different file types
      if (file.type === 'deleted') {
        // For deleted files, show the entire original content
        const response = await gitService.getFileAtRevision(
          projectId,
          taskId,
          file.path,
          'HEAD'
        );
        diff = `--- a/${file.path}\n+++ /dev/null\n@@ -1,${response.split('\n').length} +0,0 @@\n${response.split('\n').map(line => `-${line}`).join('\n')}`;
      } else if (file.type === 'added' || file.untracked) {
        // For new files, show the entire content as additions
        const response = await gitService.getFileDiff(
          projectId,
          taskId,
          file.path,
          compareWith
        );
        diff = response.diff || response;
      } else {
        // For modified files, get the standard diff
        const response = await gitService.getFileDiff(
          projectId,
          taskId,
          file.path,
          compareWith
        );
        diff = response.diff || response;
      }
      
      updateFileWithDiff(index, diff);
    } catch (error) {
      console.error(`Failed to load diff for ${file.path}:`, error);
      updateFileWithDiff(index, `// Failed to load diff for ${file.path}`);
    }
  }, [compareWith, projectId, taskId, gitService, updateFileWithDiff]);
  
  /**
   * Refresh all diffs (clear cache and reload)
   */
  const refreshDiff = useCallback(async () => {
    diffCache.current.clear();
    await loadDiffData();
  }, [loadDiffData]);
  
  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Load initial data on mount or when comparison mode changes
  useEffect(() => {
    loadDiffData();
  }, [loadDiffData]);
  
  return {
    files,
    loading,
    error,
    hasWorkingChanges,
    loadDiffData,
    loadFileDiff,
    refreshDiff,
    clearError
  };
}