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
import type { AllChangesResponse, DiffViewerResponse, FileDiffResponse, DiffFile, FileCategory } from '../types/diff';

export class GitService extends BaseService implements IGitService {
  private mockGitStatus: GitStatus = {
    clean: false,
    ahead: 2,
    behind: 0,
    filesChanged: 3,
    branch: 'feature/test-branch',
    upToDate: false
  };

  private mockFiles: DiffFile[] = [
    {
      path: 'src/components/Button.tsx',
      type: 'modified',
      additions: 15,
      deletions: 3,
      status: ' M',
      category: 'unstaged' as FileCategory,
      staged: false,
      unstaged: true,
      untracked: false,
      committed: false
    },
    {
      path: 'src/utils/helpers.ts',
      type: 'added',
      additions: 42,
      deletions: 0,
      status: 'A ',
      category: 'staged' as FileCategory,
      staged: true,
      unstaged: false,
      untracked: false,
      committed: false
    },
    {
      path: 'docs/README.md',
      type: 'added',
      additions: 20,
      deletions: 0,
      status: '??',
      category: 'untracked' as FileCategory,
      staged: false,
      unstaged: false,
      untracked: true,
      committed: false
    }
  ];

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Public interface - 6 simple methods following deep module principle

  async getGitStatus(projectId: string, taskId: string): Promise<GitStatus> {
    if (this.isMockEnabled) {
      return { ...this.mockGitStatus };
    }
    
    return this.get<GitStatus>(`/projects/${projectId}/tasks/${taskId}/git/status`);
  }

  async getAllChanges(projectId: string, taskId: string): Promise<AllChangesResponse> {
    if (this.isMockEnabled) {
      const stagedCount = this.mockFiles.filter(f => f.staged).length;
      const unstagedCount = this.mockFiles.filter(f => f.unstaged).length;
      const untrackedCount = this.mockFiles.filter(f => f.untracked).length;
      const committedCount = this.mockFiles.filter(f => f.committed).length;
      
      return {
        files: [...this.mockFiles],
        summary: {
          staged: stagedCount,
          unstaged: unstagedCount,
          untracked: untrackedCount,
          committed: committedCount,
          total: this.mockFiles.length,
          unpushedCommits: 2
        },
        unpushedCommits: [
          { hash: 'abc123f', message: 'Add new feature components' },
          { hash: 'def456a', message: 'Fix styling issues' }
        ]
      };
    }
    
    return this.get<AllChangesResponse>(`/projects/${projectId}/tasks/${taskId}/git/all-changes`);
  }

  async getTaskDiff(projectId: string, taskId: string, options?: {
    compareWith?: 'working' | 'base';
  }): Promise<DiffViewerResponse> {
    if (this.isMockEnabled) {
      const compareWith = options?.compareWith || 'working';
      const mockDiff = `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index 1234567..abcdefg 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,6 +1,8 @@
 import React from 'react';
+import { cn } from '../utils/cn';
 
 interface ButtonProps {
   children: React.ReactNode;
+  variant?: 'primary' | 'secondary';
   onClick?: () => void;
 }
 
@@ -8,7 +10,7 @@ export const Button: React.FC<ButtonProps> = ({
   children,
   onClick
 }) => {
-  return <button onClick={onClick}>{children}</button>;
+  return <button className={cn('btn', variant)} onClick={onClick}>{children}</button>;
 };`;

      return {
        files: this.mockFiles.map(file => ({
          ...file,
          diff: mockDiff
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
      const mockDiff = `diff --git a/${filePath} b/${filePath}
index 1234567..abcdefg 100644
--- a/${filePath}
+++ b/${filePath}
@@ -1,3 +1,5 @@
 // Original content
+// Added line 1
+// Added line 2
 function example() {
   return 'Hello World';
 }`;

      return {
        path: filePath,
        diff: mockDiff,
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
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate delay
      
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

  async performOperation(projectId: string, taskId: string, operation: string, options?: GitOperationOptions): Promise<GitOperationResult> {
    if (this.isMockEnabled) {
      // Simulate various git operations
      await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
      
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

  // Complex implementation details hidden from users

  protected initializeMockData(): void {
    this.mockGitStatus = {
      clean: false,
      ahead: 2,
      behind: 0,
      filesChanged: 3,
      branch: 'feature/test-branch',
      upToDate: false
    };

    this.mockFiles = [
      {
        path: 'src/components/Button.tsx',
        type: 'modified',
        additions: 15,
        deletions: 3,
        status: ' M',
        category: 'unstaged' as FileCategory,
        staged: false,
        unstaged: true,
        untracked: false,
        committed: false
      },
      {
        path: 'src/utils/helpers.ts',
        type: 'added',
        additions: 42,
        deletions: 0,
        status: 'A ',
        category: 'staged' as FileCategory,
        staged: true,
        unstaged: false,
        untracked: false,
        committed: false
      },
      {
        path: 'docs/README.md',
        type: 'added',
        additions: 20,
        deletions: 0,
        status: '??',
        category: 'untracked' as FileCategory,
        staged: false,
        unstaged: false,
        untracked: true,
        committed: false
      },
      {
        path: 'src/api/client.ts',
        type: 'modified',
        additions: 8,
        deletions: 12,
        status: 'MM',
        category: 'staged' as FileCategory,
        staged: true,
        unstaged: true,
        untracked: false,
        committed: false
      }
    ];
  }

  /**
   * Get current mock git status state (for testing purposes)
   * @internal
   */
  public getMockGitStatus(): GitStatus | null {
    return this.isMockEnabled ? { ...this.mockGitStatus } : null;
  }

  /**
   * Get current mock files state (for testing purposes)
   * @internal
   */
  public getMockFiles(): DiffFile[] | null {
    return this.isMockEnabled ? [...this.mockFiles] : null;
  }

  /**
   * Reset mock data to initial state (for testing purposes)
   * @internal
   */
  public resetMockState(): void {
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  /**
   * Update mock git status for testing
   * @internal
   */
  public updateMockGitStatus(status: Partial<GitStatus>): void {
    if (this.isMockEnabled) {
      this.mockGitStatus = { ...this.mockGitStatus, ...status };
    }
  }

  /**
   * Add mock file for testing
   * @internal
   */
  public addMockFile(file: DiffFile): void {
    if (this.isMockEnabled) {
      this.mockFiles.push(file);
    }
  }

  /**
   * Remove mock file for testing
   * @internal
   */
  public removeMockFile(filePath: string): void {
    if (this.isMockEnabled) {
      this.mockFiles = this.mockFiles.filter(f => f.path !== filePath);
    }
  }
}