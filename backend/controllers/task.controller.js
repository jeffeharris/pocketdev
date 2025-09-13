import path from 'path';
import { WorktreeService } from '../services/worktree.service.js';

/**
 * Core task controller for CRUD operations
 * Git, PR, and Container operations are handled by separate controllers
 */
export class TaskController {
  constructor(models, projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), '../projects')) {
    this.models = models;
    this.projectsDir = projectsDir;
    this.worktreeService = new WorktreeService();
  }



  /**
   * Create a new task (worktree) within a project
   */
  async createTask(req, res) {
    const { projectId } = req.params;
    const { name, branch, useExistingBranch } = req.body;
    
    if (!name || !branch) {
      return res.status(400).json({ error: 'Task name and branch are required' });
    }
    
    try {
      // Get TaskService from services
      const taskService = req.services.TaskService;
      
      // Create task using service
      const result = await taskService.createTask(
        projectId,
        { name, branch, useExistingBranch },
        req.githubToken,
        { 
          createSession: true, 
          hostname: req.hostname 
        }
      );
      
      // Connect session monitor to the new task
      const sessionMonitor = req.services.wsAdapter;
      const aiMonitor = req.services.aiMonitor;
      if (sessionMonitor && aiMonitor && result.session?.sessionId) {
        try {
          console.log('Connecting monitor to new task session:', result.session.sessionId);
          await sessionMonitor.connectToSession(result.session.sessionId);
          await aiMonitor.registerSessionPatterns(result.session.sessionId);
        } catch (error) {
          console.warn('Failed to connect monitors:', error.message);
        }
      }
      
      res.json(result.task);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * List minimal task info for fast loading
   */
  async listTasksMinimal(req, res) {
    const { projectId } = req.params;
    
    try {
      const tasks = await this.models.tasks.findByProjectId(projectId);
      
      // Return only essential fields for instant UI rendering
      const minimalTasks = tasks.map(task => ({
        id: task.id,
        name: task.name || 'Untitled Task',
        branch: task.branch,
        worktree_path: task.worktree_path,
        created_at: task.created_at,
        taskState: task.status === 'merged' || task.merged_at ? 'merged' : 
                  task.is_archived ? 'archived' : 'active',
        // Placeholder session state - will be updated via websocket
        sessionState: { status: 'not-started', lastStateChange: null }
      }));
      
      res.json(minimalTasks);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * List all tasks for a project (with full git status)
   */
  /**
   * List all tasks for a project
   */
  async listTasks(req, res) {
    const { projectId } = req.params;
    
    try {
      const taskService = req.services.TaskService;
      const tasks = await taskService.list(projectId, {
        githubToken: req.githubToken,
        monitors: {
          aiMonitor: req.services.aiMonitor,
          sessionMonitor: req.services.wsAdapter
        }
      });
      res.json(tasks);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message });
    }
  }

  /**
   * Get task status (lightweight endpoint for polling/real-time updates)
   */
  async getTaskStatus(req, res) {
    const { taskId } = req.params;
    
    try {
      const taskService = req.services.TaskService;
      const task = await taskService.get(taskId, {
        includeGitStatus: true,
        includeSessionState: true,
        githubToken: req.githubToken
      });
      
      // Return status format expected by frontend
      const status = {
        id: task.id,
        taskState: task.status === 'merged' || task.merged_at ? 'merged' : 
                  task.is_archived ? 'archived' : 'active',
        sessionState: task.sessionState || { status: 'not-started' },
        gitStatus: task.gitStatus
      };
      
      res.json(status);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message });
    }
  }

  /**
   * Get task details with git status
   */
  /**
   * Get task details with git status
   */
  async getTask(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const taskService = req.services.TaskService;
      const result = await taskService.getTaskDetails(taskId, projectId, req.githubToken);
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message });
    }
  }
  /**
   * Update task metadata (name, description)
   */
  async updateTaskMetadata(req, res) {
    const { projectId, taskId } = req.params;
    const { name, description } = req.body;
    
    try {
      // Verify task exists and belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Get TaskService from services
      const taskService = req.services.TaskService;
      
      // Build update object with only provided fields
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      
      // Update task using service
      const updatedTask = await taskService.update(taskId, {
        metadata: updates
      });
      
      res.json(updatedTask);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get split layout configuration for a task
   */
  async getSplitLayout(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const taskService = req.services.TaskService;
      const layout = await taskService.get(taskId, {
        projectId,
        includeSplitLayout: true
      });
      res.json(layout);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message });
    }
  }

  /**
   * Update split layout configuration for a task
   */
  async updateSplitLayout(req, res) {
    const { projectId, taskId } = req.params;
    const splitLayout = req.body;
    
    try {
      const taskService = req.services.TaskService;
      const layout = await taskService.update(taskId, {
        projectId,
        splitLayout
      });
      res.json(layout);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message });
    }
  }

  /**
   * Check if task can be safely deleted
   */
  async checkDelete(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      // Verify task exists and belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Get TaskService from services
      const taskService = req.services.TaskService;
      
      // Check deletion safety using service
      const safetyCheck = await taskService.checkTaskDeletionSafety(taskId, req.githubToken);
      
      res.json(safetyCheck);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Delete or archive a task
   */
  async deleteTask(req, res) {
    const { projectId, taskId } = req.params;
    const { force = false, softDelete = true } = req.query;
    
    try {
      // Verify task exists and belongs to project
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Get TaskService from services
      const taskService = req.services.TaskService;
      
      // Delete task using service
      const result = await taskService.deleteTask(taskId, {
        force: force === 'true' || force === true,
        softDelete: softDelete === 'true' || softDelete === true
      });
      
      // Update project last accessed
      await this.models.projects.updateLastAccessed(task.project_id);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update task with remote changes
   */
  async updateTask(req, res) {
    const { projectId, taskId } = req.params;
    const { method = 'merge' } = req.body;
    
    try {
      const taskService = req.services.TaskService;
      const result = await taskService.update(taskId, {
        gitOperation: { method },
        githubToken: req.githubToken
      });
      
      // Trigger status update after successful update
      if (result.success && req.services.gitStatusMonitor) {
        req.services.gitStatusMonitor.checkTask(taskId).catch(err => 
          console.error(`Failed to update git status for task ${taskId}:`, err)
        );
      }
      
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ 
        error: error.message,
        ...(error.hasUncommitted && { hasUncommitted: true, changes: error.changes }),
        ...(error.hasConflicts && { hasConflicts: true, conflicts: error.conflicts })
      });
    }
  }

  /**
   * Check for merge conflicts
   */
  async checkMergeConflicts(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const taskService = req.services.TaskService;
      const conflicts = await taskService.merge(taskId, {
        checkConflicts: true,
        githubToken: req.githubToken
      });
      res.json(conflicts);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message });
    }
  }

  /**
   * Merge task into base branch
   */
  async mergeToBase(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const taskService = req.services.TaskService;
      const result = await taskService.merge(taskId, {
        githubToken: req.githubToken
      });
      
      // Trigger status update after successful merge
      if (req.services.gitStatusMonitor) {
        req.services.gitStatusMonitor.checkTask(taskId).catch(err => 
          console.error(`Failed to update git status for task ${taskId}:`, err)
        );
      }
      
      res.json(result);
    } catch (error) {
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ 
        error: error.message,
        ...(error.details && { details: error.details }),
        ...(error.hasConflicts && { hasConflicts: true, conflicts: error.conflicts })
      });
    }
  }


}