import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PullRequestService } from '../../services/pull-request.service.js';

describe('PullRequestService', () => {
  let service;
  let mockModels;
  let mockGitService;
  let mockGithubTokenService;
  let mockEventEmitter;

  beforeEach(() => {
    // Mock GitService
    vi.mock('../../services/git-compat.js', () => ({
      GitService: vi.fn().mockImplementation(() => mockGitService)
    }));

    // Setup mock git service
    mockGitService = {
      push: vi.fn().mockResolvedValue({ success: true }),
      command: vi.fn().mockResolvedValue({ success: true, output: 'https://github.com/owner/repo/pull/123' })
    };

    // Setup mock models
    mockModels = {
      tasks: {
        findById: vi.fn().mockResolvedValue({
          id: 'task-1',
          project_id: 'project-1',
          branch: 'feature-1',
          worktree_path: '/worktree/feature-1',
          pr_number: null
        }),
        update: vi.fn()
      },
      projects: {
        findById: vi.fn().mockResolvedValue({
          id: 'project-1',
          base_branch: 'main',
          full_name: 'owner/repo'
        })
      }
    };

    mockGithubTokenService = {};
    mockEventEmitter = { emit: vi.fn() };

    service = new PullRequestService(mockModels, mockGithubTokenService, mockEventEmitter);
  });

  describe('createPullRequest', () => {
    it('creates a pull request successfully', async () => {
      mockGitService.command.mockResolvedValue({
        success: true,
        output: 'https://github.com/owner/repo/pull/123'
      });

      const result = await service.createPullRequest('task-1', 'github-token', {
        description: 'Test PR'
      });

      expect(mockGitService.push).toHaveBeenCalledWith('/worktree/feature-1', 'feature-1', { setUpstream: true });
      expect(mockGitService.command).toHaveBeenCalledWith(
        '/worktree/feature-1',
        expect.stringContaining('gh pr create')
      );
      expect(mockModels.tasks.update).toHaveBeenCalledWith('task-1', { pr_number: '123' });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('pr-created', expect.any(Object));
    });

    it('throws when task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        service.createPullRequest('non-existent', 'token')
      ).rejects.toThrow('Task not found');
    });

    it('handles push failures', async () => {
      mockGitService.push.mockResolvedValue({ 
        success: false, 
        error: 'Failed to push' 
      });

      await expect(
        service.createPullRequest('task-1', 'token')
      ).rejects.toThrow('Failed to push branch');
    });
  });

  describe('getPullRequestStatus', () => {
    beforeEach(() => {
      mockModels.tasks.findById.mockResolvedValue({
        id: 'task-1',
        pr_number: '123',
        worktree_path: '/worktree/feature-1'
      });
    });

    it('returns PR status successfully', async () => {
      mockGitService.command.mockResolvedValue({
        success: true,
        output: JSON.stringify({
          state: 'OPEN',
          mergeable: 'MERGEABLE',
          title: 'Test PR',
          url: 'https://github.com/owner/repo/pull/123'
        })
      });

      const status = await service.getPullRequestStatus('task-1', 'token');

      expect(status).toEqual({
        state: 'OPEN',
        mergeable: 'MERGEABLE',
        title: 'Test PR',
        url: 'https://github.com/owner/repo/pull/123'
      });
    });

    it('throws when no PR exists for task', async () => {
      mockModels.tasks.findById.mockResolvedValue({
        id: 'task-1',
        pr_number: null
      });

      await expect(
        service.getPullRequestStatus('task-1', 'token')
      ).rejects.toThrow('No pull request found');
    });
  });

  describe('mergePullRequest', () => {
    beforeEach(() => {
      mockModels.tasks.findById.mockResolvedValue({
        id: 'task-1',
        pr_number: '123',
        worktree_path: '/worktree/feature-1'
      });
    });

    it('merges PR with default strategy (squash)', async () => {
      await service.mergePullRequest('task-1', 'token');

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/worktree/feature-1',
        'gh pr merge 123 --squash --delete-branch'
      );
      expect(mockModels.tasks.update).toHaveBeenCalledWith('task-1', {
        merged_at: expect.any(String),
        pr_merged: true
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('pr-merged', expect.any(Object));
    });

    it('merges with custom strategy', async () => {
      await service.mergePullRequest('task-1', 'token', {
        mergeStrategy: 'rebase',
        deleteBranch: false
      });

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/worktree/feature-1',
        'gh pr merge 123 --rebase'
      );
    });
  });

  describe('updatePullRequest', () => {
    beforeEach(() => {
      mockModels.tasks.findById.mockResolvedValue({
        id: 'task-1',
        pr_number: '123',
        worktree_path: '/worktree/feature-1'
      });
    });

    it('updates PR title and body', async () => {
      await service.updatePullRequest('task-1', 'token', {
        title: 'New Title',
        body: 'New Body'
      });

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/worktree/feature-1',
        'gh pr edit 123 --title "New Title" --body "New Body"'
      );
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('pr-updated', expect.any(Object));
    });

    it('throws when no updates provided', async () => {
      await expect(
        service.updatePullRequest('task-1', 'token', {})
      ).rejects.toThrow('No updates provided');
    });
  });

  describe('closePullRequest', () => {
    beforeEach(() => {
      mockModels.tasks.findById.mockResolvedValue({
        id: 'task-1',
        pr_number: '123',
        worktree_path: '/worktree/feature-1'
      });
    });

    it('closes PR successfully', async () => {
      await service.closePullRequest('task-1', 'token');

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/worktree/feature-1',
        'gh pr close 123'
      );
      expect(mockModels.tasks.update).toHaveBeenCalledWith('task-1', {
        pr_closed: true
      });
      expect(mockEventEmitter.emit).toHaveBeenCalledWith('pr-closed', expect.any(Object));
    });
  });
});