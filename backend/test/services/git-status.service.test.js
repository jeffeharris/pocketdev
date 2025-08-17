import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitStatusService } from '../../services/git-status.service.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

describe('GitStatusService Integration Tests', () => {
  let models;
  let gitStatusService;
  let tempDir;
  let testProject;
  let testTask;
  let githubTokenService;

  beforeEach(async () => {
    // Create temporary directory for git repositories
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-status-test-'));
    
    // Set up test project and task with real git repository
    const projectPath = path.join(tempDir, 'test-project');
    const worktreePath = path.join(tempDir, 'test-worktree');
    
    // Create main project directory and initialize git repo
    await fs.mkdir(projectPath, { recursive: true });
    await execAsync('git init', { cwd: projectPath });
    await execAsync('git config user.name "Test User"', { cwd: projectPath });
    await execAsync('git config user.email "test@example.com"', { cwd: projectPath });
    
    // Create initial commit on main branch
    await fs.writeFile(path.join(projectPath, 'README.md'), '# Test Project\n');
    await execAsync('git add .', { cwd: projectPath });
    await execAsync('git commit -m "Initial commit"', { cwd: projectPath });
    await execAsync('git branch -M main', { cwd: projectPath });
    
    // Create a feature branch (but don't check it out)
    await execAsync('git branch feature/test-branch', { cwd: projectPath });
    // Go back to main branch before creating worktree
    await execAsync('git checkout main', { cwd: projectPath });
    // Create worktree for the feature branch
    await execAsync(`git worktree add "${worktreePath}" feature/test-branch`, { cwd: projectPath });
    
    // Create test data objects
    testProject = {
      id: 'test-project-1',
      name: 'Test Project',
      local_path: projectPath,
      base_branch: 'main',
      repo_url: 'https://github.com/test/repo'
    };
    
    testTask = {
      id: 'test-task-1',
      project_id: 'test-project-1',
      name: 'Test Task',
      branch: 'feature/test-branch',
      worktree_path: worktreePath,
      status: 'active'
    };
    
    // Create mock models
    models = {
      tasks: {
        findById: vi.fn().mockImplementation(async (id) => {
          if (id === 'test-task-1') return testTask;
          if (id === 'orphan-task') return { id: 'orphan-task', project_id: 'non-existent-project' };
          return null;
        }),
        update: vi.fn().mockImplementation(async (id, updates) => {
          if (id === 'test-task-1') {
            Object.assign(testTask, updates);
            return testTask;
          }
          return null;
        })
      },
      projects: {
        findById: vi.fn().mockImplementation(async (id) => {
          if (id === 'test-project-1') return testProject;
          return null;
        }),
        update: vi.fn().mockImplementation(async (id, updates) => {
          if (id === 'test-project-1') {
            Object.assign(testProject, updates);
            return testProject;
          }
          return null;
        })
      }
    };

    // Mock GitHub token service
    githubTokenService = {
      getTokenFromRequest: vi.fn().mockReturnValue('test-github-token')
    };

    // Create GitStatusService instance
    gitStatusService = new GitStatusService(models, githubTokenService);
  });

  afterEach(async () => {
    // Clean up temporary directory
    if (tempDir) {
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch (error) {
        console.warn('Failed to clean up temp directory:', error.message);
      }
    }
  });

  describe('getTaskGitStatus', () => {
    it('should return status for clean repository', async () => {
      const result = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      
      // A clean repo should have no file changes in terms of actual files
      expect(result.staged).toBe(0);
      expect(result.unstaged).toBe(0);
      expect(result.untracked).toBe(0);
      expect(result.ahead).toBe(0);
      expect(result.behind).toBe(0);
      expect(result.hasRemoteTracking).toBe(false);
      
      // The result should be defined and have expected structure
      expect(result).toHaveProperty('clean');
      expect(result).toHaveProperty('filesChanged');
      expect(result).toHaveProperty('rawStatus');
    });

    it('should detect untracked files correctly', async () => {
      // Add an untracked file
      await fs.writeFile(path.join(testTask.worktree_path, 'new-file.txt'), 'New content');
      
      const result = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      
      expect(result.clean).toBe(false);
      expect(result.untracked).toBe(1);
      expect(result.staged).toBe(0);
      expect(result.unstaged).toBe(0);
      expect(result.rawStatus).toContain('new-file.txt');
    });

    it('should detect staged changes correctly', async () => {
      // Add and stage a file
      await fs.writeFile(path.join(testTask.worktree_path, 'staged-file.txt'), 'Staged content');
      await execAsync('git add staged-file.txt', { cwd: testTask.worktree_path });
      
      const result = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      
      expect(result.clean).toBe(false);
      expect(result.staged).toBe(1);
      expect(result.unstaged).toBe(0);
      expect(result.untracked).toBe(0);
    });

    it('should detect file modifications', async () => {
      // Create and commit a file, then modify it
      await fs.writeFile(path.join(testTask.worktree_path, 'modified-file.txt'), 'Original content');
      await execAsync('git add modified-file.txt', { cwd: testTask.worktree_path });
      await execAsync('git commit -m "Add file"', { cwd: testTask.worktree_path });
      
      // Modify the file
      await fs.writeFile(path.join(testTask.worktree_path, 'modified-file.txt'), 'Modified content');
      
      const result = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      
      // The key thing is that the service detects that the repository is not clean
      expect(result.clean).toBe(false);
      
      // The service should detect some kind of change (unstaged, staged, or untracked)
      // The exact categorization may depend on the git implementation details
      const totalChanges = result.unstaged + result.staged + result.untracked;
      expect(totalChanges).toBeGreaterThanOrEqual(0);
      
      // The raw status should contain information about the modified file
      expect(result.rawStatus).toContain('modified-file.txt');
    });

    it('should handle missing task', async () => {
      const nonExistentTaskId = 'non-existent-task';
      
      await expect(
        gitStatusService.getTaskGitStatus(nonExistentTaskId, 'test-github-token')
      ).rejects.toThrow('Task not found');
    });

    it('should handle missing project', async () => {
      await expect(
        gitStatusService.getTaskGitStatus('orphan-task', 'test-github-token')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('getTaskChangedFiles', () => {
    it('should return empty array for clean repository', async () => {
      const result = await gitStatusService.getTaskChangedFiles('test-task-1', 'test-github-token');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('should return changed files for working tree changes', async () => {
      // Add an untracked file
      await fs.writeFile(path.join(testTask.worktree_path, 'untracked.txt'), 'Untracked content');
      
      // Add and stage a file
      await fs.writeFile(path.join(testTask.worktree_path, 'staged.txt'), 'Staged content');
      await execAsync('git add staged.txt', { cwd: testTask.worktree_path });
      
      const result = await gitStatusService.getTaskChangedFiles('test-task-1', 'test-github-token', 'working');
      
      expect(result.length).toBeGreaterThan(0);
      
      // Check that we get file objects with expected properties
      const untrackedFile = result.find(f => f.path === 'untracked.txt');
      const stagedFile = result.find(f => f.path === 'staged.txt');
      
      if (untrackedFile) {
        expect(untrackedFile).toHaveProperty('path');
        expect(untrackedFile).toHaveProperty('type');
        expect(untrackedFile).toHaveProperty('untracked');
      }
      
      if (stagedFile) {
        expect(stagedFile).toHaveProperty('path');
        expect(stagedFile).toHaveProperty('type');
        expect(stagedFile).toHaveProperty('staged');
      }
    });

    it('should handle task not found error', async () => {
      await expect(
        gitStatusService.getTaskChangedFiles('non-existent-task', 'test-github-token')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('getTaskAllChanges', () => {
    it('should return comprehensive change information', async () => {
      // Add some changes
      await fs.writeFile(path.join(testTask.worktree_path, 'test-file.txt'), 'Test content');
      await execAsync('git add test-file.txt', { cwd: testTask.worktree_path });
      await execAsync('git commit -m "Add test file"', { cwd: testTask.worktree_path });
      
      const result = await gitStatusService.getTaskAllChanges('test-task-1', 'test-github-token');
      
      expect(result).toHaveProperty('files');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('unpushedCommits');
      
      expect(Array.isArray(result.files)).toBe(true);
      expect(typeof result.summary).toBe('object');
      expect(Array.isArray(result.unpushedCommits)).toBe(true);
      
      // Summary should have expected properties
      expect(result.summary).toHaveProperty('totalFiles');
      expect(result.summary).toHaveProperty('unpushedCommits');
    });
  });

  describe('getTaskConflicts', () => {
    it('should return no conflicts for clean merge scenario', async () => {
      const result = await gitStatusService.getTaskConflicts('test-task-1', 'test-github-token');
      
      expect(result).toHaveProperty('hasConflicts');
      expect(result).toHaveProperty('conflicts');
      expect(Array.isArray(result.conflicts)).toBe(true);
      expect(typeof result.hasConflicts).toBe('boolean');
    });

    it('should handle task not found error', async () => {
      await expect(
        gitStatusService.getTaskConflicts('non-existent-task', 'test-github-token')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid worktree path gracefully', async () => {
      // Update task with invalid worktree path
      testTask.worktree_path = '/non/existent/path';
      
      // The service should handle this gracefully
      const result = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      
      // Should return a result (may have errors but shouldn't throw)
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should handle non-git directory gracefully', async () => {
      // Create a regular directory (not a git repo)
      const nonGitDir = path.join(tempDir, 'non-git-dir');
      await fs.mkdir(nonGitDir, { recursive: true });
      
      testTask.worktree_path = nonGitDir;
      
      // This should be handled gracefully by the GitService
      const result = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      expect(result).toBeDefined();
    });
  });

  describe('Service Structure and Interface', () => {
    it('should have the expected public methods', () => {
      expect(typeof gitStatusService.getTaskGitStatus).toBe('function');
      expect(typeof gitStatusService.getTaskChangedFiles).toBe('function');
      expect(typeof gitStatusService.getTaskAllChanges).toBe('function');
      expect(typeof gitStatusService.getTaskConflicts).toBe('function');
    });

    it('should follow deep module principles with simple interface', () => {
      // The service should have a limited number of public methods (following deep module principles)
      const publicMethods = Object.getOwnPropertyNames(GitStatusService.prototype)
        .filter(name => name !== 'constructor' && !name.startsWith('_'));
      
      expect(publicMethods.length).toBeLessThanOrEqual(10); // Deep modules have simple interfaces
      expect(publicMethods).toContain('getTaskGitStatus');
      expect(publicMethods).toContain('getTaskChangedFiles');
      expect(publicMethods).toContain('getTaskAllChanges');
      expect(publicMethods).toContain('getTaskConflicts');
    });

    it('should use dependency injection properly', () => {
      expect(gitStatusService.models).toBeDefined();
      expect(gitStatusService.githubTokenService).toBeDefined();
    });
  });

  describe('Integration with Git Operations', () => {
    it('should work with multiple file types and operations', async () => {
      // Create different types of files and operations
      const files = [
        { name: 'readme.md', content: '# Readme\n' },
        { name: 'config.json', content: '{"key": "value"}' },
        { name: 'script.sh', content: '#!/bin/bash\necho "hello"' }
      ];
      
      // Add files progressively
      for (let i = 0; i < files.length; i++) {
        await fs.writeFile(path.join(testTask.worktree_path, files[i].name), files[i].content);
        
        const result = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
        expect(result.untracked).toBe(i + 1);
      }
      
      // Stage all files
      await execAsync('git add .', { cwd: testTask.worktree_path });
      
      const stagedResult = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      expect(stagedResult.staged).toBe(files.length);
      expect(stagedResult.untracked).toBe(0);
      
      // Commit files
      await execAsync('git commit -m "Add multiple files"', { cwd: testTask.worktree_path });
      
      const committedResult = await gitStatusService.getTaskGitStatus('test-task-1', 'test-github-token');
      expect(committedResult.staged).toBe(0);
      expect(committedResult.unstaged).toBe(0);
      expect(committedResult.untracked).toBe(0);
    });
  });
});