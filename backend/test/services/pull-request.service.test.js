import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PullRequestService } from '../../services/pull-request.service.js';
import { GitService } from '../../services/git-core.service.js';

// Mock the GitService since we want to test the PullRequestService logic, not git operations
vi.mock('../../services/git-core.service.js', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    push: vi.fn(),
    createPullRequest: vi.fn(),
    command: vi.fn()
  }))
}));

describe('PullRequestService', () => {
  let pullRequestService;
  let mockModels;
  let mockGithubTokenService;
  let mockEventEmitterService;
  let mockGitService;
  let testTask;
  let testProject;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create test data
    testTask = {
      id: 'test-task-1',
      name: 'Fix authentication bug',
      project_id: 'test-project-1',
      branch: 'feature/fix-auth-bug',
      worktree_path: '/tmp/test-worktree',
      status: 'active',
      pr_url: null,
      pr_number: null
    };

    testProject = {
      id: 'test-project-1',
      name: 'Test Project',
      base_branch: 'main',
      repo_url: 'https://github.com/test/repo'
    };

    // Mock models
    mockModels = {
      tasks: {
        findById: vi.fn(),
        update: vi.fn()
      },
      projects: {
        findById: vi.fn()
      }
    };

    // Mock GitHub token service
    mockGithubTokenService = {
      getTokenFromRequest: vi.fn().mockReturnValue('test-github-token')
    };

    // Mock event emitter service
    mockEventEmitterService = {
      emit: vi.fn()
    };

    // Setup GitService mock
    mockGitService = {
      push: vi.fn(),
      createPullRequest: vi.fn(),
      command: vi.fn()
    };
    GitService.mockImplementation(() => mockGitService);

    // Create service instance
    pullRequestService = new PullRequestService(
      mockModels,
      mockGithubTokenService,
      mockEventEmitterService
    );
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with required dependencies', () => {
      expect(pullRequestService.models).toBe(mockModels);
      expect(pullRequestService.githubTokenService).toBe(mockGithubTokenService);
      expect(pullRequestService.eventEmitterService).toBe(mockEventEmitterService);
    });

    it('should work without event emitter service', () => {
      const serviceWithoutEmitter = new PullRequestService(mockModels, mockGithubTokenService);
      expect(serviceWithoutEmitter.eventEmitterService).toBe(null);
    });
  });

  describe('createPullRequest', () => {
    beforeEach(() => {
      // Setup default successful responses
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockModels.projects.findById.mockResolvedValue(testProject);
      mockModels.tasks.update.mockResolvedValue({ ...testTask, pr_url: 'https://github.com/test/repo/pull/123', pr_number: 123 });
      
      mockGitService.push.mockResolvedValue({ success: true });
      mockGitService.createPullRequest.mockResolvedValue({
        success: true,
        output: 'https://github.com/test/repo/pull/123'
      });
    });

    it('should create a pull request successfully', async () => {
      const result = await pullRequestService.createPullRequest('test-task-1', 'github-token', {
        description: 'Fix authentication issues in the login system'
      });

      // Verify task and project lookup
      expect(mockModels.tasks.findById).toHaveBeenCalledWith('test-task-1');
      expect(mockModels.projects.findById).toHaveBeenCalledWith('test-project-1');

      // Verify GitService instantiation with token
      expect(GitService).toHaveBeenCalledWith('github-token');

      // Verify git push
      expect(mockGitService.push).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'feature/fix-auth-bug',
        { setUpstream: true }
      );

      // Verify PR creation
      expect(mockGitService.createPullRequest).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'Fix authentication bug',
        'Fix authentication issues in the login system',
        'main'
      );

      // Verify task update
      expect(mockModels.tasks.update).toHaveBeenCalledWith('test-task-1', {
        pr_url: 'https://github.com/test/repo/pull/123',
        pr_number: 123
      });

      // Verify event emission
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.created', {
        taskId: 'test-task-1',
        projectId: 'test-project-1',
        prNumber: 123,
        prUrl: 'https://github.com/test/repo/pull/123',
        title: 'Fix authentication bug'
      });

      // Verify return value
      expect(result).toEqual({
        id: 123,
        url: 'https://github.com/test/repo/pull/123',
        title: 'Fix authentication bug',
        description: 'Fix authentication issues in the login system',
        state: 'open',
        mergeable: true,
        conflicts: false
      });
    });

    it('should generate default PR body when no description provided', async () => {
      await pullRequestService.createPullRequest('test-task-1', 'github-token');

      expect(mockGitService.createPullRequest).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'Fix authentication bug',
        'Task: Fix authentication bug\nBranch: feature/fix-auth-bug\n\nCreated by PocketDev',
        'main'
      );
    });

    it('should handle git push failure', async () => {
      mockGitService.push.mockResolvedValue({
        success: false,
        error: 'Permission denied'
      });

      await expect(
        pullRequestService.createPullRequest('test-task-1', 'github-token')
      ).rejects.toThrow('Failed to push branch: Permission denied');
    });

    it('should ignore "Everything up-to-date" push errors', async () => {
      mockGitService.push.mockResolvedValue({
        success: false,
        error: 'Everything up-to-date'
      });

      const result = await pullRequestService.createPullRequest('test-task-1', 'github-token');
      expect(result.id).toBe(123);
    });

    it('should handle PR creation failure', async () => {
      mockGitService.createPullRequest.mockResolvedValue({
        success: false,
        error: 'Branch already has a pull request'
      });

      await expect(
        pullRequestService.createPullRequest('test-task-1', 'github-token')
      ).rejects.toThrow('Failed to create pull request: Branch already has a pull request');
    });

    it('should handle task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        pullRequestService.createPullRequest('non-existent-task', 'github-token')
      ).rejects.toThrow('Task not found');
    });

    it('should handle project not found', async () => {
      mockModels.projects.findById.mockResolvedValue(null);

      await expect(
        pullRequestService.createPullRequest('test-task-1', 'github-token')
      ).rejects.toThrow('Project not found');
    });

    it('should extract PR info from GitHub CLI output correctly', async () => {
      mockGitService.createPullRequest.mockResolvedValue({
        success: true,
        output: 'Pull request created: https://github.com/owner/repo/pull/456\nView in browser: https://github.com/owner/repo/pull/456'
      });

      mockModels.tasks.update.mockResolvedValue({ ...testTask, pr_url: 'https://github.com/owner/repo/pull/456', pr_number: 456 });

      const result = await pullRequestService.createPullRequest('test-task-1', 'github-token');

      expect(result.id).toBe(456);
      expect(result.url).toBe('https://github.com/owner/repo/pull/456');
    });

    it('should handle malformed GitHub CLI output gracefully', async () => {
      mockGitService.createPullRequest.mockResolvedValue({
        success: true,
        output: 'Some unexpected output without URL'
      });

      const result = await pullRequestService.createPullRequest('test-task-1', 'github-token');

      // Should not update task if no PR info extracted
      expect(mockModels.tasks.update).not.toHaveBeenCalled();
      expect(result.id).toBe(null);
      expect(result.url).toBe(null);
    });
  });

  describe('getPullRequestStatus', () => {
    beforeEach(() => {
      testTask.pr_number = 123;
      mockModels.tasks.findById.mockResolvedValue(testTask);
    });

    it('should get PR status successfully', async () => {
      const mockPRData = {
        state: 'open',
        mergeable: 'MERGEABLE',
        title: 'Fix authentication bug',
        url: 'https://github.com/test/repo/pull/123'
      };

      mockGitService.command.mockResolvedValue({
        success: true,
        output: JSON.stringify(mockPRData)
      });

      const result = await pullRequestService.getPullRequestStatus('test-task-1', 'github-token');

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr view 123 --json state,mergeable,title,url'
      );

      expect(result).toEqual({
        id: 123,
        url: 'https://github.com/test/repo/pull/123',
        title: 'Fix authentication bug',
        state: 'open',
        mergeable: true,
        conflicts: false
      });
    });

    it('should handle conflicting PR status', async () => {
      const mockPRData = {
        state: 'open',
        mergeable: 'CONFLICTING',
        title: 'Fix authentication bug',
        url: 'https://github.com/test/repo/pull/123'
      };

      mockGitService.command.mockResolvedValue({
        success: true,
        output: JSON.stringify(mockPRData)
      });

      const result = await pullRequestService.getPullRequestStatus('test-task-1', 'github-token');

      expect(result.mergeable).toBe(false);
      expect(result.conflicts).toBe(true);
    });

    it('should handle unknown mergeable status', async () => {
      const mockPRData = {
        state: 'open',
        mergeable: 'UNKNOWN',
        title: 'Fix authentication bug',
        url: 'https://github.com/test/repo/pull/123'
      };

      mockGitService.command.mockResolvedValue({
        success: true,
        output: JSON.stringify(mockPRData)
      });

      const result = await pullRequestService.getPullRequestStatus('test-task-1', 'github-token');

      expect(result.mergeable).toBe(false);
      expect(result.conflicts).toBe(false);
    });

    it('should handle task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        pullRequestService.getPullRequestStatus('non-existent-task', 'github-token')
      ).rejects.toThrow('Task not found');
    });

    it('should handle task without PR', async () => {
      testTask.pr_number = null;
      mockModels.tasks.findById.mockResolvedValue(testTask);

      await expect(
        pullRequestService.getPullRequestStatus('test-task-1', 'github-token')
      ).rejects.toThrow('No pull request found for this task');
    });

    it('should handle GitHub CLI command failure', async () => {
      mockGitService.command.mockResolvedValue({
        success: false,
        error: 'PR not found'
      });

      await expect(
        pullRequestService.getPullRequestStatus('test-task-1', 'github-token')
      ).rejects.toThrow('Failed to get PR status: PR not found');
    });

    it('should handle malformed JSON response', async () => {
      mockGitService.command.mockResolvedValue({
        success: true,
        output: 'invalid json response'
      });

      await expect(
        pullRequestService.getPullRequestStatus('test-task-1', 'github-token')
      ).rejects.toThrow('Failed to parse PR data from GitHub');
    });
  });

  describe('mergePullRequest', () => {
    beforeEach(() => {
      testTask.pr_number = 123;
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockModels.tasks.update.mockResolvedValue({ ...testTask, status: 'merged' });
      mockGitService.command.mockResolvedValue({
        success: true,
        output: 'Pull request #123 merged successfully'
      });
    });

    it('should merge PR with default settings (squash, delete branch)', async () => {
      const result = await pullRequestService.mergePullRequest('test-task-1', 'github-token');

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr merge 123 --squash --delete-branch'
      );

      expect(mockModels.tasks.update).toHaveBeenCalledWith('test-task-1', {
        status: 'merged',
        merged_at: expect.any(String)
      });

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.merged', {
        taskId: 'test-task-1',
        projectId: 'test-project-1',
        prNumber: 123,
        strategy: 'squash'
      });

      expect(result).toEqual({
        success: true,
        message: 'Pull request #123 merged successfully',
        output: 'Pull request #123 merged successfully'
      });
    });

    it('should merge with merge strategy', async () => {
      await pullRequestService.mergePullRequest('test-task-1', 'github-token', {
        strategy: 'merge',
        deleteSourceBranch: false
      });

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr merge 123 --merge'
      );
    });

    it('should merge with rebase strategy', async () => {
      await pullRequestService.mergePullRequest('test-task-1', 'github-token', {
        strategy: 'rebase',
        deleteSourceBranch: true
      });

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr merge 123 --rebase --delete-branch'
      );
    });

    it('should handle task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        pullRequestService.mergePullRequest('non-existent-task', 'github-token')
      ).rejects.toThrow('Task not found');
    });

    it('should handle task without PR', async () => {
      testTask.pr_number = null;
      mockModels.tasks.findById.mockResolvedValue(testTask);

      await expect(
        pullRequestService.mergePullRequest('test-task-1', 'github-token')
      ).rejects.toThrow('No pull request found for this task');
    });

    it('should handle merge failure', async () => {
      mockGitService.command.mockResolvedValue({
        success: false,
        error: 'Merge conflicts detected'
      });

      await expect(
        pullRequestService.mergePullRequest('test-task-1', 'github-token')
      ).rejects.toThrow('Failed to merge pull request: Merge conflicts detected');
    });
  });

  describe('updatePullRequest', () => {
    beforeEach(() => {
      testTask.pr_number = 123;
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockGitService.command.mockResolvedValue({
        success: true,
        output: 'Pull request updated'
      });
    });

    it('should update PR title', async () => {
      const result = await pullRequestService.updatePullRequest('test-task-1', 'github-token', {
        title: 'Updated title'
      });

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr edit 123 --title "Updated title"'
      );

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.updated', {
        taskId: 'test-task-1',
        projectId: 'test-project-1',
        prNumber: 123,
        updates: { title: 'Updated title' }
      });

      expect(result).toEqual({
        success: true,
        message: 'Pull request #123 updated successfully'
      });
    });

    it('should update PR body', async () => {
      await pullRequestService.updatePullRequest('test-task-1', 'github-token', {
        body: 'Updated description'
      });

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr edit 123 --body "Updated description"'
      );
    });

    it('should update both title and body', async () => {
      await pullRequestService.updatePullRequest('test-task-1', 'github-token', {
        title: 'New title',
        body: 'New description'
      });

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr edit 123 --title "New title" --body "New description"'
      );
    });

    it('should handle no updates provided', async () => {
      await expect(
        pullRequestService.updatePullRequest('test-task-1', 'github-token', {})
      ).rejects.toThrow('No updates provided');
    });

    it('should handle task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        pullRequestService.updatePullRequest('non-existent-task', 'github-token', { title: 'test' })
      ).rejects.toThrow('Task not found');
    });

    it('should handle task without PR', async () => {
      testTask.pr_number = null;
      mockModels.tasks.findById.mockResolvedValue(testTask);

      await expect(
        pullRequestService.updatePullRequest('test-task-1', 'github-token', { title: 'test' })
      ).rejects.toThrow('No pull request found for this task');
    });

    it('should handle update failure', async () => {
      mockGitService.command.mockResolvedValue({
        success: false,
        error: 'Update failed'
      });

      await expect(
        pullRequestService.updatePullRequest('test-task-1', 'github-token', { title: 'test' })
      ).rejects.toThrow('Failed to update pull request: Update failed');
    });
  });

  describe('closePullRequest', () => {
    beforeEach(() => {
      testTask.pr_number = 123;
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockModels.tasks.update.mockResolvedValue({ ...testTask, status: 'closed' });
      mockGitService.command.mockResolvedValue({
        success: true,
        output: 'Pull request closed'
      });
    });

    it('should close PR successfully', async () => {
      const result = await pullRequestService.closePullRequest('test-task-1', 'github-token');

      expect(mockGitService.command).toHaveBeenCalledWith(
        '/tmp/test-worktree',
        'gh pr close 123'
      );

      expect(mockModels.tasks.update).toHaveBeenCalledWith('test-task-1', {
        status: 'closed'
      });

      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.closed', {
        taskId: 'test-task-1',
        projectId: 'test-project-1',
        prNumber: 123
      });

      expect(result).toEqual({
        success: true,
        message: 'Pull request #123 closed successfully'
      });
    });

    it('should handle task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        pullRequestService.closePullRequest('non-existent-task', 'github-token')
      ).rejects.toThrow('Task not found');
    });

    it('should handle task without PR', async () => {
      testTask.pr_number = null;
      mockModels.tasks.findById.mockResolvedValue(testTask);

      await expect(
        pullRequestService.closePullRequest('test-task-1', 'github-token')
      ).rejects.toThrow('No pull request found for this task');
    });

    it('should handle close failure', async () => {
      mockGitService.command.mockResolvedValue({
        success: false,
        error: 'Failed to close PR'
      });

      await expect(
        pullRequestService.closePullRequest('test-task-1', 'github-token')
      ).rejects.toThrow('Failed to close pull request: Failed to close PR');
    });
  });

  describe('Private Helper Methods', () => {
    describe('_generatePRTitle', () => {
      it('should use task name if available', () => {
        const title = pullRequestService._generatePRTitle(testTask);
        expect(title).toBe('Fix authentication bug');
      });

      it('should use branch name if task name is not available', () => {
        const taskWithoutName = { ...testTask, name: null, branch: 'feature/important-fix' };
        const title = pullRequestService._generatePRTitle(taskWithoutName);
        expect(title).toBe('Updates from task: feature/important-fix');
      });
    });

    describe('_generatePRBody', () => {
      it('should use provided description', () => {
        const body = pullRequestService._generatePRBody(testTask, 'Custom description');
        expect(body).toBe('Custom description');
      });

      it('should generate default body if no description provided', () => {
        const body = pullRequestService._generatePRBody(testTask, null);
        expect(body).toBe('Task: Fix authentication bug\nBranch: feature/fix-auth-bug\n\nCreated by PocketDev');
      });
    });

    describe('_extractPRInfoFromOutput', () => {
      it('should extract PR URL and number correctly', () => {
        const output = 'Pull request created successfully: https://github.com/owner/repo/pull/456';
        const info = pullRequestService._extractPRInfoFromOutput(output);
        expect(info).toEqual({
          url: 'https://github.com/owner/repo/pull/456',
          number: 456
        });
      });

      it('should handle output without PR URL', () => {
        const output = 'Some output without URL';
        const info = pullRequestService._extractPRInfoFromOutput(output);
        expect(info).toEqual({
          url: null,
          number: null
        });
      });
    });

    describe('_buildMergeCommand', () => {
      it('should build squash merge command with delete branch', () => {
        const command = pullRequestService._buildMergeCommand(123, 'squash', true);
        expect(command).toBe('gh pr merge 123 --squash --delete-branch');
      });

      it('should build merge command without delete branch', () => {
        const command = pullRequestService._buildMergeCommand(123, 'merge', false);
        expect(command).toBe('gh pr merge 123 --merge');
      });

      it('should build rebase command', () => {
        const command = pullRequestService._buildMergeCommand(123, 'rebase', true);
        expect(command).toBe('gh pr merge 123 --rebase --delete-branch');
      });
    });

    describe('_emitEvent', () => {
      it('should emit event when event emitter service is available', () => {
        pullRequestService._emitEvent('test.event', { data: 'test' });
        expect(mockEventEmitterService.emit).toHaveBeenCalledWith('test.event', { data: 'test' });
      });

      it('should not throw when event emitter service is null', () => {
        const serviceWithoutEmitter = new PullRequestService(mockModels, mockGithubTokenService, null);
        expect(() => {
          serviceWithoutEmitter._emitEvent('test.event', { data: 'test' });
        }).not.toThrow();
      });
    });
  });

  describe('Service Architecture', () => {
    it('should follow deep module principles with limited public methods', () => {
      const publicMethods = Object.getOwnPropertyNames(PullRequestService.prototype)
        .filter(name => name !== 'constructor' && !name.startsWith('_'));
      
      // Following deep module principles: simple interface (max ~10 methods)
      expect(publicMethods.length).toBeLessThanOrEqual(10);
      expect(publicMethods).toContain('createPullRequest');
      expect(publicMethods).toContain('getPullRequestStatus');
      expect(publicMethods).toContain('mergePullRequest');
      expect(publicMethods).toContain('updatePullRequest');
      expect(publicMethods).toContain('closePullRequest');
    });

    it('should use dependency injection properly', () => {
      expect(pullRequestService.models).toBeDefined();
      expect(pullRequestService.githubTokenService).toBeDefined();
      expect(pullRequestService.eventEmitterService).toBeDefined();
    });

    it('should hide complexity behind simple interface', () => {
      // The service should provide simple methods that hide the complexity
      // of GitHub CLI interactions, token management, and error handling
      expect(typeof pullRequestService.createPullRequest).toBe('function');
      expect(typeof pullRequestService.getPullRequestStatus).toBe('function');
      expect(typeof pullRequestService.mergePullRequest).toBe('function');
      expect(typeof pullRequestService.updatePullRequest).toBe('function');
      expect(typeof pullRequestService.closePullRequest).toBe('function');
      
      // Private helper methods should not be exposed
      const privateMethods = Object.getOwnPropertyNames(PullRequestService.prototype)
        .filter(name => name.startsWith('_'));
      
      expect(privateMethods.length).toBeGreaterThan(0); // Should have private helpers
      expect(privateMethods).toContain('_generatePRTitle');
      expect(privateMethods).toContain('_generatePRBody');
      expect(privateMethods).toContain('_extractPRInfoFromOutput');
      expect(privateMethods).toContain('_buildMergeCommand');
      expect(privateMethods).toContain('_emitEvent');
    });
  });

  describe('Integration Patterns', () => {
    it('should handle GitHub CLI authentication via GitService', async () => {
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockModels.projects.findById.mockResolvedValue(testProject);
      mockGitService.push.mockResolvedValue({ success: true });
      mockGitService.createPullRequest.mockResolvedValue({
        success: true,
        output: 'https://github.com/test/repo/pull/123'
      });

      await pullRequestService.createPullRequest('test-task-1', 'custom-github-token');

      // Verify GitService was instantiated with the provided token
      expect(GitService).toHaveBeenCalledWith('custom-github-token');
    });

    it('should handle timestamps correctly for merge operations', async () => {
      const beforeMerge = new Date();
      
      testTask.pr_number = 123;
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockGitService.command.mockResolvedValue({ success: true, output: 'merged' });

      await pullRequestService.mergePullRequest('test-task-1', 'github-token');

      const afterMerge = new Date();
      const updateCall = mockModels.tasks.update.mock.calls[0][1];
      
      expect(updateCall.merged_at).toBeDefined();
      expect(typeof updateCall.merged_at).toBe('string');
      
      // Convert timestamp string back to date for comparison
      const mergedAtDate = new Date(updateCall.merged_at);
      expect(mergedAtDate.getTime()).toBeGreaterThanOrEqual(beforeMerge.getTime());
      expect(mergedAtDate.getTime()).toBeLessThanOrEqual(afterMerge.getTime());
    });

    it('should handle event emission for all major operations', async () => {
      // Test createPullRequest event emission
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockModels.projects.findById.mockResolvedValue(testProject);
      mockGitService.push.mockResolvedValue({ success: true });
      mockGitService.createPullRequest.mockResolvedValue({
        success: true,
        output: 'https://github.com/test/repo/pull/123'
      });
      
      await pullRequestService.createPullRequest('test-task-1', 'github-token');
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.created', expect.any(Object));

      // Reset and test mergePullRequest event emission
      vi.clearAllMocks();
      testTask.pr_number = 123;
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockGitService.command.mockResolvedValue({ success: true, output: 'merged' });
      
      await pullRequestService.mergePullRequest('test-task-1', 'github-token');
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.merged', expect.any(Object));

      // Reset and test updatePullRequest event emission
      vi.clearAllMocks();
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockGitService.command.mockResolvedValue({ success: true, output: 'updated' });
      
      await pullRequestService.updatePullRequest('test-task-1', 'github-token', { title: 'test' });
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.updated', expect.any(Object));

      // Reset and test closePullRequest event emission
      vi.clearAllMocks();
      mockModels.tasks.findById.mockResolvedValue(testTask);
      mockGitService.command.mockResolvedValue({ success: true, output: 'closed' });
      
      await pullRequestService.closePullRequest('test-task-1', 'github-token');
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('pr.closed', expect.any(Object));
    });
  });
});