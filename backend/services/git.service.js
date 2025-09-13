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

  // ========== 10 PUBLIC METHODS ==========
  // 1. clone - Clone a repository
  // 2. sync - Fetch and pull updates (combines fetch + pull)
  // 3. push - Push changes to remote
  // 4. commit - Stage and commit changes
  // 5. merge - Merge branches (with conflict checking)
  // 6. branch - Manage branches (checkout, create, delete, list)
  // 7. info - Get repository information (status, branches, log, current)
  // 8. getDiff - Get differences between refs
  // 9. checkConflicts - Check for merge conflicts
  // 10. execute - Execute arbitrary git command (escape hatch)

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
   * Sync with remote (fetch + pull/merge)
   * @param {string} repoPath - Repository path
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Result with success, output, error
   */
  async sync(repoPath, options = {}) {
    const { branch = null, remote = 'origin', fetchOnly = false } = options;
    
    // Always fetch first
    const fetchResult = await this._execute('git fetch --prune', repoPath);
    if (!fetchResult.success) {
      return fetchResult;
    }
    
    // If fetch only, return
    if (fetchOnly) {
      return fetchResult;
    }
    
    // Pull/merge changes
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
   * Manage branches (checkout, create, delete)
   * @param {string} repoPath - Repository path
   * @param {string} operation - Operation: 'checkout', 'create', 'delete', 'list'
   * @param {string} branch - Branch name (for checkout/create/delete)
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Result
   */
  async branch(repoPath, operation, branch = null, options = {}) {
    switch (operation) {
      case 'checkout':
        return await this._execute(`git checkout ${branch}`, repoPath);
      
      case 'create':
        const createCmd = options.checkout 
          ? `git checkout -b ${branch}`
          : `git branch ${branch}`;
        return await this._execute(createCmd, repoPath);
      
      case 'delete':
        const deleteCmd = options.force 
          ? `git branch -D ${branch}`
          : `git branch -d ${branch}`;
        return await this._execute(deleteCmd, repoPath);
      
      case 'list':
        return await this.getBranches(repoPath, options);
      
      case 'current':
        return await this.getCurrentBranch(repoPath);
      
      default:
        return { success: false, error: `Unknown branch operation: ${operation}` };
    }
  }

  /**
   * Get repository info (status, branches, commits)
   * @param {string} repoPath - Repository path
   * @param {string} infoType - Type of info: 'status', 'branches', 'log', 'current'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Repository information
   */
  async info(repoPath, infoType = 'status', options = {}) {
    switch (infoType) {
      case 'status':
        return await this._getStatus(repoPath);
      
      case 'branches':
        return await this._getBranches(repoPath, options);
      
      case 'log':
        const { limit = 10, oneline = true } = options;
        const logCmd = oneline 
          ? `git log --oneline -n ${limit}`
          : `git log -n ${limit}`;
        const logResult = await this._execute(logCmd, repoPath);
        return logResult.success 
          ? { success: true, commits: logResult.output.split('\n').filter(l => l) }
          : logResult;
      
      case 'current':
        const branch = await this._getCurrentBranch(repoPath);
        const commit = await this._getCurrentCommit(repoPath);
        const aheadBehind = branch ? await this._getAheadBehind(repoPath, branch) : { ahead: 0, behind: 0 };
        return {
          success: true,
          branch,
          commit,
          ...aheadBehind
        };
      
      default:
        return { success: false, error: `Unknown info type: ${infoType}` };
    }
  }

  // Keep as internal helper for other methods
  async _getBranches(repoPath, options = {}) {
    const { remote = false, all = false } = options;
    
    let command = 'git branch';
    if (all) command += ' -a';
    else if (remote) command += ' -r';
    
    const result = await this._execute(command, repoPath);
    
    if (!result.success) {
      return [];
    }
    
    return result.output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        // Remove leading * for current branch and remote prefix
        return line.trim()
          .replace(/^\* /, '')
          .replace(/^remotes\/origin\//, '')
          .replace(/^origin\//, '');
      })
      .filter(branch => branch && !branch.includes('HEAD'));
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
   * Check for merge conflicts without actually merging
   * @param {string} repoPath - Repository path
   * @param {string} targetBranch - Branch to check conflicts against
   * @returns {Promise<Object>} Conflict information
   */
  async checkConflicts(repoPath, targetBranch) {
    return await this._checkMergeConflicts(repoPath, targetBranch);
  }


  /**
   * Execute arbitrary git command (for advanced operations)
   * @param {string} command - Git command to execute
   * @param {string} repoPath - Repository path
   * @returns {Promise<Object>} Result with success, output, error
   */
  async execute(command, repoPath) {
    return await this._execute(command, repoPath);
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

  // ========== HELPER METHODS (Internal Use) ==========
  
  // These were previously public but are now internal:
  async _getStatus(repoPath) {
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
    const branch = await this._getCurrentBranch(repoPath);
    
    // Get ahead/behind info
    const aheadBehind = branch ? await this._getAheadBehind(repoPath, branch) : { ahead: 0, behind: 0 };
    
    return {
      success: true,
      branch,
      files,
      hasChanges: files.length > 0,
      ...aheadBehind
    };
  }

  async _getCurrentBranch(repoPath) {
    const result = await this._execute('git branch --show-current', repoPath);
    return result.success ? result.output.trim() : null;
  }

  async _getCurrentCommit(repoPath) {
    const result = await this._execute('git rev-parse HEAD', repoPath);
    return result.success ? result.output.trim() : null;
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