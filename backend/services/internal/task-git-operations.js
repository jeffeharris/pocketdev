import { GitService } from '../git.service.js';

/**
 * TaskGitOperations - Handles all git operations for tasks
 * This is an internal service used by TaskService
 */
export class TaskGitOperations {
  constructor(models, githubTokenService) {
    this.models = models;
    this.githubTokenService = githubTokenService;
  }

  /**
   * Get git status for a task
   */
  async getTaskGitStatus(task, githubToken) {
    if (!task.worktree_path || !require('fs').existsSync(task.worktree_path)) {
      return null;
    }
    
    const gitService = new GitService(githubToken);
    const status = await gitService.getStatus(task.worktree_path);
    
    // Get branch info
    const currentBranch = await gitService.getCurrentBranch(task.worktree_path);
    const aheadBehind = await gitService.getAheadBehind(task.worktree_path, task.branch);
    
    return {
      branch: currentBranch,
      ...status,
      ahead: aheadBehind.ahead,
      behind: aheadBehind.behind
    };
  }

  /**
   * Pull updates from remote
   */
  async pullUpdates(task, project, githubToken) {
    const gitService = new GitService(githubToken);
    
    // First, check for uncommitted changes
    const status = await gitService.getStatus(task.worktree_path);
    if (status.hasChanges && !status.isClean) {
      const error = new Error('Cannot update: You have uncommitted changes');
      error.statusCode = 409;
      error.hasUncommitted = true;
      error.changes = status.files || [];
      throw error;
    }
    
    // Fetch latest changes
    const fetchResult = await gitService.fetch(task.worktree_path, { all: true });
    if (!fetchResult.success) {
      throw new Error(`Failed to fetch updates: ${fetchResult.error}`);
    }
    
    // Merge updates from base branch
    const mergeResult = await gitService.merge(
      task.worktree_path, 
      `origin/${project.base_branch}`,
      { strategy: 'recursive' }
    );
    
    if (!mergeResult.success) {
      if (mergeResult.output && mergeResult.output.includes('CONFLICT')) {
        const error = new Error('Merge conflicts detected');
        error.statusCode = 409;
        error.hasConflicts = true;
        error.conflicts = this._parseConflicts(mergeResult.output);
        throw error;
      }
      throw new Error(`Failed to merge updates: ${mergeResult.error}`);
    }
    
    return {
      success: true,
      message: 'Successfully updated from base branch',
      details: mergeResult.output
    };
  }

  /**
   * Check for merge conflicts
   */
  async checkMergeConflicts(task, project, githubToken) {
    const gitService = new GitService(githubToken);
    
    // Check if task branch exists on remote
    const branchesResult = await gitService.getBranches(task.worktree_path, true);
    const remoteBranch = `origin/${task.branch}`;
    const hasRemoteBranch = branchesResult.branches?.some(b => 
      b.includes(remoteBranch) || b.includes(`remotes/${remoteBranch}`)
    );
    
    // Use git merge-tree for non-destructive conflict check
    const conflicts = await gitService.checkConflicts(
      task.worktree_path,
      project.base_branch
    );
    
    return {
      hasConflicts: conflicts.hasConflicts,
      conflicts: conflicts.conflicts || [],
      canMerge: !conflicts.hasConflicts,
      hasRemoteBranch
    };
  }

  /**
   * Merge task to base branch
   */
  async mergeToBase(task, project, githubToken) {
    const gitService = new GitService(githubToken);
    
    // First ensure the task branch is pushed to origin
    const pushResult = await gitService.push(task.worktree_path, task.branch, { setUpstream: true });
    
    if (!pushResult.success) {
      const error = new Error(`Failed to push branch: ${pushResult.error}`);
      error.statusCode = 500;
      error.output = pushResult.output;
      throw error;
    }
    
    // Switch to base branch
    const checkoutResult = await gitService.checkout(project.local_path, project.base_branch);
    if (!checkoutResult.success) {
      throw new Error(`Failed to checkout base branch: ${checkoutResult.error}`);
    }
    
    // Pull latest base branch changes
    const pullResult = await gitService.pull(project.local_path);
    if (!pullResult.success) {
      throw new Error(`Failed to pull latest changes: ${pullResult.error}`);
    }
    
    // Merge the task branch
    const mergeResult = await gitService.merge(
      project.local_path, 
      task.branch,
      { noCommit: false }
    );
    
    if (!mergeResult.success) {
      // Try to recover by checking out task branch again
      await gitService.checkout(project.local_path, task.branch);
      
      const error = new Error(`Failed to merge: ${mergeResult.error}`);
      error.statusCode = 409;
      if (mergeResult.output?.includes('CONFLICT')) {
        error.hasConflicts = true;
        error.conflicts = this._parseConflicts(mergeResult.output);
      }
      throw error;
    }
    
    // Push the merged changes
    const pushMergeResult = await gitService.push(project.local_path, project.base_branch);
    if (!pushMergeResult.success) {
      throw new Error(`Failed to push merged changes: ${pushMergeResult.error}`);
    }
    
    // Get merge commit SHA
    const mergeCommitResult = await gitService.getCurrentCommit(project.local_path);
    const mergeCommitSha = mergeCommitResult.output?.trim();
    
    // Switch back to task branch
    await gitService.checkout(project.local_path, task.branch);
    
    return {
      success: true,
      message: `Successfully merged ${task.branch} into ${project.base_branch}`,
      mergedCommit: mergeCommitSha,
      mergedAt: new Date().toISOString()
    };
  }

  /**
   * Check merge status
   */
  async checkMergeStatus(task, project, githubToken) {
    if (!task.merged_at || !task.merge_commit_sha) {
      return null;
    }

    const gitService = new GitService(githubToken);

    try {
      // Get current HEAD
      const currentHead = await gitService.getCurrentCommit(task.worktree_path);
      
      // Check if we have commits since merge
      let hasCommitsSinceMerge = false;
      if (currentHead !== task.merge_commit_sha) {
        // Count commits since merge
        const countResult = await gitService.execute(
          `git rev-list ${task.merge_commit_sha}..HEAD --count 2>/dev/null || echo 0`,
          task.worktree_path
        );
        const commitsSinceMerge = parseInt(countResult.output.trim()) || 0;
        
        // Check if there are actual differences with the base branch
        if (project.base_branch) {
          const diffResult = await gitService.execute(
            `git diff ${project.base_branch}..HEAD --name-only`,
            task.worktree_path
          );
          const hasDifferences = diffResult.output.trim().length > 0;
          hasCommitsSinceMerge = hasDifferences;
        } else {
          hasCommitsSinceMerge = commitsSinceMerge > 0;
        }
      }
      
      return {
        mergedAt: task.merged_at,
        mergeCommitSha: task.merge_commit_sha,
        hasCommitsSinceMerge: hasCommitsSinceMerge,
        currentHead: currentHead
      };
    } catch (error) {
      console.error('Error checking merge status:', error);
      return {
        mergedAt: task.merged_at,
        mergeCommitSha: task.merge_commit_sha,
        error: 'Could not verify merge status'
      };
    }
  }

  /**
   * Parse conflict output
   * @private
   */
  _parseConflicts(output) {
    const conflicts = [];
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('CONFLICT')) {
        conflicts.push(line);
      }
    }
    
    return conflicts;
  }
}