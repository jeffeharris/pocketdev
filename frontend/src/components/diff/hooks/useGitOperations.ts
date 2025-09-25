/**
 * useGitOperations Hook
 * 
 * Manages Git operations like staging and unstaging files.
 * Tracks pending operations to show loading states per file.
 */

import { useState, useCallback } from 'react';
import { useService } from '../../../services';
import type { DiffFile } from '../../../types/diff';

export interface UseGitOperationsOptions {
  projectId: string;
  taskId: string;
  onOperationComplete?: () => void;
}

export interface UseGitOperationsResult {
  pendingOperations: Set<string>;
  stageFile: (file: DiffFile) => Promise<void>;
  unstageFile: (file: DiffFile) => Promise<void>;
  stageAll: (files: DiffFile[]) => Promise<void>;
  unstageAll: (files: DiffFile[]) => Promise<void>;
  toggleStaging: (file: DiffFile) => Promise<void>;
}

/**
 * Hook for managing Git staging operations
 */
export function useGitOperations({
  projectId,
  taskId,
  onOperationComplete
}: UseGitOperationsOptions): UseGitOperationsResult {
  const gitService = useService('git');
  const [pendingOperations, setPendingOperations] = useState<Set<string>>(new Set());
  
  /**
   * Add a file to pending operations
   */
  const addPending = useCallback((filePath: string) => {
    setPendingOperations(prev => new Set(prev).add(filePath));
  }, []);
  
  /**
   * Remove a file from pending operations
   */
  const removePending = useCallback((filePath: string) => {
    setPendingOperations(prev => {
      const next = new Set(prev);
      next.delete(filePath);
      return next;
    });
  }, []);
  
  /**
   * Stage a single file
   */
  const stageFile = useCallback(async (file: DiffFile) => {
    if (pendingOperations.has(file.path)) return;
    
    addPending(file.path);
    try {
      await gitService.stageFiles(projectId, taskId, [file.path]);
      onOperationComplete?.();
    } catch (error) {
      console.error(`Failed to stage ${file.path}:`, error);
      throw error;
    } finally {
      removePending(file.path);
    }
  }, [projectId, taskId, gitService, pendingOperations, addPending, removePending, onOperationComplete]);
  
  /**
   * Unstage a single file
   */
  const unstageFile = useCallback(async (file: DiffFile) => {
    if (pendingOperations.has(file.path)) return;
    
    addPending(file.path);
    try {
      await gitService.unstageFiles(projectId, taskId, [file.path]);
      onOperationComplete?.();
    } catch (error) {
      console.error(`Failed to unstage ${file.path}:`, error);
      throw error;
    } finally {
      removePending(file.path);
    }
  }, [projectId, taskId, gitService, pendingOperations, addPending, removePending, onOperationComplete]);
  
  /**
   * Stage multiple files
   */
  const stageAll = useCallback(async (files: DiffFile[]) => {
    const paths = files.map(f => f.path);
    
    // Add all to pending
    paths.forEach(addPending);
    
    try {
      await gitService.stageFiles(projectId, taskId, paths);
      onOperationComplete?.();
    } catch (error) {
      console.error('Failed to stage files:', error);
      throw error;
    } finally {
      paths.forEach(removePending);
    }
  }, [projectId, taskId, gitService, addPending, removePending, onOperationComplete]);
  
  /**
   * Unstage multiple files
   */
  const unstageAll = useCallback(async (files: DiffFile[]) => {
    const paths = files.map(f => f.path);
    
    // Add all to pending
    paths.forEach(addPending);
    
    try {
      await gitService.unstageFiles(projectId, taskId, paths);
      onOperationComplete?.();
    } catch (error) {
      console.error('Failed to unstage files:', error);
      throw error;
    } finally {
      paths.forEach(removePending);
    }
  }, [projectId, taskId, gitService, addPending, removePending, onOperationComplete]);
  
  /**
   * Toggle staging status of a file
   */
  const toggleStaging = useCallback(async (file: DiffFile) => {
    if (file.staged) {
      await unstageFile(file);
    } else {
      await stageFile(file);
    }
  }, [stageFile, unstageFile]);
  
  return {
    pendingOperations,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    toggleStaging
  };
}