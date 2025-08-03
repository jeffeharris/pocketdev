import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GitService, executeGitCommand } from '../services/git-compat.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((command, options, callback) => {
    // Check if GH_TOKEN is set in environment
    const hasToken = options?.env?.GH_TOKEN === 'test-token-123';
    
    // Simulate different commands
    if (command.includes('gh pr create')) {
      if (!hasToken) {
        callback(new Error('gh: authentication required (GH_TOKEN not set)'));
      } else {
        callback(null, { stdout: 'https://github.com/owner/repo/pull/123' });
      }
    } else if (command.includes('git push')) {
      if (!hasToken && !command.includes('credential.helper')) {
        callback(new Error('remote: Authentication failed'));
      } else {
        callback(null, { stdout: 'Everything up-to-date' });
      }
    } else if (command.includes('git config credential.helper')) {
      callback(null, { stdout: hasToken ? '!gh auth git-credential' : '' });
    } else {
      callback(null, { stdout: 'OK' });
    }
  })
}));

describe('Git Authentication Integration', () => {
  const testToken = 'test-token-123';
  const projectPath = '/test/project';

  describe('GitService with token', () => {
    it('should pass token to gh pr create command', async () => {
      const gitService = new GitService(testToken);
      const result = await gitService.createPullRequest(
        projectPath,
        'Test PR',
        'Test body',
        'main'
      );
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('github.com');
    });

    it('should pass token to git push command', async () => {
      const gitService = new GitService(testToken);
      const result = await gitService.push(projectPath, 'feature-branch');
      
      expect(result.success).toBe(true);
      expect(result.output).toContain('up-to-date');
    });

    it('should set credential helper when token is provided', async () => {
      const gitService = new GitService(testToken);
      await gitService.configureCredentials(projectPath);
      
      // Verify git config was called
      const { exec } = await import('child_process');
      expect(exec).toHaveBeenCalledWith(
        expect.stringContaining('git config'),
        expect.objectContaining({
          cwd: projectPath
        }),
        expect.any(Function)
      );
    });
  });

  describe('executeGitCommand', () => {
    it('should set GH_TOKEN for all commands when token provided', async () => {
      const result = await executeGitCommand(
        projectPath,
        'gh pr create --title "Test" --body "Test"',
        testToken
      );
      
      expect(result.success).toBe(true);
    });

    it('should fail gh commands without token', async () => {
      const result = await executeGitCommand(
        projectPath,
        'gh pr create --title "Test" --body "Test"',
        '' // No token
      );
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('authentication required');
    });
  });

  describe('Controller Integration', () => {
    it('should use token from middleware in GitService', async () => {
      // Simulate controller with middleware token
      const req = { githubToken: testToken };
      
      // This is what controllers SHOULD do (but currently don't)
      const gitService = new GitService(req.githubToken);
      
      const result = await gitService.createPullRequest(
        projectPath,
        'Test PR',
        'Test body', 
        'main'
      );
      
      expect(result.success).toBe(true);
    });
  });
});