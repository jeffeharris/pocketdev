import { GitService } from './git-core.service.js';

/**
 * PullRequestService - Handles all pull request operations
 * 
 * This service provides a clean interface for GitHub pull request management,
 * hiding the complexity of GitHub CLI interactions, branch management,
 * token handling, and merge strategies.
 * 
 * Following deep module principles: simple interface (6 methods), 
 * complex GitHub API interactions hidden inside.
 */
export class PullRequestService {
  constructor(models, githubTokenService, eventEmitterService = null) {
    this.models = models;
    this.githubTokenService = githubTokenService;
    this.eventEmitterService = eventEmitterService;
  }

  /**
   * Create a pull request for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @param {Object} options - PR creation options
   * @returns {Promise<Object>} Created PR information
   */
  async createPullRequest(taskId, githubToken, options = {}) {
    const { description } = options;
    
    // Get task and validate
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    // Get project for base branch
    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }

    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // First ensure the branch is pushed
    const pushResult = await gitService.push(task.worktree_path, task.branch, { setUpstream: true });
    if (!pushResult.success && !pushResult.error?.includes('Everything up-to-date')) {
      throw new Error(`Failed to push branch: ${pushResult.error}`);
    }
    
    // Generate PR title and body
    const prTitle = this._generatePRTitle(task);
    const prBody = this._generatePRBody(task, description);
    
    // Create PR using GitHub CLI
    const prResult = await gitService.createPullRequest(
      task.worktree_path,
      prTitle,
      prBody,
      project.base_branch
    );
    
    if (!prResult.success) {
      throw new Error(`Failed to create pull request: ${prResult.error}`);
    }
    
    // Extract PR information from GitHub CLI output
    const prInfo = this._extractPRInfoFromOutput(prResult.output);
    
    // Update task with PR information
    if (prInfo.url) {
      await this.models.tasks.update(task.id, {
        pr_url: prInfo.url,
        pr_number: prInfo.number
      });
    }
    
    // Emit event for real-time updates
    this._emitEvent('pr.created', {
      taskId: task.id,
      projectId: task.project_id,
      prNumber: prInfo.number,
      prUrl: prInfo.url,
      title: prTitle
    });
    
    return {
      id: prInfo.number,
      url: prInfo.url,
      title: prTitle,
      description: prBody,
      state: 'open',
      mergeable: true,
      conflicts: false
    };
  }

  /**
   * Get pull request status for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @returns {Promise<Object>} PR status information
   */
  async getPullRequestStatus(taskId, githubToken) {
    // Get task and validate
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!task.pr_number) {
      throw new Error('No pull request found for this task');
    }
    
    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // Get PR status using GitHub CLI
    const prResult = await gitService.command(task.worktree_path,
      `gh pr view ${task.pr_number} --json state,mergeable,title,url`);
    
    if (!prResult.success) {
      throw new Error(`Failed to get PR status: ${prResult.error}`);
    }
    
    // Parse GitHub CLI response
    let prData;
    try {
      prData = JSON.parse(prResult.output);
    } catch (parseError) {
      throw new Error('Failed to parse PR data from GitHub');
    }
    
    return {
      id: task.pr_number,
      url: prData.url,
      title: prData.title,
      state: prData.state,
      mergeable: prData.mergeable === 'MERGEABLE',
      conflicts: prData.mergeable === 'CONFLICTING'
    };
  }

  /**
   * Merge a pull request for a task
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @param {Object} options - Merge options
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(taskId, githubToken, options = {}) {
    const { strategy = 'squash', deleteSourceBranch = true } = options;
    
    // Get task and validate
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!task.pr_number) {
      throw new Error('No pull request found for this task');
    }
    
    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // Build merge command based on strategy
    const mergeCommand = this._buildMergeCommand(task.pr_number, strategy, deleteSourceBranch);
    
    // Execute merge
    const mergeResult = await gitService.command(task.worktree_path, mergeCommand);
    
    if (!mergeResult.success) {
      throw new Error(`Failed to merge pull request: ${mergeResult.error}`);
    }
    
    // Update task status
    await this.models.tasks.update(task.id, {
      status: 'merged',
      merged_at: new Date().toISOString()
    });
    
    // Emit event for real-time updates
    this._emitEvent('pr.merged', {
      taskId: task.id,
      projectId: task.project_id,
      prNumber: task.pr_number,
      strategy
    });
    
    return {
      success: true,
      message: `Pull request #${task.pr_number} merged successfully`,
      output: mergeResult.output
    };
  }

  /**
   * Update pull request title and/or body
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @param {Object} updates - Updates to apply
   * @returns {Promise<Object>} Update result
   */
  async updatePullRequest(taskId, githubToken, updates = {}) {
    const { title, body } = updates;
    
    // Get task and validate
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!task.pr_number) {
      throw new Error('No pull request found for this task');
    }
    
    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // Build update command
    const updateParts = [];
    if (title) updateParts.push(`--title "${title}"`);
    if (body) updateParts.push(`--body "${body}"`);
    
    if (updateParts.length === 0) {
      throw new Error('No updates provided');
    }
    
    const updateCommand = `gh pr edit ${task.pr_number} ${updateParts.join(' ')}`;
    
    // Execute update
    const updateResult = await gitService.command(task.worktree_path, updateCommand);
    
    if (!updateResult.success) {
      throw new Error(`Failed to update pull request: ${updateResult.error}`);
    }
    
    // Emit event for real-time updates
    this._emitEvent('pr.updated', {
      taskId: task.id,
      projectId: task.project_id,
      prNumber: task.pr_number,
      updates
    });
    
    return {
      success: true,
      message: `Pull request #${task.pr_number} updated successfully`
    };
  }

  /**
   * Close pull request without merging
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @returns {Promise<Object>} Close result
   */
  async closePullRequest(taskId, githubToken) {
    // Get task and validate
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }

    if (!task.pr_number) {
      throw new Error('No pull request found for this task');
    }
    
    // Create GitService with token
    const gitService = new GitService(githubToken);
    
    // Close PR
    const closeResult = await gitService.command(task.worktree_path,
      `gh pr close ${task.pr_number}`);
    
    if (!closeResult.success) {
      throw new Error(`Failed to close pull request: ${closeResult.error}`);
    }
    
    // Update task status
    await this.models.tasks.update(task.id, {
      status: 'closed'
    });
    
    // Emit event for real-time updates
    this._emitEvent('pr.closed', {
      taskId: task.id,
      projectId: task.project_id,
      prNumber: task.pr_number
    });
    
    return {
      success: true,
      message: `Pull request #${task.pr_number} closed successfully`
    };
  }

  // Private helper methods

  /**
   * Generate PR title from task information
   * @private
   */
  _generatePRTitle(task) {
    return task.name || `Updates from task: ${task.branch}`;
  }

  /**
   * Generate PR body from task information and description
   * @private
   */
  _generatePRBody(task, description) {
    if (description) {
      return description;
    }
    
    return `Task: ${task.name}\nBranch: ${task.branch}\n\nCreated by PocketDev`;
  }

  /**
   * Extract PR information from GitHub CLI output
   * @private
   */
  _extractPRInfoFromOutput(output) {
    // Extract PR URL from output
    const prUrlMatch = output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
    const prUrl = prUrlMatch ? prUrlMatch[0] : null;
    
    // Extract PR number
    const prNumberMatch = prUrl ? prUrl.match(/\/pull\/(\d+)/) : null;
    const prNumber = prNumberMatch ? parseInt(prNumberMatch[1]) : null;
    
    return {
      url: prUrl,
      number: prNumber
    };
  }

  /**
   * Build merge command based on strategy
   * @private
   */
  _buildMergeCommand(prNumber, strategy, deleteSourceBranch) {
    const strategyFlag = strategy === 'merge' ? '--merge' : 
                        strategy === 'rebase' ? '--rebase' : '--squash';
    const deleteBranchFlag = deleteSourceBranch ? '--delete-branch' : '';
    
    return `gh pr merge ${prNumber} ${strategyFlag} ${deleteBranchFlag}`.trim();
  }

  /**
   * Emit event if event emitter service is available
   * @private
   */
  _emitEvent(eventName, data) {
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(eventName, data);
    }
  }
}