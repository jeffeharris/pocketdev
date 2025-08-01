import { GitService } from '../services/git.service.js';

/**
 * Controller for pull request operations
 */
export class TaskPullRequestController {
  constructor(models) {
    this.models = models;
    // Don't create a default GitService - we'll create one per request with the token
  }

  /**
   * Create pull request
   */
  async createPullRequest(req, res) {
    const { projectId, taskId } = req.params;
    const { description } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await this.models.projects.findById(projectId);
      
      // Create GitService with token from middleware
      const gitService = new GitService(req.githubToken);
      
      // First ensure the branch is pushed
      const pushResult = await gitService.push(task.worktree_path, task.branch, { setUpstream: true });
      if (!pushResult.success && !pushResult.error?.includes('Everything up-to-date')) {
        return res.status(500).json({ 
          error: 'Failed to push branch', 
          details: pushResult.error 
        });
      }
      
      // Trigger git status update check after push
      if (req.app.locals.gitStatusMonitor) {
        req.app.locals.gitStatusMonitor.checkTask(taskId).catch(err => 
          console.error('Failed to update git status after push:', err)
        );
      }
      
      // Create PR using GitHub CLI
      const prTitle = task.name || `Updates from task: ${task.branch}`;
      const prBody = description || `Task: ${task.name}\nBranch: ${task.branch}\n\nCreated by PocketDev`;
      
      const prResult = await gitService.createPullRequest(
        task.worktree_path,
        prTitle,
        prBody,
        project.base_branch
      );
      
      if (!prResult.success) {
        return res.status(500).json({ 
          error: 'Failed to create pull request', 
          details: prResult.error 
        });
      }
      
      // Extract PR URL from output
      const prUrlMatch = prResult.output.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/);
      const prUrl = prUrlMatch ? prUrlMatch[0] : null;
      
      // Extract PR number
      const prNumberMatch = prUrl ? prUrl.match(/\/pull\/(\d+)/) : null;
      const prNumber = prNumberMatch ? parseInt(prNumberMatch[1]) : null;
      
      // Update task with PR info
      if (prUrl) {
        await this.models.tasks.update(task.id, {
          pr_url: prUrl,
          pr_number: prNumber
        });
      }
      
      res.json({
        id: prNumber,
        url: prUrl,
        title: prTitle,
        description: prBody,
        state: 'open',
        mergeable: true,
        conflicts: false
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Merge pull request
   */
  async mergePullRequest(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (!task.pr_number) {
        return res.status(400).json({ error: 'No pull request found for this task' });
      }
      
      // Create GitService with token from middleware
      const gitService = new GitService(req.githubToken);
      
      // Merge PR using GitHub CLI
      const mergeResult = await gitService.command(task.worktree_path,
        `gh pr merge ${task.pr_number} --squash --delete-branch`);
      
      if (!mergeResult.success) {
        return res.status(500).json({ 
          error: 'Failed to merge pull request', 
          details: mergeResult.error 
        });
      }
      
      // Trigger git status update check after merge
      if (req.app.locals.gitStatusMonitor) {
        req.app.locals.gitStatusMonitor.checkTask(taskId).catch(err => 
          console.error('Failed to update git status after merge:', err)
        );
      }
      
      // Update task status
      await this.models.tasks.update(task.id, {
        status: 'merged',
        merged_at: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: `Pull request #${task.pr_number} merged successfully`,
        output: mergeResult.output
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get PR status
   */
  async getPullRequestStatus(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      if (!task.pr_number) {
        return res.status(404).json({ error: 'No pull request found for this task' });
      }
      
      // Create GitService with token from middleware
      const gitService = new GitService(req.githubToken);
      
      // Get PR status using GitHub CLI
      const prResult = await gitService.command(task.worktree_path,
        `gh pr view ${task.pr_number} --json state,mergeable,title,url`);
      
      if (!prResult.success) {
        return res.status(500).json({ 
          error: 'Failed to get PR status', 
          details: prResult.error 
        });
      }
      
      try {
        const prData = JSON.parse(prResult.output);
        res.json({
          id: task.pr_number,
          url: prData.url,
          title: prData.title,
          state: prData.state,
          mergeable: prData.mergeable === 'MERGEABLE',
          conflicts: prData.mergeable === 'CONFLICTING'
        });
      } catch (parseError) {
        res.status(500).json({ error: 'Failed to parse PR data' });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}