/**
 * GitService - Git operations management
 * 
 * This service handles all git-related operations within task contexts.
 * It provides a clean interface for git status, diffs, and basic operations
 * with built-in mock support for development and testing.
 * 
 * Dependencies: None (leaf service)
 */

import { BaseService } from './base.service';
import type { IGitService, GitOperationOptions, GitOperationResult } from './interfaces/git.service.interface';
import type { GitStatus } from '../types/git';
import type { AllChangesResponse, DiffViewerResponse, FileDiffResponse } from '../types/diff';
import { 
  mockGitStatus, 
  mockFiles, 
  mockUnpushedCommits, 
  mockDiffContent, 
  mockFileDiffContent,
  mockDelay 
} from './mocks/git.mock';

export class GitService extends BaseService implements IGitService {
  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
  }

  // Public interface - 6 simple methods following deep module principle

  async getGitStatus(projectId: string, taskId: string): Promise<GitStatus> {
    if (this.isMockEnabled) {
      return { ...mockGitStatus };
    }
    
    return this.get<GitStatus>(`/projects/${projectId}/tasks/${taskId}/git/status`);
  }

  async getAllChanges(projectId: string, taskId: string): Promise<AllChangesResponse> {
    if (this.isMockEnabled) {
      const stagedCount = mockFiles.filter(f => f.staged).length;
      const unstagedCount = mockFiles.filter(f => f.unstaged).length;
      const untrackedCount = mockFiles.filter(f => f.untracked).length;
      const committedCount = mockFiles.filter(f => f.committed).length;
      
      return {
        files: [...mockFiles],
        summary: {
          staged: stagedCount,
          unstaged: unstagedCount,
          untracked: untrackedCount,
          committed: committedCount,
          total: mockFiles.length,
          unpushedCommits: mockUnpushedCommits.length
        },
        unpushedCommits: mockUnpushedCommits
      };
    }
    
    return this.get<AllChangesResponse>(`/projects/${projectId}/tasks/${taskId}/git/all-changes`);
  }

  async getTaskDiff(projectId: string, taskId: string, options?: {
    compareWith?: 'working' | 'base';
  }): Promise<DiffViewerResponse> {
    if (this.isMockEnabled) {
      const compareWith = options?.compareWith || 'working';

      return {
        files: mockFiles.map(file => ({
          ...file,
          diff: mockDiffContent
        })),
        compareWith,
        hasWorkingChanges: true
      };
    }
    
    const queryParam = options?.compareWith === 'base' ? '?compareWith=base' : '';
    return this.get<DiffViewerResponse>(
      `/projects/${projectId}/tasks/${taskId}/git/diff${queryParam}`
    );
  }

  async getFileDiff(projectId: string, taskId: string, filePath: string, options?: {
    compareWith?: 'working' | 'base' | 'all';
  }): Promise<FileDiffResponse> {
    if (this.isMockEnabled) {
      return {
        path: filePath,
        diff: mockFileDiffContent(filePath),
        hasDiff: true
      };
    }
    
    const compareWith = options?.compareWith || 'working';
    const encodedPath = encodeURIComponent(filePath);
    const queryParams = compareWith !== 'working' ? `?compareWith=${compareWith}` : '';
    
    return this.get<FileDiffResponse>(
      `/projects/${projectId}/tasks/${taskId}/git/diff/${encodedPath}${queryParams}`
    );
  }

  async stageAndCommit(projectId: string, taskId: string, message: string, options?: {
    files?: string | string[];
  }): Promise<GitOperationResult> {
    if (this.isMockEnabled) {
      // Simulate staging and committing files
      const files = options?.files || '.';
      await mockDelay(500);
      
      return {
        success: true,
        output: `Successfully staged ${Array.isArray(files) ? files.join(', ') : files} and committed with message: "${message}"`
      };
    }
    
    // First stage the files
    const stageResult = await this.performOperation(projectId, taskId, 'add', { 
      files: options?.files || '.' 
    });
    
    if (!stageResult.success) {
      return stageResult;
    }
    
    // Then commit
    return this.performOperation(projectId, taskId, 'commit', { message });
  }

  async getComprehensiveDiff(projectId: string, taskId: string): Promise<AllChangesResponse> {
    // For now, this is a stub that delegates to getAllChanges
    // TODO: Implement comprehensive diff logic if needed
    return this.getAllChanges(projectId, taskId);
  }

  async performOperation(projectId: string, taskId: string, operation: string, options?: GitOperationOptions): Promise<GitOperationResult> {
    if (this.isMockEnabled) {
      // Simulate various git operations
      await mockDelay(300);
      
      switch (operation) {
        case 'add':
          return {
            success: true,
            output: `Added files: ${options?.files || '.'}`
          };
        case 'commit':
          return {
            success: true,
            output: `Committed with message: "${options?.message}"`
          };
        case 'push':
          return {
            success: true,
            output: 'Pushed to remote repository'
          };
        case 'pull':
          return {
            success: true,
            output: 'Pulled latest changes'
          };
        case 'checkout':
          return {
            success: true,
            output: `Checked out: ${options?.args || 'branch'}`
          };
        case 'reset':
          return {
            success: true,
            output: `Reset: ${options?.args || 'HEAD'}`
          };
        case 'unstage':
          return {
            success: true,
            output: `Unstaged files: ${options?.files || '.'}`
          };
        default:
          return {
            success: false,
            output: '',
            error: `Unknown operation: ${operation}`
          };
      }
    }
    
    const payload: any = { operation };
    if (options?.message) payload.message = options.message;
    if (options?.files) payload.files = options.files;
    if (options?.args) payload.args = options.args;
    
    return this.post<GitOperationResult>(`/projects/${projectId}/tasks/${taskId}/git`, payload);
  }

}