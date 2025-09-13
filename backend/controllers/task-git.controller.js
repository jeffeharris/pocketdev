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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service
      
      // Use GitService from services
      const gitService = req.services.git || req.services.GitService;
      if (!gitService) {
        throw new Error('GitService not available');
      }
      
      // Get git status directly
      const gitStatus = await gitService.getStatus(task.worktree_path);
      
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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service
      
      // Use GitService from services
      const gitService = req.services.git || req.services.GitService;
      if (!gitService) {
        throw new Error('GitService not available');
      }
      
      // Get changed files using diff
      const projectService = req.services.ProjectService;
      const project = await projectService.get(task.project_id);
      const baseBranch = `origin/${project.base_branch || 'main'}`;
      const changedFiles = await gitService.getDiff(task.worktree_path, baseBranch, 'HEAD', { nameOnly: true });
      
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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service
      
      // Use GitService from services
      const gitService = req.services.git || req.services.GitService;
      if (!gitService) {
        throw new Error('GitService not available');
      }
      
      // Get all changes
      const status = await gitService.getStatus(task.worktree_path);
      const projectService = req.services.ProjectService;
      const project = await projectService.get(task.project_id);
      const diff = await gitService.getDiff(task.worktree_path, `origin/${project.base_branch}`, 'HEAD', { stat: true });
      const response = { status, diff };
      
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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service

      // Use GitService from services
      const gitService = req.services.git || req.services.GitService;
      if (!gitService) {
        throw new Error('GitService not available');
      }
      
      // Get diff based on compareWith option
      const projectService = req.services.ProjectService;
      const project = await projectService.get(task.project_id);
      const fromRef = compareWith === 'base' ? `origin/${project.base_branch}` : 'HEAD';
      const diffResult = await gitService.getDiff(task.worktree_path, fromRef, 'HEAD');
      
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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service

      // Use GitService from services
      const gitService = req.services.git || req.services.GitService;
      if (!gitService) {
        throw new Error('GitService not available');
      }
      // Get file diff
      const projectService = req.services.ProjectService;
      const project = await projectService.get(task.project_id);
      const fromRef = compareWith === 'base' ? `origin/${project.base_branch}` : 'HEAD';
      const diffResult = await gitService.getDiff(task.worktree_path, fromRef, 'HEAD');
      
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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service

      // Use GitService from services
      const gitService = req.services.git || req.services.GitService;
      if (!gitService) {
        throw new Error('GitService not available');
      }
      // Get commit history - this needs a custom implementation
      // For now, return empty array as GitService doesn't have this method yet
      const commits = [];
      
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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service

      // Use GitStatusService from services
      const gitStatusService = req.services.GitStatusService;
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
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, [], { projectId });
      // Validation handled by service
      
      // Use GitService from services
      const gitService = req.services.git || req.services.GitService;
      if (!gitService) {
        throw new Error('GitService not available');
      }
      
      const options = {
        message,
        files,
        args: req.body.args,
        commit: req.body.commit
      };
      
      // Execute git operation based on type
      let result;
      switch(operation) {
        case 'commit':
          result = await gitService.commit(task.worktree_path, options.message, options.files);
          break;
        case 'push':
          result = await gitService.push(task.worktree_path, task.branch, { setUpstream: true });
          break;
        case 'pull':
          result = await gitService.pull(task.worktree_path);
          break;
        default:
          throw new Error(`Unsupported operation: ${operation}`);
      }
      
      res.json(result);
    } catch (error) {
      
      if (error.message === 'File path required for unstage operation' || 
          error.message === 'Commit message required' || 
          error.message === 'Commit hash required for reset' ||
          error.message === 'Invalid operation') {
        res.status(400).json({ error: error.message });
      } else {
        res.status(500).json({ error: error.message });
      }
    }
  }
}