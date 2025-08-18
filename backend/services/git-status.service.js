import { GitRepository } from './git-repository.service.js';
import { GitWorkingTree } from './git-workingtree.service.js';
import { GitAnalyzer } from './git-analyzer.service.js';

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

    // Create the modules we need
    const repository = new GitRepository(githubToken);
    const workingTree = new GitWorkingTree(githubToken);
    const analyzer = new GitAnalyzer(githubToken);
    

    // Get detailed git status
    const statusResult = await workingTree.getStatus(task.worktree_path);
    const cleanStatus = statusResult.output.trim().length === 0;
    
    // Check ahead/behind status
    const aheadBehind = await this._getAheadBehindStatus(repository, task, project);
    
    // Parse status to get file counts
    const statusLines = statusResult.output.trim().split('\n').filter(line => line);
    let staged = 0, unstaged = 0, untracked = 0;
    
    statusLines.forEach(line => {
      if (!line.trim()) return;
      const indexStatus = line[0];
      const workingStatus = line[1];
      
      if (line.startsWith('??')) {
        untracked++;
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') staged++;
        if (workingStatus !== ' ' && workingStatus !== '?') unstaged++;
      }
    });
    
    return {
      clean: cleanStatus,
      ahead: aheadBehind.ahead,
      behind: aheadBehind.behind,
      hasRemoteTracking: aheadBehind.hasRemoteTracking,
      staged,
      unstaged,
      untracked,
      filesChanged: staged + unstaged + untracked,
      rawStatus: statusResult.output
    };
  }

  /**
   * Get list of changed files for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for git operations
   * @param {string} compareTarget - Target to compare against ('working' or branch name)
   * @returns {Promise<Array>} List of changed files with details
   */
  async getTaskChangedFiles(taskId, githubToken, compareTarget = 'working') {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const analyzer = new GitAnalyzer(githubToken);
    
    // Use the analyzer's getFileChanges method
    const changes = await analyzer.getFileChanges(task.worktree_path, { compareTarget });
    
    return changes.files || [];
  }

  /**
   * Get all changes for a task (files, commits, summary)
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for git operations
   * @returns {Promise<Object>} Comprehensive change information
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
    
    const analyzer = new GitAnalyzer(githubToken);
    
    // Get file changes
    const fileChanges = await analyzer.getFileChanges(task.worktree_path);
    
    // Get unpushed commits
    const unpushedCommits = await analyzer.getUnpushedCommits(task.worktree_path, task.branch);
    
    return {
      files: fileChanges.files || [],
      summary: {
        ...fileChanges.summary,
        unpushedCommits: unpushedCommits.count || 0
      },
      unpushedCommits: unpushedCommits.commits || []
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
    
    const analyzer = new GitAnalyzer(githubToken);
    
    // Check for conflicts with base branch
    const targetBranch = `origin/${project.base_branch || 'main'}`;
    return await analyzer.checkMergeConflicts(task.worktree_path, targetBranch);
  }
  
  // Private helper methods
  async _getAheadBehindStatus(repository, task, project) {
    const baseBranch = `origin/${project.base_branch || 'main'}`;
    let ahead = 0, behind = 0, hasRemoteTracking = false;
    
    try {
      // Check if remote tracking branch exists
      const aheadResult = await repository.execute(
        `git rev-list --count ${baseBranch}..HEAD`,
        task.worktree_path
      );
      const behindResult = await repository.execute(
        `git rev-list --count HEAD..${baseBranch}`,
        task.worktree_path
      );
      
      if (aheadResult.success) {
        ahead = parseInt(aheadResult.output.trim()) || 0;
      }
      if (behindResult.success) {
        behind = parseInt(behindResult.output.trim()) || 0;
      }
      
      // Check if remote tracking exists
      const remoteCheckResult = await repository.execute(
        `git rev-parse --verify origin/${task.branch} 2>/dev/null`,
        task.worktree_path
      );
      hasRemoteTracking = remoteCheckResult.success;
    } catch (error) {
      // Silently handle errors - likely no remote tracking branch
    }
    
    return { ahead, behind, hasRemoteTracking };
  }
}