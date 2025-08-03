import { GitService } from './git-compat.js';

/**
 * GitStatusService - Handles all git status operations
 * 
 * This service provides a clean interface for getting git status information,
 * hiding the complexity of worktree paths, git command execution, and status parsing.
 * 
 * Following deep module principles: simple interface (4 methods), complex implementation.
 */
export class GitStatusService {
  constructor(models, githubTokenService) {
    this.models = models;
    this.githubTokenService = githubTokenService;
  }

  /**
   * Get comprehensive git status for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for git operations
   * @returns {Promise<Object>} Comprehensive git status information
   */
  async getTaskGitStatus(taskId, githubToken) {
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
    
    // Debug logging for merged tasks with changes
    if (task.status === 'merged' || task.merged_at) {
      console.log(`[GitStatus] Checking merged task ${taskId} on branch ${task.branch}`);
      const statusResult = await gitService.command(task.worktree_path, 'git status --porcelain');
      if (statusResult.output.trim()) {
        console.log(`[GitStatus] Merged task has changes:`, statusResult.output);
        const branchResult = await gitService.command(task.worktree_path, 'git branch --show-current');
        console.log(`[GitStatus] Task worktree is on branch:`, branchResult.output.trim());
      }
    }

    // Get detailed git status
    const statusResult = await gitService.getStatus(task.worktree_path);
    const cleanStatus = statusResult.output.trim().length === 0;
    
    // Check ahead/behind status
    const aheadBehind = await this._getAheadBehindStatus(gitService, task, project);
    
    // Count changed files
    let filesChanged = 0;
    if (!cleanStatus) {
      filesChanged = statusResult.output.split('\n').filter(line => line.trim()).length;
    }

    // Get detailed status including staged/unstaged counts
    const detailedStatus = await gitService.getDetailedStatus(task.worktree_path);

    // Check if branch has remote tracking
    const hasRemoteTracking = await this._checkRemoteTracking(gitService, task);

    return {
      clean: cleanStatus,
      ahead: aheadBehind.ahead,
      behind: aheadBehind.behind,
      filesChanged,
      staged: detailedStatus.staged,
      unstaged: detailedStatus.unstaged,
      untracked: detailedStatus.untracked,
      hasRemoteTracking,
      rawStatus: statusResult.output
    };
  }

  /**
   * Get changed files with diff details for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for git operations
   * @param {string} compareWith - What to compare with ('working' or 'base')
   * @returns {Promise<Array>} Array of changed files with details
   */
  async getTaskChangedFiles(taskId, githubToken, compareWith = 'working') {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }

    const gitService = new GitService(githubToken);
    
    // Use comprehensive diff method to get proper line counts
    const compareTarget = compareWith === 'base' ? `origin/${project.base_branch}` : 'working';
    const diffResult = await gitService.getComprehensiveDiff(task.worktree_path, compareTarget);
    
    // Convert Map to array
    const changedFiles = [];
    for (const [path, fileInfo] of diffResult.files) {
      changedFiles.push({
        path: fileInfo.path,
        type: fileInfo.type,
        additions: fileInfo.additions,
        deletions: fileInfo.deletions,
        staged: fileInfo.staged || false,
        unstaged: fileInfo.unstaged || false,
        untracked: fileInfo.untracked || false,
        committed: fileInfo.diffType === 'committed'
      });
    }
    
    return changedFiles;
  }

  /**
   * Get all changes for a task including working tree and committed changes
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for git operations
   * @returns {Promise<Object>} All changes with categorized files and summary
   */
  async getTaskAllChanges(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }

    const gitService = new GitService(githubToken);
    
    // Get all changes using the git service method
    const allChanges = await gitService.getAllChanges(
      task.worktree_path,
      `origin/${project.base_branch}`
    );
    
    // Get unpushed commits info
    const unpushedInfo = await gitService.getUnpushedCommitsInfo(
      task.worktree_path,
      task.branch
    );
    
    // Format response with categorized files
    return {
      files: allChanges.files.map(file => ({
        path: file.path,
        type: file.type,
        additions: file.additions,
        deletions: file.deletions,
        category: file.category,
        status: file.status,
        staged: file.staged || false,
        unstaged: file.unstaged || false,
        untracked: file.untracked || false,
        committed: file.category === 'committed'
      })),
      summary: {
        ...allChanges.summary,
        unpushedCommits: unpushedInfo.count
      },
      unpushedCommits: unpushedInfo.commits
    };
  }

  /**
   * Check for merge conflicts for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for git operations
   * @returns {Promise<Object>} Conflict information
   */
  async getTaskConflicts(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }

    const gitService = new GitService(githubToken);
    
    const conflicts = await gitService.checkMergeConflicts(
      task.worktree_path, 
      `origin/${project.base_branch}`
    );
    
    return {
      hasConflicts: conflicts.hasConflicts,
      conflicts: conflicts.conflicts || []
    };
  }

  // Private helper methods

  /**
   * Get ahead/behind status for a task
   * @private
   */
  async _getAheadBehindStatus(gitService, task, project) {
    let aheadBehind = { ahead: 0, behind: 0 };
    try {
      const aheadResult = await gitService.command(task.worktree_path, 
        `git rev-list --count origin/${project.base_branch}..HEAD`);
      const behindResult = await gitService.command(task.worktree_path,
        `git rev-list --count HEAD..origin/${project.base_branch}`);
      
      aheadBehind.ahead = parseInt(aheadResult.output.trim()) || 0;
      aheadBehind.behind = parseInt(behindResult.output.trim()) || 0;
    } catch (error) {
      console.warn('Could not get ahead/behind status:', error);
    }
    return aheadBehind;
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
}