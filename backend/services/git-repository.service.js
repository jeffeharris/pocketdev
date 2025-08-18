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

import { GitExecutor } from './git-executor.js';

export class GitRepository extends GitExecutor {
  constructor(githubToken = null) {
    super(githubToken);
  }

  /**
   * Clone a repository
   */
  async clone(url, destination) {
    // Clone doesn't have a working directory yet, so we execute in current dir
    return this.execute(
      `git clone ${url} ${destination}`,
      process.cwd()
    );
  }

  /**
   * Fetch updates from remote
   */
  async fetch(workingDirectory, options = {}) {
    const { all = false, prune = false } = options;
    const flags = [];
    if (all) flags.push('--all');
    if (prune) flags.push('--prune');
    
    return this.execute(
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
    
    return this.execute(
      `git push ${flags.join(' ')} origin ${branch}`.trim(),
      workingDirectory
    );
  }

  /**
   * Pull changes from remote
   */
  async pull(workingDirectory, remote = 'origin', branch = null) {
    const branchArg = branch ? ` ${branch}` : '';
    return this.execute(
      `git pull ${remote}${branchArg}`,
      workingDirectory
    );
  }

  /**
   * Get current branch name
   */
  async getCurrentBranch(workingDirectory) {
    const result = await this.execute(
      'git branch --show-current',
      workingDirectory
    );
    return result.success ? result.output : null;
  }
}