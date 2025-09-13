import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { WorktreeService } from '../services/worktree.service.js';
import { SPLIT_EVENTS, TASK_EVENTS } from '../services/events.js';
import { GitStatusService } from '../services/git-status.service.js';
import { GitRepository } from '../services/git-repository.service.js';
import { GitWorkingTree } from '../services/git-workingtree.service.js';
import { GitAnalyzer } from '../services/git-analyzer.service.js';

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
   * Get task with aggregated session data
   * Performs separate queries to maintain model separation
   */
  async getTaskWithSessionState(taskId) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) return null;
    
    const sessions = await this.models.sessions.findByTaskId(taskId);
    task.sessions = sessions;
    task.active_session_count = sessions.filter(s => s.is_active).length;
    
    // Add session state from active sessions
    const activeSession = sessions.find(s => s.is_active);
    if (activeSession) {
      task.sessionState = {
        state: activeSession.ai_state,
        lastActivity: activeSession.last_activity
      };
    }
    
    return task;
  }

  /**
   * Helper: Generate task ID
   */
  generateTaskId() {
    return require('crypto').randomBytes(4).toString('hex');
  }


  /**
   * Trigger git status update after operations that change git state
   */
  async triggerStatusUpdate(taskId, req) {
    if (req.services.gitStatusMonitor) {
      req.services.gitStatusMonitor.checkTask(taskId).catch(err => 
        console.error(`Failed to update git status for task ${taskId}:`, err)
      );
    }
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
      const tasks = await taskService.listProjectTasks(projectId, req.githubToken);
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
      const status = await taskService.getTaskStatus(taskId, req.githubToken, {
        aiMonitor: req.services.aiMonitor
      });
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
      const updatedTask = await taskService.updateTaskMetadata(taskId, updates);
      
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
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Verify task belongs to project
      if (task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found in this project' });
      }
      
      // Return split layout or default configuration
      const defaultLayout = {
        mode: 'tab',
        orientation: 'horizontal',
        primaryTerminalId: null,
        secondaryTerminalId: null,
        splitRatio: 0.5
      };
      
      res.json(task.split_layout || defaultLayout);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Update split layout configuration for a task
   */
  async updateSplitLayout(req, res) {
    const { projectId, taskId } = req.params;
    const splitLayout = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Verify task belongs to project
      if (task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found in this project' });
      }
      
      // Validate split layout structure
      const validModes = ['tab', 'split', 'split-4'];
      const validOrientations = ['horizontal', 'vertical'];
      
      if (splitLayout.mode && !validModes.includes(splitLayout.mode)) {
        return res.status(400).json({ error: 'Invalid mode. Must be "tab", "split", or "split-4"' });
      }
      
      if (splitLayout.orientation && !validOrientations.includes(splitLayout.orientation)) {
        return res.status(400).json({ error: 'Invalid orientation. Must be "horizontal" or "vertical"' });
      }
      
      if (splitLayout.splitRatio !== undefined) {
        const ratio = parseFloat(splitLayout.splitRatio);
        if (isNaN(ratio) || ratio < 0.1 || ratio > 0.9) {
          return res.status(400).json({ error: 'Invalid splitRatio. Must be between 0.1 and 0.9' });
        }
        splitLayout.splitRatio = ratio;
      }
      
      // Update the task with new split layout
      const updatedTask = await this.models.tasks.update(taskId, {
        split_layout: splitLayout
      });
      
      // Emit split layout changed event
      if (req.services?.EventEmitterService) {
        req.services.EventEmitterService.emit(SPLIT_EVENTS.LAYOUT_CHANGED, { taskId, layout: splitLayout });
      }
      
      res.json(splitLayout);
    } catch (error) {
      res.status(500).json({ error: error.message });
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
      const result = await taskService.updateTask(taskId, req.githubToken, { method });
      
      // Trigger status update after successful update
      if (result.success) {
        await this.triggerStatusUpdate(taskId, req);
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
      const conflicts = await taskService.checkMergeConflicts(taskId, req.githubToken);
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
      const result = await taskService.mergeToBase(taskId, req.githubToken);
      
      // Trigger status update after successful merge
      await this.triggerStatusUpdate(taskId, req);
      
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

  /**
   * Private helper to check merge status
   */
  async _checkMergeStatus(task, project, repository) {
    try {
      // Get current HEAD
      const headResult = await repository.execute('git rev-parse HEAD', task.worktree_path);
      const currentHead = headResult.output.trim();
      
      // Check if we have commits since merge
      let hasCommitsSinceMerge = false;
      if (currentHead !== task.merge_commit_sha) {
        // Count commits since merge
        const countResult = await repository.execute(
          `git rev-list ${task.merge_commit_sha}..HEAD --count 2>/dev/null || echo 0`,
          task.worktree_path
        );
        const commitsSinceMerge = parseInt(countResult.output.trim()) || 0;
        
        // Check if there are actual differences with the base branch
        if (project.base_branch) {
          const analyzer = new GitAnalyzer(null); // No token needed for local diff
          const diffResult = await analyzer.getDiff(task.worktree_path,
            `${project.base_branch}..HEAD --name-only`);
          const hasDifferences = diffResult.output.trim().length > 0;
          hasCommitsSinceMerge = hasDifferences;
        } else {
          hasCommitsSinceMerge = commitsSinceMerge > 0;
        }
      }
      
      // Update database if status changed
      if (hasCommitsSinceMerge !== task.has_commits_since_merge) {
        await this.models.tasks.update(task.id, {
          has_commits_since_merge: hasCommitsSinceMerge
        });
        task.has_commits_since_merge = hasCommitsSinceMerge;
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
   * Clean up all Shelltender sessions for a task
   */
  async cleanupTaskSessions(taskId) {
    // Delegate to TerminalService which handles session complexity
    const terminalService = new (await import('../services/terminal.service.js')).TerminalService(this.models);
    return await terminalService.cleanupTaskSessions(taskId);
  }
}