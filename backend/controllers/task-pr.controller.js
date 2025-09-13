/**
 * Controller for pull request operations
 * 
 * This controller handles HTTP requests and delegates business logic
 * to the PullRequestService.
 */
export class TaskPullRequestController {
  constructor(models) {
    this.models = models;
  }

  /**
   * Create pull request
   */
  async createPullRequest(req, res) {
    const { projectId, taskId } = req.params;
    const { description } = req.body;
    
    try {
      // Validate task belongs to project
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service

      // Get PullRequestService from service registry
      const pullRequestService = req.services.PullRequestService;
      
      // Trigger git status update check after push
      if (req.services.gitStatusMonitor) {
        req.services.gitStatusMonitor.checkTask(taskId).catch(err => 
          console.error('Failed to update git status after push:', err)
        );
      }
      
      // Create PR using service
      const prResult = await pullRequestService.createPullRequest(
        taskId,
        req.services.git,
        req.services.github,
        { description }
      );
      
      res.json(prResult);
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
      // Validate task belongs to project
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service

      // Get PullRequestService from service registry
      const pullRequestService = req.services.PullRequestService;
      
      // Trigger git status update check after merge
      if (req.services.gitStatusMonitor) {
        req.services.gitStatusMonitor.checkTask(taskId).catch(err => 
          console.error('Failed to update git status after merge:', err)
        );
      }
      
      // Merge PR using service
      const mergeResult = await pullRequestService.mergePullRequest(
        taskId,
        req.services.git,
        req.services.github
      );
      
      res.json(mergeResult);
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
      // Validate task belongs to project
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service

      // Get PullRequestService from service registry
      const pullRequestService = req.services.PullRequestService;
      
      // Get PR status using service
      const prStatus = await pullRequestService.getPullRequestStatus(
        taskId,
        req.services.git,
        req.services.github
      );
      
      res.json(prStatus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}