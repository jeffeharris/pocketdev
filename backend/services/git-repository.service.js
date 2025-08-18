/**
 * GitRepository Service - Deep Module
 * 
 * Handles core repository operations with a simple interface.
 * Only 5 public methods that hide all git complexity.
 * 
 * Public API:
 * - clone(url, destination) - Clone a repository
 * - fetch(workingDirectory) - Fetch updates from remote
 * - push(workingDirectory, branch) - Push changes to remote
 * - pull(workingDirectory, branch) - Pull changes from remote
 * - getCurrentBranch(workingDirectory) - Get current branch name
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class GitRepository {
  constructor(githubToken = null) {
    this.githubToken = githubToken;
  }

  /**
   * Clone a repository
   */
  async clone(url, destination) {
    const env = this._getEnv();
    try {
      const { stdout, stderr } = await execAsync(
        `git clone ${url} ${destination}`,
        { env }
      );
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

  /**
   * Fetch updates from remote
   */
  async fetch(workingDirectory, options = {}) {
    const { all = false, prune = false } = options;
    const flags = [];
    if (all) flags.push('--all');
    if (prune) flags.push('--prune');
    
    return this._execute(
      `git fetch ${flags.join(' ')}`.trim(),
      workingDirectory
    );
  }

  /**
   * Push changes to remote
   */
  async push(workingDirectory, branch, options = {}) {
    const { setUpstream = false, force = false } = options;
    const flags = [];
    if (setUpstream) flags.push('-u');
    if (force) flags.push('--force');
    
    return this._execute(
      `git push ${flags.join(' ')} origin ${branch}`.trim(),
      workingDirectory
    );
  }

  /**
   * Pull changes from remote
   */
  async pull(workingDirectory, remote = 'origin', branch = null) {
    const branchArg = branch ? ` ${branch}` : '';
    return this._execute(
      `git pull ${remote}${branchArg}`,
      workingDirectory
    );
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(workingDirectory) {
    const result = await this._execute(
      'git branch --show-current',
      workingDirectory
    );
    return result.success ? result.output : null;
  }

  // Private helper methods
  _getEnv() {
    const env = { ...process.env };
    if (this.githubToken) {
      env.GITHUB_TOKEN = this.githubToken;
      env.GH_TOKEN = this.githubToken;
    }
    return env;
  }

  async _execute(command, workingDirectory) {
    const env = this._getEnv();
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        env
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