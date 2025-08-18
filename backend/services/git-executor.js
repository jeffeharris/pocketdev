/**
 * GitExecutor - Shared execution logic for git modules
 * 
 * Provides common git command execution functionality to avoid
 * duplication across GitRepository, GitWorkingTree, and GitAnalyzer.
 * 
 * This is an internal utility - not exposed as a public service.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitExecutor {
  constructor(githubToken = null) {
    this.githubToken = githubToken;
  }

  /**
   * Get environment with GitHub token if available
   */
  getEnv() {
    const env = { ...process.env };
    if (this.githubToken) {
      env.GITHUB_TOKEN = this.githubToken;
      env.GH_TOKEN = this.githubToken;
    }
    return env;
  }

  /**
   * Execute a command in a working directory
   */
  async execute(command, workingDirectory) {
    const env = this.getEnv();
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        env,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer for large outputs
      });
      return {
        success: true,
        output: stdout.trim(),
        error: stderr.trim()
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }
}