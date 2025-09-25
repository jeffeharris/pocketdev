import type { GitStatus, ChangedFile } from '../../types/git';
import type { AllChangesResponse, DiffViewerResponse, FileDiffResponse } from '../../types/diff';

/**
 * GitService Interface - Git operations management
 * 
 * Handles all git-related operations within task contexts.
 * This service focuses on git status, diffs, and basic operations.
 */

export interface GitOperationOptions {
  message?: string;
  files?: string | string[];
  args?: string;
}

export interface GitOperationResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface IGitService {
  /**
   * Get git status for a task
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<GitStatus> Current git status
   */
  getGitStatus(projectId: string, taskId: string): Promise<GitStatus>;

  /**
   * Get all changes with comprehensive summary
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<AllChangesResponse> Complete change analysis
   */
  getAllChanges(projectId: string, taskId: string): Promise<AllChangesResponse>;

  /**
   * Get diff for task or specific comparison
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @param options Diff options
   * @returns Promise<DiffViewerResponse> Diff viewer data
   */
  getTaskDiff(projectId: string, taskId: string, options?: {
    compareWith?: 'working' | 'base';
  }): Promise<DiffViewerResponse>;

  /**
   * Get diff for specific file
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @param filePath Path to file
   * @param options Diff options
   * @returns Promise<FileDiffResponse> File diff data
   */
  getFileDiff(projectId: string, taskId: string, filePath: string, options?: {
    compareWith?: 'working' | 'base' | 'all';
  }): Promise<FileDiffResponse>;

  /**
   * Stage and commit changes
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @param message Commit message
   * @param options Additional options
   * @returns Promise<GitOperationResult> Operation result
   */
  stageAndCommit(projectId: string, taskId: string, message: string, options?: {
    files?: string | string[];
  }): Promise<GitOperationResult>;

  /**
   * Perform git operation
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @param operation Git operation name
   * @param options Operation options
   * @returns Promise<GitOperationResult> Operation result
   */
  performOperation(projectId: string, taskId: string, operation: string, options?: GitOperationOptions): Promise<GitOperationResult>;
}