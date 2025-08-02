import { GitService } from './git.service.js';

/**
 * GitOperationService - Handles all git operations (commands, diffs, commits)
 * 
 * This service provides a clean interface for executing git operations,
 * hiding the complexity of command validation, error handling, and status updates.
 * 
 * Following deep module principles: simple interface (6 methods), complex implementation.
 */
export class GitOperationService {
  constructor(models, githubTokenService) {
    this.models = models;
    this.githubTokenService = githubTokenService;
  }

  /**
   * Execute a git operation on a task
   * @param {string} taskId - Task ID
   * @param {string} operation - Git operation to perform
   * @param {Object} options - Operation options (message, files, etc.)
   * @param {string} githubToken - GitHub token for git operations
   * @param {Object} appLocals - Express app.locals for status updates (transitional)
   * @returns {Promise<Object>} Operation result
   */
  async executeOperation(taskId, operation, options = {}, githubToken, appLocals = null) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    await this.models.projects.updateLastAccessed(task.project_id);
    
    // Get git config for this operation
    const gitConfig = await this._getGitConfig();
    const gitService = new GitService(githubToken, gitConfig);
    
    let result;
    
    // Operations that should trigger status update
    const statusUpdateOperations = ['add', 'unstage', 'commit', 'push', 'pull', 'merge', 'rebase', 'reset', 'checkout'];
    
    switch (operation) {
      case 'status':
        result = await gitService.getStatus(task.worktree_path);
        break;
        
      case 'diff':
        result = await gitService.getDiff(task.worktree_path);
        break;
        
      case 'add':
        const filesToAdd = options.files || '.';
        result = await gitService.add(task.worktree_path, filesToAdd);
        break;
        
      case 'unstage':
        if (!options.files) {
          throw new Error('File path required for unstage operation');
        }
        result = await gitService.unstageFile(task.worktree_path, options.files);
        break;
        
      case 'commit':
        if (!options.message) {
          throw new Error('Commit message required');
        }
        result = await gitService.commit(task.worktree_path, options.message);
        
        // If task was merged, mark that it has commits since merge
        if (result.success && task.merge_commit_sha) {
          await this.models.tasks.update(task.id, {
            has_commits_since_merge: true
          });
        }
        break;
        
      case 'push':
        console.log(`[GitOperation] Push operation for task ${taskId} on branch ${task.branch}`);
        
        // First, let's check the actual branch status
        const statusCheck = await gitService.command(
          task.worktree_path,
          `git status -sb`
        );
        console.log(`[GitOperation] Current branch status: ${statusCheck.output}`);
        
        // Check what commits are ahead
        const aheadCheck = await gitService.command(
          task.worktree_path,
          `git log origin/${task.branch}..HEAD --oneline`
        );
        console.log(`[GitOperation] Commits ahead of origin: ${aheadCheck.output || 'none'}`);
        
        // Check if branch has remote tracking
        const hasRemoteTracking = await this._checkRemoteTracking(gitService, task);
        console.log(`[GitOperation] Remote tracking check: ${hasRemoteTracking}`);
        
        // Use -u flag if no remote tracking exists
        console.log(`[GitOperation] Pushing branch '${task.branch}' with setUpstream: ${!hasRemoteTracking}`);
        console.log(`[GitOperation] Task worktree path: ${task.worktree_path}`);
        result = await gitService.push(task.worktree_path, task.branch, {
          setUpstream: !hasRemoteTracking
        });
        console.log(`[GitOperation] Push result:`, result);
        break;
        
      case 'pr':
        const prTitle = options.message || `Updates from task: ${task.name}`;
        const project = await this.models.projects.findById(task.project_id);
        result = await gitService.createPullRequest(
          task.worktree_path,
          prTitle,
          `Created by Claude Code - Task: ${task.name}`,
          project.base_branch
        );
        break;
        
      case 'log':
        const logArgs = options.args || '--oneline -n 10';
        result = await gitService.log(task.worktree_path, logArgs);
        break;
        
      case 'reset-uncommitted':
        // Reset all uncommitted changes
        result = await gitService.reset(task.worktree_path, '--hard HEAD');
        break;
        
      case 'reset-to-commit':
        if (!options.commit) {
          throw new Error('Commit hash required for reset');
        }
        // Reset to specific commit
        result = await gitService.reset(task.worktree_path, `--hard ${options.commit}`);
        break;
        
      default:
        throw new Error('Invalid operation');
    }
    
    // Trigger status update for operations that change git state
    if (result.success && statusUpdateOperations.includes(operation)) {
      await this._triggerStatusUpdate(taskId, appLocals);
    }
    
    return {
      success: result.success,
      output: result.output,
      error: result.error
    };
  }

  /**
   * Get comprehensive diff for a task
   * @param {string} taskId - Task ID
   * @param {string} compareWith - What to compare with ('working' or 'base')
   * @param {string} githubToken - GitHub token for git operations
   * @returns {Promise<Object>} Task diff information
   */
  async getTaskDiff(taskId, compareWith = 'working', githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // Use unified diff method
    const compareTarget = compareWith === 'base' ? `origin/${project.base_branch}` : 'working';
    const diffResult = await gitService.getComprehensiveDiff(task.worktree_path, compareTarget);
    
    // Convert Map to array and include diffs for working directory comparisons
    const files = [];
    for (const [path, fileInfo] of diffResult.files) {
      const file = {
        path: fileInfo.path,
        type: fileInfo.type,
        additions: fileInfo.additions,
        deletions: fileInfo.deletions,
        status: fileInfo.status, // Git status code
        staged: fileInfo.staged,
        unstaged: fileInfo.unstaged,
        untracked: fileInfo.untracked
      };
      
      // For working directory comparisons, include diff content
      // For base comparisons, let frontend load on demand for performance
      if (compareWith === 'working') {
        file.diff = await gitService.getFileDiffContent(
          task.worktree_path, 
          fileInfo.path, 
          compareTarget, 
          fileInfo
        );
      }
      
      files.push(file);
    }
    
    // Check if working directory is clean
    const statusResult = await gitService.getStatus(task.worktree_path);
    const hasWorkingChanges = statusResult.output.trim().length > 0;
    
    return { 
      files,
      compareWith,
      hasWorkingChanges
    };
  }

  /**
   * Get diff for a specific file
   * @param {string} taskId - Task ID
   * @param {string} filePath - Path to the file
   * @param {string} compareWith - What to compare with ('working', 'base', or 'all')
   * @param {string} githubToken - GitHub token for git operations
   * @returns {Promise<Object>} File diff information
   */
  async getFileDiff(taskId, filePath, compareWith = 'working', githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Use unified diff method
    let compareTarget;
    if (compareWith === 'base') {
      compareTarget = `origin/${project.base_branch}`;
    } else if (compareWith === 'all') {
      // For 'all', we want the total diff from base branch to working tree
      compareTarget = `origin/${project.base_branch}`;
    } else {
      compareTarget = 'working';
    }
    
    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // Get file info first to know its state
    const diffResult = await gitService.getComprehensiveDiff(task.worktree_path, compareTarget);
    const fileInfo = diffResult.files.get(filePath);
    
    // Get the diff content
    const diff = await gitService.getFileDiffContent(
      task.worktree_path, 
      filePath, 
      compareTarget, 
      fileInfo,
      compareWith === 'all' // Pass flag to indicate we want complete diff
    );
    
    return {
      path: filePath,
      diff: diff,
      hasDiff: diff.trim().length > 0
    };
  }

  /**
   * Get commit history for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for git operations
   * @returns {Promise<Array>} Array of commit objects
   */
  async getCommitHistory(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // Get commit history
    const logResult = await gitService.log(
      task.worktree_path, 
      '--pretty=format:%H|%s|%an|%ar|%P --max-count=50'
    );
    
    const commits = logResult.output.trim().split('\n').map(line => {
      const [hash, message, author, date, parents] = line.split('|');
      // Check if this is a merge commit (has more than one parent)
      const isMerge = parents && parents.trim().split(' ').length > 1;
      
      return {
        hash,
        message,
        author,
        date,
        isMerge
      };
    });
    
    return commits;
  }

  /**
   * Get git configuration (user name and email)
   * @returns {Promise<Object>} Git configuration
   */
  async getGitConfig() {
    return this._getGitConfig();
  }

  // Private helper methods

  /**
   * Get git config from settings
   * @private
   */
  async _getGitConfig() {
    // Get git config from settings
    const gitUserName = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    return {
      name: gitUserName?.value || 'PocketDev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
  }

  /**
   * Check if branch has remote tracking
   * @private
   */
  async _checkRemoteTracking(gitService, task) {
    try {
      const remoteCheckResult = await gitService.command(
        task.worktree_path,
        `git rev-parse --verify origin/${task.branch} 2>/dev/null`
      );
      return remoteCheckResult.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Trigger git status update after operations that change git state
   * @private
   */
  async _triggerStatusUpdate(taskId, appLocals) {
    // For now, we'll still use the app.locals pattern for git status monitor
    // This will be refactored when we extract the GitStatusMonitor service
    if (appLocals && appLocals.gitStatusMonitor) {
      appLocals.gitStatusMonitor.checkTask(taskId).catch(err => 
        console.error(`Failed to update git status for task ${taskId}:`, err)
      );
    }
  }
}