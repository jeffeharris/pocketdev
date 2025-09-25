import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TaskService } from '../../services/task.service.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os';

// Mock GitService
vi.mock('../../services/git-compat.js', () => ({
  GitService: vi.fn().mockImplementation(() => ({
    configureCredentials: vi.fn().mockResolvedValue(),
    getStatus: vi.fn().mockResolvedValue({ output: '' }),
    getUnpushedCommits: vi.fn().mockResolvedValue({ output: '' }),
    getDiff: vi.fn().mockResolvedValue({ output: '' }),
    getBranchStatus: vi.fn().mockResolvedValue({
      ahead: 0,
      behind: 0,
      hasUncommittedChanges: false,
      hasUnpushedCommits: false
    })
  }))
}));

describe('TaskService', () => {
  let service;
  let mockModels;
  let mockGithubTokenService;
  let mockEventEmitterService;
  let tempDir;
  let projectsDir;

  beforeAll(() => {
    // Mock fs.existsSync calls that are used in service methods
    vi.spyOn(fsSync, 'existsSync');
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  beforeEach(async () => {
    // Create temp directory for test projects
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-service-test-'));
    projectsDir = path.join(tempDir, 'projects');
    await fs.mkdir(projectsDir, { recursive: true });

    // Setup mock models
    mockModels = {
      tasks: {
        generateId: vi.fn().mockReturnValue('test-task-123'),
        create: vi.fn(),
        findById: vi.fn(),
        findByIdWithSessionState: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        archive: vi.fn()
      },
      projects: {
        findById: vi.fn(),
        updateLastAccessed: vi.fn()
      }
    };

    mockGithubTokenService = {};

    mockEventEmitterService = {
      emit: vi.fn()
    };

    service = new TaskService(
      mockModels,
      mockGithubTokenService,
      mockEventEmitterService,
      projectsDir
    );

    // Mock the worktree service methods
    service.worktreeService = {
      create: vi.fn(),
      remove: vi.fn(),
      move: vi.fn()
    };

    // Mock fs.existsSync to return false by default
    fsSync.existsSync.mockReturnValue(false);
  });

  afterEach(async () => {
    // Cleanup temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
    vi.clearAllMocks();
  });

  describe('createTask', () => {
    const mockProject = {
      id: 'project-123',
      local_path: '/path/to/project',
      base_branch: 'main'
    };

    const taskData = {
      name: 'Test Task',
      branch: 'feature-branch'
    };

    beforeEach(() => {
      mockModels.projects.findById.mockResolvedValue(mockProject);
      mockModels.tasks.create.mockResolvedValue({
        id: 'test-task-123',
        name: 'Test Task',
        branch: 'feature-branch',
        worktree_path: expect.any(String)
      });
    });

    it('creates task with worktree and session successfully', async () => {
      const result = await service.createTask('project-123', taskData, 'github-token');

      expect(mockModels.projects.findById).toHaveBeenCalledWith('project-123');
      expect(service.worktreeService.create).toHaveBeenCalledWith(
        mockProject.local_path,
        'feature-branch',
        expect.stringContaining('project-123-task-test-task-123'),
        'main',
        undefined
      );
      expect(mockModels.tasks.create).toHaveBeenCalled();
      expect(mockModels.projects.updateLastAccessed).toHaveBeenCalledWith('project-123');
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith('task.created', expect.any(Object));
      expect(result).toMatchObject({
        task: expect.objectContaining({
          id: 'test-task-123',
          name: 'Test Task',
          branch: 'feature-branch'
        }),
        session: expect.objectContaining({
          sessionId: 'task-test-task-123'
        })
      });
    });

    it('creates task without session when createSession is false', async () => {
      const result = await service.createTask('project-123', taskData, 'github-token', { createSession: false });

      expect(result.session).toBeNull();
      expect(result.task).toBeDefined();
    });

    it('includes claudeUrl when hostname is provided', async () => {
      const result = await service.createTask('project-123', taskData, 'github-token', { hostname: 'localhost' });

      expect(result.task.claudeUrl).toMatch(/http:\/\/localhost:7681\/\?arg=/);
    });

    it('throws error when task name is missing', async () => {
      await expect(
        service.createTask('project-123', { branch: 'feature' }, 'github-token')
      ).rejects.toThrow('Task name and branch are required');
    });

    it('throws error when branch is missing', async () => {
      await expect(
        service.createTask('project-123', { name: 'Test' }, 'github-token')
      ).rejects.toThrow('Task name and branch are required');
    });

    it('throws error when project not found', async () => {
      mockModels.projects.findById.mockResolvedValue(null);

      await expect(
        service.createTask('non-existent', taskData, 'github-token')
      ).rejects.toThrow('Project not found');
    });

    it('cleans up worktree when task creation fails', async () => {
      const worktreePath = path.join(projectsDir, 'project-123-task-test-task-123');
      fsSync.existsSync.mockReturnValue(true);
      mockModels.tasks.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.createTask('project-123', taskData, 'github-token')
      ).rejects.toThrow('Database error');

      expect(service.worktreeService.remove).toHaveBeenCalledWith(
        mockProject.local_path,
        worktreePath
      );
    });
  });

  describe('deleteTask', () => {
    const mockTask = {
      id: 'task-123',
      project_id: 'project-123',
      worktree_path: '/path/to/worktree'
    };

    const mockProject = {
      id: 'project-123',
      local_path: '/path/to/project'
    };

    beforeEach(() => {
      mockModels.tasks.findById.mockResolvedValue(mockTask);
      mockModels.projects.findById.mockResolvedValue(mockProject);
      
      // Mock the private method
      service._cleanupTaskSessions = vi.fn().mockResolvedValue();
    });

    it('soft deletes task by default', async () => {
      const result = await service.deleteTask('task-123');

      expect(service._cleanupTaskSessions).toHaveBeenCalledWith('task-123');
      expect(mockModels.tasks.archive).toHaveBeenCalledWith('task-123');
      expect(service.worktreeService.move).toHaveBeenCalled();
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        'task.state-changed',
        { taskId: 'task-123', newState: 'archived', oldState: 'active' }
      );
      expect(result).toMatchObject({
        success: true,
        softDeleted: true,
        message: expect.stringContaining('archived')
      });
    });

    it('hard deletes task when force is true', async () => {
      const result = await service.deleteTask('task-123', { force: true, softDelete: false });

      expect(service.worktreeService.remove).toHaveBeenCalledWith(
        mockProject.local_path,
        mockTask.worktree_path
      );
      expect(mockModels.tasks.delete).toHaveBeenCalledWith('task-123');
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        'task.deleted',
        { taskId: 'task-123' }
      );
      expect(result).toMatchObject({
        success: true,
        hardDeleted: true,
        message: expect.stringContaining('permanently deleted')
      });
    });

    it('throws error when task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        service.deleteTask('non-existent')
      ).rejects.toThrow('Task not found');
    });

    it('throws error when project not found', async () => {
      mockModels.projects.findById.mockResolvedValue(null);

      await expect(
        service.deleteTask('task-123')
      ).rejects.toThrow('Project not found');
    });
  });

  describe('updateTaskMetadata', () => {
    const mockTask = {
      id: 'task-123',
      name: 'Original Name'
    };

    beforeEach(() => {
      mockModels.tasks.findById.mockResolvedValue(mockTask);
      mockModels.tasks.update.mockResolvedValue({ ...mockTask, name: 'Updated Name' });
    });

    it('updates allowed fields successfully', async () => {
      const updates = {
        name: 'Updated Name',
        description: 'New description',
        status: 'in-progress'
      };

      const result = await service.updateTaskMetadata('task-123', updates);

      expect(mockModels.tasks.update).toHaveBeenCalledWith('task-123', updates);
      expect(mockEventEmitterService.emit).toHaveBeenCalledWith(
        'task.updated',
        { taskId: 'task-123', changes: updates }
      );
      expect(result.name).toBe('Updated Name');
    });

    it('filters out disallowed update fields', async () => {
      const updates = {
        name: 'Updated Name',
        id: 'should-not-update',
        worktree_path: 'should-not-update',
        allowedField: 'this should be filtered out'
      };

      await service.updateTaskMetadata('task-123', updates);

      expect(mockModels.tasks.update).toHaveBeenCalledWith('task-123', {
        name: 'Updated Name'
      });
    });

    it('throws error when no valid updates provided', async () => {
      const updates = {
        id: 'invalid',
        created_at: 'invalid'
      };

      await expect(
        service.updateTaskMetadata('task-123', updates)
      ).rejects.toThrow('No valid updates provided');
    });

    it('throws error when task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        service.updateTaskMetadata('non-existent', { name: 'New Name' })
      ).rejects.toThrow('Task not found');
    });
  });

  describe('checkTaskDeletionSafety', () => {
    const mockTask = {
      id: 'task-123',
      branch: 'feature-branch',
      worktree_path: '/path/to/worktree'
    };

    beforeEach(() => {
      mockModels.tasks.findById.mockResolvedValue(mockTask);
    });

    it('returns safe to delete when worktree does not exist', async () => {
      fsSync.existsSync.mockReturnValue(false);

      const result = await service.checkTaskDeletionSafety('task-123', 'github-token');

      expect(result).toMatchObject({
        canDelete: true,
        hasUncommittedChanges: false,
        hasUnpushedCommits: false,
        warnings: []
      });
    });

    it('throws error when task not found', async () => {
      mockModels.tasks.findById.mockResolvedValue(null);

      await expect(
        service.checkTaskDeletionSafety('non-existent', 'github-token')
      ).rejects.toThrow('Task not found');
    });
  });

  describe('getTaskState', () => {
    const mockTask = {
      id: 'task-123',
      project_id: 'project-123',
      branch: 'feature-branch',
      worktree_path: '/path/to/worktree',
      status: 'active',
      is_archived: false,
      merged_at: null
    };

    const mockProject = {
      id: 'project-123',
      base_branch: 'main'
    };

    beforeEach(() => {
      mockModels.tasks.findByIdWithSessionState.mockResolvedValue(mockTask);
      mockModels.projects.findById.mockResolvedValue(mockProject);
    });

    it('returns complete task state with session info', async () => {
      const mockMonitor = {
        aiMonitor: {
          getSessionStatus: vi.fn().mockReturnValue({
            currentState: 'idle'
          })
        }
      };

      const result = await service.getTaskState('task-123', 'github-token', mockMonitor);

      expect(result).toMatchObject({
        id: 'task-123',
        taskState: 'active',
        sessionState: {
          status: 'idle',
          lastStateChange: expect.any(String)
        }
      });
    });

    it('returns merged task state when task is merged', async () => {
      mockModels.tasks.findByIdWithSessionState.mockResolvedValue({
        ...mockTask,
        status: 'merged',
        merged_at: '2023-01-01T00:00:00Z'
      });

      const result = await service.getTaskState('task-123', 'github-token');

      expect(result.taskState).toBe('merged');
    });

    it('returns archived task state when task is archived', async () => {
      mockModels.tasks.findByIdWithSessionState.mockResolvedValue({
        ...mockTask,
        is_archived: true
      });

      const result = await service.getTaskState('task-123', 'github-token');

      expect(result.taskState).toBe('archived');
    });

    it('throws error when task not found', async () => {
      mockModels.tasks.findByIdWithSessionState.mockResolvedValue(null);

      await expect(
        service.getTaskState('non-existent', 'github-token')
      ).rejects.toThrow('Task not found');
    });

    it('handles git status errors gracefully', async () => {
      fsSync.existsSync.mockReturnValue(true);
      
      // Mock console.error to avoid noise in test output
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Import and get the mocked GitService constructor
      const { GitService } = await import('../../services/git-compat.js');
      
      // Make the getBranchStatus method throw an error for this test
      GitService.mockImplementation(() => ({
        getBranchStatus: vi.fn().mockRejectedValue(new Error('Git error'))
      }));

      const result = await service.getTaskState('task-123', 'github-token');

      expect(result.gitStatus).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('manageTaskTerminalSession', () => {
    it('delegates to terminal service', async () => {
      const mockTerminalService = {
        createSession: vi.fn().mockResolvedValue({ sessionId: 'session-123' })
      };
      service._getTerminalService = vi.fn().mockResolvedValue(mockTerminalService);

      const sessionData = { type: 'claude' };
      const monitors = { aiMonitor: {} };

      const result = await service.manageTaskTerminalSession('task-123', sessionData, monitors);

      expect(mockTerminalService.createSession).toHaveBeenCalledWith('task-123', sessionData, monitors);
      expect(result).toEqual({ sessionId: 'session-123' });
    });
  });
});