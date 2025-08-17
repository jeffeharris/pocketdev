import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GitStatusService } from '../../services/git-status.service.js';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';

const execAsync = promisify(exec);

describe('GitStatusService', () => {
  let service;
  let mockModels;
  let mockGithubTokenService;
  let tempDir;
  let projectPath;
  let worktreePath;

  beforeEach(async () => {
    // Create temp directory for real git operations
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'git-status-test-'));
    projectPath = path.join(tempDir, 'test-project');
    worktreePath = path.join(tempDir, 'test-worktree');

    // Initialize git repo
    await fs.mkdir(projectPath, { recursive: true });
    await execAsync('git init', { cwd: projectPath });
    await execAsync('git config user.name "Test User"', { cwd: projectPath });
    await execAsync('git config user.email "test@example.com"', { cwd: projectPath });
    
    // Create initial commit
    await fs.writeFile(path.join(projectPath, 'README.md'), '# Test Project');
    await execAsync('git add README.md', { cwd: projectPath });
    await execAsync('git commit -m "Initial commit"', { cwd: projectPath });
    
    // Create worktree
    await execAsync(`git worktree add ${worktreePath} -b test-feature`, { cwd: projectPath });

    // Setup mocks
    mockModels = {
      tasks: {
        findById: vi.fn().mockResolvedValue({
          id: 'task-1',
          project_id: 'project-1',
          branch: 'test-feature',
          worktree_path: worktreePath
        })
      },
      projects: {
        findById: vi.fn().mockResolvedValue({
          id: 'project-1',
          path: projectPath,
          base_branch: 'main'
        })
      }
    };

    mockGithubTokenService = {};

    service = new GitStatusService(mockModels, mockGithubTokenService);
  });

  afterEach(async () => {
    // Cleanup
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe('getTaskGitStatus', () => {
    it('returns clean status for repository with no changes', async () => {
      const status = await service.getTaskGitStatus('task-1', 'token');

      expect(status).toMatchObject({
        modified: [],
        created: [],
        deleted: [],
        renamed: [],
        isClean: true,
        hasConflicts: false
      });
    });

    it('detects untracked and modified files', async () => {
      // Create untracked file
      await fs.writeFile(path.join(worktreePath, 'new-file.js'), 'console.log("new");');
      
      // Modify existing file
      await fs.appendFile(path.join(worktreePath, 'README.md'), '\nModified content');

      const status = await service.getTaskGitStatus('task-1', 'token');

      expect(status.not_added).toContain('new-file.js');
      expect(status.modified).toContain('README.md');
      expect(status.isClean).toBe(false);
    });

    it('throws when task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        service.getTaskGitStatus('non-existent', 'token')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('getTaskChangedFiles', () => {
    it('returns empty array for clean repository', async () => {
      const changes = await service.getTaskChangedFiles('task-1', 'token');
      
      expect(changes).toEqual([]);
    });

    it('returns list of changed files', async () => {
      // Create changes
      await fs.writeFile(path.join(worktreePath, 'new.js'), 'new file');
      await fs.appendFile(path.join(worktreePath, 'README.md'), '\nchanged');
      
      const changes = await service.getTaskChangedFiles('task-1', 'token');
      
      expect(changes).toHaveLength(2);
      expect(changes).toEqual(
        expect.arrayContaining(['new.js', 'README.md'])
      );
    });
  });

  describe('getTaskAllChanges', () => {
    it('returns comprehensive change information', async () => {
      // Stage a file
      await fs.writeFile(path.join(worktreePath, 'staged.js'), 'staged content');
      await execAsync('git add staged.js', { cwd: worktreePath });
      
      // Create unstaged change
      await fs.writeFile(path.join(worktreePath, 'unstaged.js'), 'unstaged content');

      const allChanges = await service.getTaskAllChanges('task-1', 'token');

      expect(allChanges).toMatchObject({
        status: expect.objectContaining({
          staged: expect.arrayContaining(['staged.js']),
          not_added: expect.arrayContaining(['unstaged.js'])
        }),
        diff: expect.any(Object),
        conflicts: expect.any(Array),
        canMerge: expect.any(Boolean)
      });
    });
  });

  describe('getTaskConflicts', () => {
    it('returns empty array when no conflicts exist', async () => {
      const conflicts = await service.getTaskConflicts('task-1', 'token');
      
      expect(conflicts).toEqual([]);
    });
  });
});