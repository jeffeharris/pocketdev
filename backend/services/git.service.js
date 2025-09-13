/**
 * Unified Git Service
 * 
 * This service consolidates all git operations into a single deep module,
 * replacing the previous 6 separate git services (GitRepository, GitWorkingTree,
 * GitAnalyzer, GitStatusService, GitOperationService, GitExecutor).
 * 
 * Following Ousterhout's deep module principle: simple interface, complex implementation.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class GitService {
  constructor(githubToken = null) {
    this.githubToken = githubToken;
  }

  /**
   * Clone a repository
   * @param {string} repoUrl - Repository URL
   * @param {string} destination - Local destination path
   * @param {Object} options - Clone options
   * @returns {Promise<Object>} Result with success, output, error
   */
  async clone(repoUrl, destination, options = {}) {
    const { branch = 'main', depth = null } = options;
    
    // Build clone command
    let command = `git clone`;
    if (depth) command += ` --depth ${depth}`;
    if (branch) command += ` --branch ${branch}`;
    command += ` ${this._addAuthToUrl(repoUrl)} "${destination}"`;
    
    return await this._execute(command);
  }

  /**
   * Fetch updates from remote
   * @param {string} repoPath - Repository path
   * @param {Object} options - Fetch options
   * @returns {Promise<Object>} Result with success, output, error
   */
  async fetch(repoPath, options = {}) {
    const { all = false, prune = false, tags = false } = options;
    
    let command = 'git fetch';
    if (all) command += ' --all';
    if (prune) command += ' --prune';
    if (tags) command += ' --tags';
    
    return await this._execute(command, repoPath);
  }

  /**
   * Pull updates from remote
   * @param {string} repoPath - Repository path
   * @param {string} remote - Remote name (default: origin)
   * @param {string} branch - Branch name
   * @returns {Promise<Object>} Result with success, output, error
   */
  async pull(repoPath, remote = 'origin', branch = null) {
    const command = branch 
      ? `git pull ${remote} ${branch}`
      : `git pull`;
    
    return await this._execute(command, repoPath);
  }

  /**
   * Push changes to remote
   * @param {string} repoPath - Repository path
   * @param {string} branch - Branch to push
   * @param {Object} options - Push options
   * @returns {Promise<Object>} Result with success, output, error
   */
  async push(repoPath, branch, options = {}) {
    const { force = false, setUpstream = false } = options;
    
    let command = 'git push';
    if (force) command += ' --force';
    if (setUpstream) command += ` --set-upstream origin ${branch}`;
    else if (branch) command += ` origin ${branch}`;
    
    return await this._execute(command, repoPath);
  }

  /**
   * Get repository status
   * @param {string} repoPath - Repository path
   * @returns {Promise<Object>} Status information
   */
  async getStatus(repoPath) {
    const result = await this._execute('git status --porcelain', repoPath);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    const files = result.output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const status = line.substring(0, 2);
        const file = line.substring(3);
        return { status, file };
      });
    
    // Get branch info
    const branchResult = await this._execute('git branch --show-current', repoPath);
    const branch = branchResult.success ? branchResult.output.trim() : 'unknown';
    
    // Get ahead/behind info
    const aheadBehind = await this._getAheadBehind(repoPath, branch);
    
    return {
      success: true,
      branch,
      files,
      hasChanges: files.length > 0,
      ...aheadBehind
    };
  }

  /**
   * Stage and commit changes
   * @param {string} repoPath - Repository path
   * @param {string} message - Commit message
   * @param {Array<string>} files - Files to stage (optional, stages all if not provided)
   * @returns {Promise<Object>} Result with success, output, error
   */
  async commit(repoPath, message, files = null) {
    // Stage files
    const stageCommand = files 
      ? `git add ${files.map(f => `"${f}"`).join(' ')}`
      : 'git add -A';
    
    const stageResult = await this._execute(stageCommand, repoPath);
    if (!stageResult.success) {
      return stageResult;
    }
    
    // Commit
    const commitCommand = `git commit -m "${message.replace(/"/g, '\\"')}"`;
    return await this._execute(commitCommand, repoPath);
  }

  /**
   * Merge branch (handles conflicts internally)
   * @param {string} repoPath - Repository path
   * @param {string} sourceBranch - Branch to merge from
   * @param {Object} options - Merge options
   * @returns {Promise<Object>} Result with success, conflicts if any
   */
  async merge(repoPath, sourceBranch, options = {}) {
    const { strategy = 'recursive', noCommit = false, checkConflicts = true } = options;
    
    // First check for conflicts if requested
    if (checkConflicts) {
      const conflicts = await this._checkMergeConflicts(repoPath, sourceBranch);
      if (conflicts.hasConflicts) {
        return {
          success: false,
          error: 'Merge would result in conflicts',
          conflicts: conflicts.conflicts,
          hasConflicts: true
        };
      }
    }
    
    // Perform merge
    let command = `git merge ${sourceBranch}`;
    if (strategy) command += ` --strategy=${strategy}`;
    if (noCommit) command += ' --no-commit';
    
    return await this._execute(command, repoPath);
  }

  /**
   * Rebase current branch
   * @param {string} repoPath - Repository path
   * @param {string} targetBranch - Branch to rebase onto
   * @returns {Promise<Object>} Result with success, output, error
   */
  async rebase(repoPath, targetBranch) {
    return await this._execute(`git rebase ${targetBranch}`, repoPath);
  }

  /**
   * Get diff between branches or commits
   * @param {string} repoPath - Repository path
   * @param {string} from - From ref (branch/commit)
   * @param {string} to - To ref (branch/commit)
   * @param {Object} options - Diff options
   * @returns {Promise<Object>} Diff information
   */
  async getDiff(repoPath, from, to = 'HEAD', options = {}) {
    const { nameOnly = false, stat = false } = options;
    
    let command = `git diff ${from}..${to}`;
    if (nameOnly) command += ' --name-only';
    if (stat) command += ' --stat';
    
    const result = await this._execute(command, repoPath);
    
    if (!result.success) {
      return { success: false, error: result.error };
    }
    
    if (nameOnly) {
      return {
        success: true,
        files: result.output.split('\n').filter(f => f.trim())
      };
    }
    
    return {
      success: true,
      diff: result.output
    };
  }

  /**
   * Configure git credentials
   * @param {string} repoPath - Repository path
   * @param {Object} gitConfig - Git configuration
   * @returns {Promise<Object>} Result
   */
  static async configureCredentials(repoPath, githubToken, gitConfig = {}) {
    const { name = 'PocketDev User', email = 'user@pocketdev.local' } = gitConfig;
    
    // Set user config
    await execAsync(`git config user.name "${name}"`, { cwd: repoPath });
    await execAsync(`git config user.email "${email}"`, { cwd: repoPath });
    
    // Configure credential helper if token provided
    if (githubToken) {
      // This would set up credential caching with the token
      // Implementation depends on the OS and git credential helper
    }
    
    return { success: true };
  }

  // Private helper methods

  /**
   * Execute git command
   * @private
   */
  async _execute(command, cwd = null) {
    try {
      const options = {};
      if (cwd) options.cwd = cwd;
      
      // Add auth to command if needed and token available
      if (this.githubToken && command.includes('git push') || command.includes('git pull') || command.includes('git fetch')) {
        // Set auth header for the command
        options.env = {
          ...process.env,
          GIT_ASKPASS: 'echo',
          GIT_USERNAME: 'x-access-token',
          GIT_PASSWORD: this.githubToken
        };
      }
      
      const { stdout, stderr } = await execAsync(command, options);
      
      return {
        success: true,
        output: stdout || stderr,
        error: null
      };
    } catch (error) {
      return {
        success: false,
        output: error.stdout || '',
        error: error.message || error.stderr
      };
    }
  }

  /**
   * Add authentication to URL
   * @private
   */
  _addAuthToUrl(url) {
    if (!this.githubToken || !url.includes('github.com')) {
      return url;
    }
    
    // Add token auth to URL
    return url.replace(
      'https://github.com/',
      `https://x-access-token:${this.githubToken}@github.com/`
    );
  }

  /**
   * Get ahead/behind counts
   * @private
   */
  async _getAheadBehind(repoPath, branch) {
    try {
      const aheadResult = await this._execute(
        `git rev-list --count origin/${branch}..${branch}`,
        repoPath
      );
      const behindResult = await this._execute(
        `git rev-list --count ${branch}..origin/${branch}`,
        repoPath
      );
      
      return {
        ahead: aheadResult.success ? parseInt(aheadResult.output) || 0 : 0,
        behind: behindResult.success ? parseInt(behindResult.output) || 0 : 0
      };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  /**
   * Check for merge conflicts
   * @private
   */
  async _checkMergeConflicts(repoPath, targetBranch) {
    // Use git merge-tree to check for conflicts without actually merging
    const result = await this._execute(
      `git merge-tree $(git merge-base HEAD ${targetBranch}) HEAD ${targetBranch}`,
      repoPath
    );
    
    if (!result.success) {
      return { hasConflicts: false, conflicts: [] };
    }
    
    // Parse output for conflict markers
    const conflicts = [];
    const lines = result.output.split('\n');
    let inConflict = false;
    let currentFile = null;
    
    for (const line of lines) {
      if (line.startsWith('+<<<<<<< ')) {
        inConflict = true;
      } else if (line.startsWith('+>>>>>>> ')) {
        inConflict = false;
        if (currentFile) {
          conflicts.push(currentFile);
          currentFile = null;
        }
      } else if (inConflict && line.startsWith('diff --git')) {
        const match = line.match(/b\/(.+)$/);
        if (match) {
          currentFile = match[1];
        }
      }
    }
    
    return {
      hasConflicts: conflicts.length > 0,
      conflicts
    };
  }
}