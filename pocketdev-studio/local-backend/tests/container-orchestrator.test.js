const ContainerOrchestrator = require('../lib/container-orchestrator.js');
const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

// Mock child_process spawn
jest.mock('child_process', () => ({
  spawn: jest.fn()
}));

// Mock fs promises
jest.mock('fs').promises;

describe('ContainerOrchestrator', () => {
  let orchestrator;
  let mockProcess;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Setup default mocks
    fs.mkdir = jest.fn().mockResolvedValue(undefined);
    fs.readFile = jest.fn();
    fs.readdir = jest.fn();
    fs.stat = jest.fn();
    fs.rm = jest.fn();

    // Mock spawn process
    mockProcess = {
      stdout: {
        on: jest.fn()
      },
      stderr: {
        on: jest.fn()
      },
      on: jest.fn(),
      kill: jest.fn(),
      killed: false
    };
    spawn.mockReturnValue(mockProcess);

    orchestrator = new ContainerOrchestrator({
      dockerImage: 'test/ai-developer:latest',
      workspaceBase: '/tmp/test-workspaces'
    });
  });

  describe('initialization', () => {
    test('should create workspace directory on init', async () => {
      await orchestrator.init();
      
      expect(fs.mkdir).toHaveBeenCalledWith(
        '/tmp/test-workspaces',
        { recursive: true }
      );
    });
  });

  describe('executeTask', () => {
    const mockTask = {
      id: 'test-task-123',
      repository: {
        url: 'https://github.com/test/repo.git',
        branch: 'main'
      },
      description: 'Test task description',
      acceptanceCriteria: ['Test passes', 'Code works'],
      testFramework: 'jest',
      engineerRole: 'frontend',
      model: 'claude-3-5-sonnet-latest'
    };

    beforeEach(() => {
      // Mock successful result file read
      fs.readFile.mockResolvedValue(JSON.stringify({
        success: true,
        sessionId: 'session-123',
        prUrl: 'https://github.com/test/repo/pull/1',
        cost_usd: 0.05
      }));
    });

    test('should execute task with correct Docker arguments', async () => {
      const resultPromise = orchestrator.executeTask(mockTask);

      // Trigger process close event
      const closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(0);

      await resultPromise;

      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining([
        'run',
        '--rm',
        '-v', expect.stringContaining('/logs:/workspace/logs'),
        '-v', expect.stringContaining('/results:/workspace/results'),
        '-e', 'REPO_URL=https://github.com/test/repo.git',
        '-e', 'BRANCH=main',
        '-e', 'TASK_DESCRIPTION=Test task description',
        '-e', 'ENGINEER_ROLE=frontend',
        '-e', 'MODEL=claude-3-5-sonnet-latest',
        'test/ai-developer:latest'
      ]));
    });

    test('should handle Git credentials when provided', async () => {
      const taskWithCreds = {
        ...mockTask,
        repository: {
          ...mockTask.repository,
          credentials: {
            username: 'testuser',
            token: 'test-token'
          }
        }
      };

      const resultPromise = orchestrator.executeTask(taskWithCreds);
      
      const closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(0);

      await resultPromise;

      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining([
        '-e', 'GIT_USERNAME=testuser',
        '-e', 'GIT_TOKEN=test-token'
      ]));
    });

    test('should stream stdout and stderr', async () => {
      const resultPromise = orchestrator.executeTask(mockTask);

      // Simulate stdout data
      const stdoutCallback = mockProcess.stdout.on.mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stdoutCallback(Buffer.from('Task progress...'));

      // Simulate stderr data
      const stderrCallback = mockProcess.stderr.on.mock.calls.find(
        call => call[0] === 'data'
      )[1];
      stderrCallback(Buffer.from('Warning message'));

      // Complete process
      const closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(0);

      const result = await resultPromise;

      expect(result.logs).toEqual(expect.arrayContaining([
        expect.objectContaining({
          type: 'stdout',
          message: 'Task progress...'
        }),
        expect.objectContaining({
          type: 'stderr',
          message: 'Warning message'
        })
      ]));
    });

    test('should store session for continuation', async () => {
      const resultPromise = orchestrator.executeTask(mockTask);
      
      const closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(0);

      const result = await resultPromise;

      expect(orchestrator.sessionStorage.has('session-123')).toBe(true);
      expect(result.sessionId).toBe('session-123');
    });

    test('should handle result read failure', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const resultPromise = orchestrator.executeTask(mockTask);
      
      const closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(1);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to read task results');
      expect(result.exitCode).toBe(1);
    });

    test('should continue existing session', async () => {
      // First task to create session
      let resultPromise = orchestrator.executeTask(mockTask);
      let closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(0);
      await resultPromise;

      // Clear mocks for second call
      spawn.mockClear();
      spawn.mockReturnValue(mockProcess);

      // Continue with same session
      const continuationTask = {
        ...mockTask,
        sessionId: 'session-123'
      };

      resultPromise = orchestrator.executeTask(continuationTask);
      closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(0);
      await resultPromise;

      expect(spawn).toHaveBeenCalledWith('docker', expect.arrayContaining([
        '-e', 'CLAUDE_SESSION_ID=session-123'
      ]));
    });
  });

  describe('stopContainer', () => {
    test('should stop running container', async () => {
      // Start a task
      const resultPromise = orchestrator.executeTask({
        id: 'stop-test',
        repository: { url: 'test', branch: 'main' },
        description: 'Test'
      });

      // Verify container is tracked
      expect(orchestrator.activeContainers.has('stop-test')).toBe(true);

      // Stop container
      const stopped = await orchestrator.stopContainer('stop-test');
      
      expect(stopped).toBe(true);
      expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
      expect(orchestrator.activeContainers.has('stop-test')).toBe(false);
    });

    test('should return false for non-existent container', async () => {
      const stopped = await orchestrator.stopContainer('non-existent');
      expect(stopped).toBe(false);
    });
  });

  describe('cleanup', () => {
    test('should remove old workspaces', async () => {
      const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      const recentTime = Date.now() - (1 * 60 * 60 * 1000); // 1 hour ago

      fs.readdir.mockResolvedValue(['old-task', 'recent-task']);
      fs.stat.mockImplementation((path) => {
        if (path.includes('old-task')) {
          return Promise.resolve({ mtimeMs: oldTime });
        }
        return Promise.resolve({ mtimeMs: recentTime });
      });

      await orchestrator.cleanup(24);

      expect(fs.rm).toHaveBeenCalledWith(
        expect.stringContaining('old-task'),
        { recursive: true, force: true }
      );
      expect(fs.rm).not.toHaveBeenCalledWith(
        expect.stringContaining('recent-task'),
        expect.any(Object)
      );
    });
  });

  describe('buildImage', () => {
    test('should build Docker image successfully', async () => {
      const buildPromise = orchestrator.buildImage();

      // Get close callback
      const closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(0);

      await buildPromise;

      expect(spawn).toHaveBeenCalledWith('docker', [
        'build',
        '-t', 'test/ai-developer:latest',
        expect.stringContaining('docker/ai-developer')
      ]);
    });

    test('should reject on build failure', async () => {
      const buildPromise = orchestrator.buildImage();

      const closeCallback = mockProcess.on.mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback(1);

      await expect(buildPromise).rejects.toThrow('Docker build failed');
    });
  });
});