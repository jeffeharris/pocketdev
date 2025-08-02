/**
 * Controller for git-related task operations
 */
export class TaskGitController {
  constructor(models) {
    this.models = models;
  }


  /**
   * Get detailed git status
   */
  async getGitStatus(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Use GitStatusService from service registry
      const gitStatusService = req.services.get('GitStatusService');
      const gitStatus = await gitStatusService.getTaskGitStatus(taskId, req.githubToken);
      
      res.json(gitStatus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get changed files with diff details
   */
  async getChangedFiles(req, res) {
    const { projectId, taskId } = req.params;
    const { compareWith = 'working' } = req.query;
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Use GitStatusService from service registry
      const gitStatusService = req.services.get('GitStatusService');
      const changedFiles = await gitStatusService.getTaskChangedFiles(taskId, req.githubToken, compareWith);
      
      res.json(changedFiles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all changes including working tree and committed changes not in base branch
   */
  async getAllChanges(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Use GitStatusService from service registry
      const gitStatusService = req.services.get('GitStatusService');
      const response = await gitStatusService.getTaskAllChanges(taskId, req.githubToken);
      
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get full diff for all changes in a task
   */
  async getTaskDiff(req, res) {
    const { projectId, taskId } = req.params;
    const { compareWith = 'working' } = req.query; // 'working' or 'base'
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Use GitOperationService from service registry
      const gitOperationService = req.services.get('GitOperationService');
      const diffResult = await gitOperationService.getTaskDiff(taskId, compareWith, req.githubToken);
      
      res.json(diffResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }


  /**
   * Get diff for a specific file
   */
  async getFileDiff(req, res) {
    const { projectId, taskId, file } = req.params;
    const { compareWith = 'working' } = req.query; // 'working', 'base', or 'all'
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Use GitOperationService from service registry
      const gitOperationService = req.services.get('GitOperationService');
      const diffResult = await gitOperationService.getFileDiff(taskId, file, compareWith, req.githubToken);
      
      res.json(diffResult);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get commit history for a task
   */
  async getCommitHistory(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Use GitOperationService from service registry
      const gitOperationService = req.services.get('GitOperationService');
      const commits = await gitOperationService.getCommitHistory(taskId, req.githubToken);
      
      res.json(commits);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Check for conflicts (simplified endpoint)
   */
  async checkConflicts(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Use GitStatusService from service registry
      const gitStatusService = req.services.get('GitStatusService');
      const conflictInfo = await gitStatusService.getTaskConflicts(taskId, req.githubToken);
      
      res.json(conflictInfo);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }


  async gitOperation(req, res) {
    const { projectId, taskId } = req.params;
    const { operation, message, files } = req.body;
    
    try {
      // Validate task belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Use GitOperationService from service registry
      const gitOperationService = req.services.get('GitOperationService');
      const options = {
        message,
        files,
        args: req.body.args,
        commit: req.body.commit
      };
      
      const result = await gitOperationService.executeOperation(
        taskId, 
        operation, 
        options, 
        req.githubToken,
        req.app.locals
      );
      
      res.json(result);
    } catch (error) {
      if (error.message === 'File path required for unstage operation' || 
          error.message === 'Commit message required' || 
          error.message === 'Commit hash required for reset' ||
          error.message === 'Invalid operation') {
        res.status(400).json({ success: false, error: error.message });
      } else {
        res.status(500).json({ success: false, error: error.message });
      }
    }
  }
}