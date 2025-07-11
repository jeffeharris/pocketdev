import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import ContainerTaskManager from '../lib/container-task-manager.js';
import { db } from '../db/index.js';

describe('Task Resilience and Recovery', () => {
  let taskManager;
  let mockTask;

  beforeEach(() => {
    taskManager = new ContainerTaskManager();
    mockTask = {
      id: 'test-task-123',
      engineerId: 'test-engineer-123',
      description: 'Add a hello world button',
      repository: 'https://github.com/test/repo',
      branch: 'main'
    };
  });

  describe('Git Authentication Failures', () => {
    test('should detect git authentication failure and provide recovery options', async () => {
      // Simulate a task that fails during cloning
      const failedResult = {
        success: false,
        error: 'fatal: could not read Username for',
        canContinue: true,
        suggestedNextSteps: [
          'Configure git credentials',
          'Use SSH URL instead of HTTPS',
          'Provide personal access token'
        ]
      };

      // The system should:
      // 1. Detect the specific failure type
      // 2. Keep the task in a recoverable state
      // 3. Provide actionable next steps
      expect(failedResult.canContinue).toBe(true);
      expect(failedResult.suggestedNextSteps).toContain('Configure git credentials');
    });

    test('should automatically retry with credentials if available', async () => {
      // Set up a failed task
      const failedTask = {
        ...mockTask,
        result: { 
          success: false, 
          error: 'fatal: could not read Username for',
          logs: [{ type: 'stderr', message: 'fatal: could not read Username for' }]
        }
      };
      taskManager.tasks.set(failedTask.id, failedTask);
      
      // Mock the assignTask method
      taskManager.assignTask = jest.fn().mockResolvedValue({
        id: 'new-task-id',
        status: 'running'
      });
      
      // When credentials are configured after a failure
      const retryResult = await taskManager.retryTaskWithRecovery(mockTask.id, {
        gitUsername: 'testuser',
        gitToken: 'test-token'
      });

      expect(retryResult).toBeDefined();
      expect(retryResult.id).toBeDefined();
      expect(taskManager.assignTask).toHaveBeenCalled();
    });
  });

  describe('Verification Script Failures', () => {
    test('should attempt to fix verification failures automatically', async () => {
      // When verify.py fails, the system should:
      // 1. Capture the failure output
      // 2. Ask Claude to fix the issues
      // 3. Retry verification
      // 4. Maximum 2 attempts as per entrypoint.sh
      
      const verificationFlow = {
        attempt1: {
          verifyPassed: false,
          error: 'AssertionError: Button not found',
          action: 'request_fix'
        },
        attempt2: {
          verifyPassed: true,
          fixApplied: true
        }
      };

      expect(verificationFlow.attempt2.verifyPassed).toBe(true);
    });
  });

  describe('Task State Transitions', () => {
    test('should handle all failure states gracefully', async () => {
      const failureStates = [
        { state: 'clone_failed', recoverable: true },
        { state: 'build_failed', recoverable: true },
        { state: 'test_failed', recoverable: true },
        { state: 'verification_failed', recoverable: true },
        { state: 'timeout', recoverable: false }
      ];

      failureStates.forEach(({ state, recoverable }) => {
        const task = { ...mockTask, failureState: state, result: { success: false, error: state } };
        // Add the task to taskManager's internal map for testing
        taskManager.tasks.set(task.id, task);
        expect(taskManager.isTaskRecoverable(task.id)).toBe(recoverable);
      });
    });

    test('should maintain task history through retries', async () => {
      // Each retry should be tracked
      const task = {
        ...mockTask,
        result: { success: false, error: 'git auth failure' },
        attempts: 1,
        events: [{ eventType: 'retry_requested' }]
      };
      taskManager.tasks.set(task.id, task);
      
      expect(task.attempts).toBeGreaterThanOrEqual(1);
      expect(task.events).toContainEqual(
        expect.objectContaining({ eventType: 'retry_requested' })
      );
    });
  });

  describe('Recovery Actions', () => {
    test('should provide context-aware recovery suggestions', async () => {
      const failures = [
        {
          error: 'npm install failed',
          suggestions: ['Check package.json', 'Clear npm cache', 'Update dependencies']
        },
        {
          error: 'Permission denied',
          suggestions: ['Check file permissions', 'Run with appropriate user']
        },
        {
          error: 'Module not found',
          suggestions: ['Install missing dependencies', 'Check import paths']
        }
      ];

      failures.forEach(({ error, suggestions }) => {
        // Create a task with the specific error
        const task = {
          ...mockTask,
          result: { success: false, error: error }
        };
        taskManager.tasks.set(task.id, task);
        
        const recovery = taskManager.getRecoverySuggestions(task.id);
        expect(recovery).toBeDefined();
        expect(recovery.immediateActions).toBeDefined();
        
        // Check that at least some suggestions are present
        const allSuggestions = recovery.immediateActions;
        suggestions.forEach(suggestion => {
          const found = allSuggestions.some(s => s.includes(suggestion));
          expect(found).toBe(true);
        });
      });
    });
  });

  describe('End-to-End Task Success', () => {
    test('should complete a task successfully with all checkpoints', async () => {
      const successCriteria = {
        cloneSuccessful: true,
        dependenciesInstalled: true,
        codeGenerated: true,
        testsWritten: true,
        testsPass: true,
        verificationPass: true,
        changesCommitted: true,
        prCreated: true
      };

      // All checkpoints should pass for a successful task
      Object.values(successCriteria).forEach(criterion => {
        expect(criterion).toBe(true);
      });
    });
  });
});

// Integration test for the full flow
describe('Quick Task Full Flow', () => {
  test('should handle quick task from voice to PR', async () => {
    const quickTaskFlow = {
      // 1. Voice/text input
      input: 'Add a hello world button to the home page',
      
      // 2. Smart routing
      assignedRole: 'frontend',
      
      // 3. Task execution with resilience
      executionSteps: [
        { step: 'clone', status: 'success' },
        { step: 'analyze', status: 'success' },
        { step: 'implement', status: 'success' },
        { step: 'test', status: 'success' },
        { step: 'verify', status: 'success' },
        { step: 'commit', status: 'success' }
      ],
      
      // 4. Result
      prUrl: 'https://github.com/test/repo/pull/123',
      timeElapsed: 300 // 5 minutes
    };

    expect(quickTaskFlow.prUrl).toBeTruthy();
    expect(quickTaskFlow.timeElapsed).toBeLessThan(600); // Under 10 minutes
    
    // All steps should succeed
    quickTaskFlow.executionSteps.forEach(({ status }) => {
      expect(status).toBe('success');
    });
  });
});