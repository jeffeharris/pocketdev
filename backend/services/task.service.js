import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { TASK_EVENTS } from './events.js';
import { WorktreeService } from './worktree.service.js';
import { GitRepository } from './git-repository.service.js';
import { GitWorkingTree } from './git-workingtree.service.js';
import { GitAnalyzer } from './git-analyzer.service.js';
import { GitStatusService } from './git-status.service.js';

/**
 * TaskService - Handles all task-related business operations
 * 
 * This service provides a clean interface for task management operations,
 * hiding the complexity of worktree management, terminal coordination, 
 * git operations, and state tracking.
 * 
 * Following deep module principles: simple interface (8-10 methods), 
 * complex implementation handling multiple concerns.
 */
export class TaskService {
  constructor(models, githubTokenService, eventEmitterService = null, projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), '../projects')) {
    this.models = models;
    this.githubTokenService = githubTokenService;
    this.eventEmitterService = eventEmitterService;
    this.projectsDir = projectsDir;
    this.worktreeService = new WorktreeService();
  }

  /**
   * Create a new task with worktree and optional terminal session
   * @param {string} projectId - Project ID
   * @param {Object} taskData - Task creation data
   * @param {Object} gitService - GitService instance for git operations
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created task with session info
   */
  async createTask(projectId, taskData, githubToken, options = {}) {
    const { name, branch, useExistingBranch } = taskData;
    const { createSession = true, hostname } = options;
    
    if (!name || !branch) {
      throw new Error('Task name and branch are required');
    }
    
    // Get project
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Generate task ID and worktree path
    const { v4: uuidv4 } = await import('uuid');
    const taskId = uuidv4().slice(0, 8);
    const worktreePath = path.join(this.projectsDir, `${project.id}-task-${taskId}`);
    
    try {
      // Create worktree
      await this.worktreeService.create(
        project.local_path, 
        branch, 
        worktreePath, 
        project.base_branch, 
        useExistingBranch
      );
      
      // Configure git credentials
      await GitRepository.configureCredentials(worktreePath, githubToken);
      
      // Create task in database
      const task = await this.models.tasks.create({
        id: taskId,
        project_id: project.id,
        name,
        branch,
        worktree_path: worktreePath
      });
      
      // Update project last accessed
      await this.models.projects.updateLastAccessed(project.id);
      
      // Create terminal session if requested
      let sessionInfo = null;
      if (createSession) {
        sessionInfo = await this._createTaskSession(taskId, worktreePath);
      }
      
      const result = {
        task: {
          ...task,
          claudeUrl: hostname ? `http://${hostname}:7681/?arg=${encodeURIComponent(worktreePath)}` : null
        },
        session: sessionInfo
      };
      
      // Emit task created event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit(TASK_EVENTS.CREATED, { task: result.task });
      }
      
      return result;
    } catch (error) {
      // Cleanup on failure
      try {
        if (fsSync.existsSync(worktreePath)) {
          await this.worktreeService.remove(project.local_path, worktreePath);
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup after task creation failure:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Delete or archive a task with complete cleanup
   * @param {string} taskId - Task ID
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteTask(taskId, options = {}) {
    const { force = false, softDelete = true } = options;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Clean up all terminal sessions for this task
    await this._cleanupTaskSessions(taskId);
    
    if (softDelete && !force) {
      // Soft delete - archive the task
      await this.models.tasks.archive(task.id);
      
      // Move worktree to archived location
      const archivePath = path.join(
        this.projectsDir, 
        '.archived', 
        `${project.id}-task-${task.id}-${Date.now()}`
      );
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      await this.worktreeService.move(task.worktree_path, archivePath);
      
      // Emit task state changed event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit(TASK_EVENTS.STATE_CHANGED, { taskId: task.id, newState: 'archived', oldState: 'active' });
      }
      
      return {
        success: true,
        softDeleted: true,
        message: 'Task archived. Can be restored within 30 days.',
        archivePath
      };
    } else {
      // Hard delete
      await this.worktreeService.remove(project.local_path, task.worktree_path);
      await this.models.tasks.delete(task.id);
      
      // Emit task deleted event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit(TASK_EVENTS.DELETED, { taskId: task.id });
      }
      
      return {
        success: true,
        hardDeleted: true,
        message: 'Task permanently deleted'
      };
    }
  }

  /**
   * Update task metadata and state
   * @param {string} taskId - Task ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated task
   */
  async updateTaskMetadata(taskId, updates) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    // Validate allowed updates
    const allowedUpdates = ['name', 'description', 'split_layout', 'status', 'metadata'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }
    
    const updatedTask = await this.models.tasks.update(taskId, filteredUpdates);
    
    // Emit task updated event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(TASK_EVENTS.UPDATED, { taskId, changes: filteredUpdates });
    }
    
    return updatedTask;
  }

  /**
   * Check if a task can be safely deleted
   * @param {string} taskId - Task ID
   * @param {Object} gitService - GitService instance for git operations
   * @returns {Promise<Object>} Safety check results
   */
  async checkTaskDeletionSafety(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    if (!fsSync.existsSync(task.worktree_path)) {
      return {
        canDelete: true,
        hasUncommittedChanges: false,
        hasUnpushedCommits: false,
        warnings: []
      };
    }
    
    // Create the modules we need
    const workingTree = new GitWorkingTree(githubToken);
    const analyzer = new GitAnalyzer(githubToken);
    
    // Check for uncommitted changes
    const status = await workingTree.getStatus(task.worktree_path);
    const hasUncommittedChanges = status.output.trim().length > 0;
    
    // Check for unpushed commits
    let hasUnpushedCommits = false;
    let diffSummary = '';
    
    try {
      const unpushed = await analyzer.getUnpushedCommits(task.worktree_path, task.branch);
      hasUnpushedCommits = unpushed.count > 0;
    } catch (e) {
      hasUnpushedCommits = true; // Assume unsafe if can't check
    }
    
    // Get diff summary if changes exist
    if (hasUncommittedChanges) {
      const diff = await analyzer.getDiff(task.worktree_path, { stat: true });
      diffSummary = diff.output;
    }
    
    const warnings = [];
    if (hasUncommittedChanges) {
      warnings.push('Task has uncommitted changes that will be lost');
    }
    if (hasUnpushedCommits) {
      warnings.push('Task has commits that have not been pushed to remote');
    }
    
    return {
      canDelete: !hasUncommittedChanges && !hasUnpushedCommits,
      hasUncommittedChanges,
      hasUnpushedCommits,
      diffSummary,
      warnings
    };
  }

  /**
   * Get comprehensive task state including git and session info
   * @param {string} taskId - Task ID
   * @param {Object} gitService - GitService instance for git operations
   * @param {Object} monitors - Monitor services for live state
   * @returns {Promise<Object>} Complete task state
   */
  async getTaskState(taskId, githubToken, monitors = {}) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    // Aggregate session data
    const sessions = await this.models.sessions.findByTaskId(taskId);
    task.sessions = sessions;
    task.active_session_count = sessions.filter(s => s.is_active).length;
    
    const project = await this.models.projects.findById(task.project_id);
    
    // Get git status if worktree exists
    let gitStatus = null;
    if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
      try {
        const gitStatusService = new GitStatusService(this.models, this.githubTokenService);
        gitStatus = await gitStatusService.getTaskGitStatus(taskId, githubToken);
      } catch (error) {
        console.error(`Failed to get git status for task ${taskId}:`, error.message);
      }
    }
    
    // Get session state (live from monitor if available, otherwise from DB)
    let sessionState = { status: 'not-started', lastStateChange: null };
    
    if (monitors.aiMonitor && monitors.aiMonitor.getSessionStatus) {
      const sessionId = `task-${taskId}`;
      const liveStatus = monitors.aiMonitor.getSessionStatus(sessionId);
      
      if (liveStatus) {
        sessionState = {
          status: liveStatus.currentState,
          lastStateChange: new Date().toISOString()
        };
      } else if (task.sessionState) {
        sessionState = task.sessionState;
      }
    } else if (task.sessionState) {
      sessionState = task.sessionState;
    }
    
    // Calculate task state
    let taskState = 'active';
    if (task.status === 'merged' || task.merged_at) {
      taskState = 'merged';
    } else if (task.is_archived) {
      taskState = 'archived';
    }
    
    return {
      ...task,
      gitStatus,
      taskState,
      sessionState
    };
  }

  /**
   * Create or reconnect to terminal session for a task
   * @param {string} taskId - Task ID
   * @param {Object} sessionData - Session configuration
   * @param {Object} monitors - Monitor services
   * @returns {Promise<Object>} Session information
   */
  async manageTaskTerminalSession(taskId, sessionData = {}, monitors = {}) {
    // Delegate to TerminalService which handles session complexity
    const terminalService = await this._getTerminalService();
    return await terminalService.createSession(taskId, sessionData, monitors);
  }

  // Private helper methods

  /**
   * Create a task session (simplified for basic task creation)
   * @private
   */
  async _createTaskSession(taskId, worktreePath) {
    try {
      // Get TerminalService to create a proper terminal session
      const terminalService = await this._getTerminalService();
      
      // Create the first terminal session with default settings
      const sessionInfo = await terminalService.createSession(
        taskId,
        {
          tabName: 'Tab 1',
          aiAgent: 'claude',
          workingDirectory: null // Use task's worktree root
        },
        {} // No monitors needed here, they'll connect later
      );
      
      console.log(`Created initial terminal session for task ${taskId}:`, sessionInfo);
      
      return {
        sessionId: sessionInfo.sessionId,
        dbSessionId: sessionInfo.dbSessionId,
        shelltenderSessionId: sessionInfo.shelltenderSessionId,
        created: true,
        tabName: sessionInfo.tabName,
        aiAgent: sessionInfo.aiAgent
      };
    } catch (error) {
      console.warn('Failed to create initial terminal session:', error.message);
      return {
        sessionId: `task-${taskId}`,
        created: false,
        error: error.message
      };
    }
  }

  /**
   * Clean up all terminal sessions for a task
   * @private
   */
  async _cleanupTaskSessions(taskId) {
    // Delegate to TerminalService which handles session complexity
    const terminalService = await this._getTerminalService();
    return await terminalService.cleanupTaskSessions(taskId);
  }

  /**
   * Get TerminalService instance (lazy loading to avoid circular dependencies)
   * @private
   */
  async _getTerminalService() {
    if (!this._terminalService) {
      // Import TerminalService only when needed
      const { TerminalService } = await import('./terminal.service.js');
      this._terminalService = new TerminalService(this.models, this.eventEmitterService);
    }
    return this._terminalService;
  }
}