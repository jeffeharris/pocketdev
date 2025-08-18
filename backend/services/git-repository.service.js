/**
 * GitRepository Service - Deep Module
 * 
 * Handles core repository operations with a simple interface.
 * Only 6 public methods that hide all git complexity.
 * 
 * Public API:
 * - clone(url, destination) - Clone a repository
 * - fetch(workingDirectory) - Fetch updates from remote
 * - push(workingDirectory, branch) - Push changes to remote
 * - pull(workingDirectory, branch) - Pull changes from remote
 * - merge(workingDirectory, branch) - Merge a branch
 * - rebase(workingDirectory, branch) - Rebase onto a branch
 */

import { GitExecutor } from './git-executor.js';

export class GitRepository extends GitExecutor {
  constructor(githubToken = null) {
    super(githubToken);
  }

  /**
   * Configure git credentials for a repository
   * @static
   * @param {string} workingDirectory - Directory to configure
   * @param {string} githubToken - GitHub token
   * @param {Object} gitConfig - Git configuration (name, email)
   */
  static async configureCredentials(workingDirectory, githubToken, gitConfig = null) {
    const repository = new GitRepository(githubToken);
    
    // Use provided git config or defaults
    const config = gitConfig || { name: 'PocketDev User', email: 'user@pocketdev.local' };
    
    const commands = [
      `git config user.name "${config.name}"`,
      `git config user.email "${config.email}"`
    ];

    // If we have a GitHub token, configure credential helper
    if (githubToken) {
      // Check if remote is GitHub
      const remoteResult = await repository.execute('git remote get-url origin', workingDirectory);
      if (remoteResult.success && remoteResult.output.includes('github.com')) {
        // Extract the GitHub URL
        const remoteUrl = remoteResult.output.trim();
        
        // Remove any existing authentication from the URL
        let cleanUrl = remoteUrl;
        const urlMatch = remoteUrl.match(/https:\/\/([^@]+@)?github\.com\/(.+)/);
        if (urlMatch) {
          cleanUrl = `https://github.com/${urlMatch[2]}`;
        }
        
        // Create authenticated URL with the new token
        const authenticatedUrl = cleanUrl.replace('https://github.com/', `https://x-access-token:${githubToken}@github.com/`);
        
        // Update the remote URL directly
        const setUrlResult = await repository.execute(`git remote set-url origin "${authenticatedUrl}"`, workingDirectory);
        if (!setUrlResult.success) {
          console.error('[configureCredentials] Failed to set remote URL:', setUrlResult.error);
          return setUrlResult;
        }
      }
    }

    for (const command of commands) {
      const result = await repository.execute(command, workingDirectory);
      if (!result.success) {
        return result;
      }
    }

    return { success: true };
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
   * Merge a branch into current branch
   */
  async merge(workingDirectory, branch, message = null) {
    const messageArg = message ? ` -m "${message}"` : '';
    return this.execute(
      `git merge ${branch}${messageArg}`,
      workingDirectory
    );
  }

  /**
   * Rebase current branch onto another branch
   */
  async rebase(workingDirectory, branch) {
    return this.execute(
      `git rebase ${branch}`,
      workingDirectory
    );
  }
}