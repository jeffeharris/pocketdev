const ContainerTaskManager = require('../lib/container-task-manager.js');
const ContainerOrchestrator = require('../lib/container-orchestrator.js');

// Mock the orchestrator
jest.mock('../lib/container-orchestrator.js');

describe('ContainerTaskManager', () => {
  let manager;
  let mockOrchestrator;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock orchestrator instance
    mockOrchestrator = {
      init: jest.fn().mockResolvedValue(undefined),
      executeTask: jest.fn(),
      continueSession: jest.fn(),
      stopContainer: jest.fn(),
      cleanup: jest.fn(),
      buildImage: jest.fn()
    };

    // Mock ContainerOrchestrator constructor
    ContainerOrchestrator.mockImplementation(() => mockOrchestrator);

    manager = new ContainerTaskManager();
  });

  describe('initialization', () => {
    test('should initialize orchestrator and register default engineers', async () => {
      await manager.init();

      expect(mockOrchestrator.init).toHaveBeenCalled();
      expect(manager.engineers.size).toBe(3);
      expect(manager.engineers.has('frontend-1')).toBe(true);
      expect(manager.engineers.has('backend-1')).toBe(true);
      expect(manager.engineers.has('devops-1')).toBe(true);
    });

    test('should set correct engineer properties', async () => {
      await manager.init();

      const frontend = manager.engineers.get('frontend-1');
      expect(frontend).toMatchObject({
        id: 'frontend-1',
        name: 'Frontend Engineer',
        role: 'frontend',
        status: 'idle',
        currentTask: null,
        taskHistory: []
      });
    });
  });

  describe('registerEngineer', () => {
    test('should register new engineer with correct properties', () => {
      manager.registerEngineer('custom-1', {
        name: 'Custom Engineer',
        role: 'fullstack',
        specialties: ['Everything'],
        systemPrompt: 'You are a generalist'
      });

      const engineer = manager.engineers.get('custom-1');
      expect(engineer).toMatchObject({
        id: 'custom-1',
        name: 'Custom Engineer',
        role: 'fullstack',
        status: 'idle',
        currentTask: null,
        taskHistory: []
      });
    });
  });

  describe('assignTask', () => {
    const mockTaskConfig = {
      repository: {
        url: 'https://github.com/test/repo.git',
        branch: 'main'
      },
      description: 'Implement feature X',
      acceptanceCriteria: ['Tests pass', 'Feature works'],
      testFramework: 'jest',
      model: 'claude-3-5-sonnet-latest'
    };

    beforeEach(async () => {
      await manager.init();
      
      // Mock successful task execution
      mockOrchestrator.executeTask.mockResolvedValue({
        success: true,
        sessionId: 'session-123',
        prUrl: 'https://github.com/test/repo/pull/1',
        cost_usd: 0.05,
        duration: 120000
      });
    });

    test('should assign task to idle engineer', async () => {
      const task = await manager.assignTask('frontend-1', mockTaskConfig);

      expect(task).toMatchObject({
        engineerId: 'frontend-1',
        engineerRole: 'frontend',
        status: 'completed',
        sessionId: 'session-123',
        prUrl: 'https://github.com/test/repo/pull/1',
        cost: 0.05
      });

      expect(mockOrchestrator.executeTask).toHaveBeenCalledWith(
        expect.objectContaining({
          engineerId: 'frontend-1',
          engineerRole: 'frontend',
          systemPrompt: expect.stringContaining('frontend engineer'),
          repository: mockTaskConfig.repository,
          description: mockTaskConfig.description
        })
      );
    });

    test('should update engineer status during task execution', async () => {
      const taskPromise = manager.assignTask('backend-1', mockTaskConfig);

      // Check status during execution
      const engineer = manager.engineers.get('backend-1');
      expect(engineer.status).toBe('busy');
      expect(engineer.currentTask).toBeTruthy();

      await taskPromise;

      // Check status after completion
      expect(engineer.status).toBe('idle');
      expect(engineer.currentTask).toBeNull();
      expect(engineer.taskHistory).toHaveLength(1);
    });

    test('should throw error if engineer not found', async () => {
      await expect(
        manager.assignTask('non-existent', mockTaskConfig)
      ).rejects.toThrow('Engineer non-existent not found');
    });

    test('should throw error if engineer is busy', async () => {
      // Start first task
      manager.assignTask('frontend-1', mockTaskConfig);

      // Try to assign another task
      await expect(
        manager.assignTask('frontend-1', mockTaskConfig)
      ).rejects.toThrow('Engineer frontend-1 is busy');
    });

    test('should handle task failure', async () => {
      mockOrchestrator.executeTask.mockResolvedValue({
        success: false,
        error: 'Tests failed',
        cost_usd: 0.03
      });

      const task = await manager.assignTask('devops-1', mockTaskConfig);

      expect(task.status).toBe('failed');
      expect(task.result.success).toBe(false);

      const engineer = manager.engineers.get('devops-1');
      expect(engineer.status).toBe('idle');
    });

    test('should handle task error', async () => {
      mockOrchestrator.executeTask.mockRejectedValue(
        new Error('Container failed to start')
      );

      await expect(
        manager.assignTask('frontend-1', mockTaskConfig)
      ).rejects.toThrow('Container failed to start');

      const engineer = manager.engineers.get('frontend-1');
      expect(engineer.status).toBe('error');
      expect(engineer.currentTask).toBeNull();
    });
  });

  describe('continueTask', () => {
    beforeEach(async () => {
      await manager.init();

      // Create initial task
      mockOrchestrator.executeTask.mockResolvedValue({
        success: true,
        sessionId: 'session-123',
        cost_usd: 0.05
      });

      await manager.assignTask('frontend-1', {
        repository: { url: 'test', branch: 'main' },
        description: 'Initial task'
      });
    });

    test('should continue task with same session', async () => {
      mockOrchestrator.continueSession.mockResolvedValue({
        success: true,
        cost_usd: 0.02
      });

      const taskId = Array.from(manager.tasks.keys())[0];
      const continuation = await manager.continueTask(
        taskId,
        'Fix the failing tests'
      );

      expect(mockOrchestrator.continueSession).toHaveBeenCalledWith(
        'session-123',
        'Fix the failing tests'
      );

      expect(continuation).toMatchObject({
        parentTaskId: taskId,
        engineerId: 'frontend-1',
        status: 'completed'
      });
    });

    test('should throw error if task has no session', async () => {
      // Create task without session
      const task = {
        id: 'no-session-task',
        engineerId: 'backend-1',
        sessionId: null
      };
      manager.tasks.set('no-session-task', task);

      await expect(
        manager.continueTask('no-session-task', 'Continue')
      ).rejects.toThrow('Cannot continue task no-session-task - no session found');
    });

    test('should throw error if engineer is busy', async () => {
      const taskId = Array.from(manager.tasks.keys())[0];
      
      // Make engineer busy
      manager.engineers.get('frontend-1').status = 'busy';

      await expect(
        manager.continueTask(taskId, 'Continue')
      ).rejects.toThrow('Engineer frontend-1 is busy');
    });
  });

  describe('getEngineerStatus', () => {
    beforeEach(async () => {
      await manager.init();
    });

    test('should return engineer with current task details', async () => {
      // Start a task
      mockOrchestrator.executeTask.mockResolvedValue({
        success: true,
        sessionId: 'session-123'
      });

      manager.assignTask('backend-1', {
        repository: { url: 'test', branch: 'main' },
        description: 'Test task'
      });

      const status = manager.getEngineerStatus('backend-1');

      expect(status).toMatchObject({
        id: 'backend-1',
        status: 'busy',
        currentTaskDetails: expect.objectContaining({
          engineerId: 'backend-1',
          description: 'Test task'
        })
      });
    });

    test('should return null for non-existent engineer', () => {
      const status = manager.getEngineerStatus('non-existent');
      expect(status).toBeNull();
    });
  });

  describe('stopTask', () => {
    beforeEach(async () => {
      await manager.init();
    });

    test('should stop running task and update engineer status', async () => {
      mockOrchestrator.stopContainer.mockResolvedValue(true);

      // Create a running task
      const task = {
        id: 'running-task',
        engineerId: 'frontend-1',
        status: 'running'
      };
      manager.tasks.set('running-task', task);
      manager.engineers.get('frontend-1').currentTask = 'running-task';
      manager.engineers.get('frontend-1').status = 'busy';

      const stopped = await manager.stopTask('running-task');

      expect(stopped).toBe(true);
      expect(task.status).toBe('cancelled');
      expect(task.endTime).toBeDefined();
      expect(manager.engineers.get('frontend-1').status).toBe('idle');
      expect(manager.engineers.get('frontend-1').currentTask).toBeNull();
    });

    test('should return false for non-existent task', async () => {
      const stopped = await manager.stopTask('non-existent');
      expect(stopped).toBe(false);
    });
  });

  describe('resetEngineer', () => {
    beforeEach(async () => {
      await manager.init();
    });

    test('should reset engineer in error state', () => {
      const engineer = manager.engineers.get('devops-1');
      engineer.status = 'error';
      engineer.currentTask = 'stuck-task';

      const reset = manager.resetEngineer('devops-1');

      expect(reset).toBe(true);
      expect(engineer.status).toBe('idle');
      expect(engineer.currentTask).toBeNull();
    });

    test('should return false for non-existent engineer', () => {
      const reset = manager.resetEngineer('non-existent');
      expect(reset).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should delegate to orchestrator cleanup', async () => {
      await manager.cleanup(48);
      expect(mockOrchestrator.cleanup).toHaveBeenCalledWith(48);
    });
  });

  describe('buildImage', () => {
    test('should delegate to orchestrator buildImage', async () => {
      await manager.buildImage();
      expect(mockOrchestrator.buildImage).toHaveBeenCalled();
    });
  });
});