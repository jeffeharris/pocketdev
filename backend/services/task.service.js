import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { TASK_EVENTS, SPLIT_EVENTS } from './events.js';
import { WorktreeService } from './worktree.service.js';
import { GitService } from './git.service.js';
import { getSessionInfo } from '../../shared/shelltender-client.js';

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
  constructor(models, githubTokenService, eventEmitterService = null, gitService = null, projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), '../projects')) {
    this.models = models;
    this.githubTokenService = githubTokenService;
    this.eventEmitterService = eventEmitterService;
    this.gitService = gitService || new GitService();
    this.projectsDir = projectsDir;
    this.worktreeService = new WorktreeService();
  }

  /**
   * Create a new task with worktree and optional terminal session
   * @param {string} projectId - Project ID
   * @param {Object} options - All task creation options
   * @returns {Promise<Object>} Created task with session info
   */
  async create(projectId, options = {}) {
    const { name, branch, useExistingBranch, githubToken, createSession, hostname } = options;
    return this._createTask(projectId, { name, branch, useExistingBranch }, githubToken, { createSession, hostname });
  }

  /**
   * Internal create task implementation
   * @private
   */
  async _createTask(projectId, taskData, githubToken, options = {}) {
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
      await GitService.configureCredentials(worktreePath, githubToken);
      
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
  async delete(taskId, options = {}) {
    const { force = false, softDelete = true, checkSafety = false, githubToken } = options;
    
    if (checkSafety) {
      return this._checkTaskDeletionSafety(taskId, githubToken);
    }
    
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
  /**
   * Update task metadata only
   * @param {string} taskId - Task ID
   * @param {Object} updates - Metadata updates (name, description)
   * @returns {Promise<Object>} Updated task
   */
  async update(taskId, updates = {}) {
    // Only handle metadata updates
    return this._updateTaskMetadata(taskId, updates);
  }
  
  /**
   * Sync task with remote repository
   * @param {string} taskId - Task ID
   * @param {string} operation - Operation type: 'pull' or 'push'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Sync result
   */
  async sync(taskId, operation = 'pull', options = {}) {
    const { githubToken } = options;
    
    if (operation === 'pull') {
      return this._updateTask(taskId, githubToken, { method: 'merge' });
    } else if (operation === 'push') {
      return this._updateTask(taskId, githubToken, { method: 'push' });
    }
    
    throw new Error(`Unknown sync operation: ${operation}`);
  }
  
  /**
   * Set task split layout configuration
   * @param {string} taskId - Task ID
   * @param {string} projectId - Project ID for validation
   * @param {Object} layout - Layout configuration
   * @returns {Promise<Object>} Updated layout
   */
  async setLayout(taskId, projectId, layout) {
    return this._updateSplitLayout(taskId, projectId, layout);
  }

  async _updateTaskMetadata(taskId, updates) {
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
  async _checkTaskDeletionSafety(taskId, githubToken) {
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
    // Create GitService with current token
    const gitService = new GitService(githubToken);
    
    // Check for uncommitted changes
    const status = await gitService.info(task.worktree_path, 'status');
    const hasUncommittedChanges = status.hasChanges;
    
    // Check for unpushed commits
    let hasUnpushedCommits = false;
    let diffSummary = '';
    
    try {
      // Check if branch is ahead of origin
      hasUnpushedCommits = status.ahead > 0;
    } catch (e) {
      hasUnpushedCommits = true; // Assume unsafe if can't check
    }
    
    // Get diff summary if changes exist
    if (hasUncommittedChanges) {
      const diff = await gitService.getDiff(task.worktree_path, 'HEAD', 'HEAD', { stat: true });
      diffSummary = diff.diff || '';
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
   * Get complete task details including git status and terminals
   * @param {string} taskId - Task ID  
   * @param {string} projectId - Project ID for validation
   * @param {string} githubToken - GitHub token for authentication
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Complete task details
   */
  /**
   * Get task with various levels of detail
   * @param {string} taskId - Task ID  
   * @param {Object} options - Options for what to include
   * @returns {Promise<Object>} Task with requested details
   */
  async get(taskId, options = {}) {
    const { 
      projectId,
      includeGitStatus = false,
      includeSessionState = false,
      includeMergeStatus = false,
      includeTerminals = false,
      includeSplitLayout = false,
      terminalLimit = 6,
      githubToken = null
    } = options;
    
    // Handle split layout as special case
    if (includeSplitLayout && projectId) {
      return this._getSplitLayout(taskId, projectId);
    }
    
    return this._getTaskDetails(taskId, projectId, githubToken, { 
      includeTerminals, 
      terminalLimit,
      includeGitStatus,
      includeSessionState,
      includeMergeStatus
    });
  }

  async _getTaskDetails(taskId, projectId, githubToken, options = {}) {
    const { includeTerminals = true, terminalLimit = 6 } = options;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Verify task belongs to project
    if (task.project_id !== projectId) {
      const error = new Error('Task not found in this project');
      error.statusCode = 404;
      throw error;
    }
    
    // Get project for base branch info
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Get terminal sessions if requested
    let terminals = [];
    if (includeTerminals) {
      const allTerminals = await this.models.sessions.findAllActiveByTaskId(taskId);
      terminals = allTerminals.slice(0, terminalLimit);
      
      // Log warning if too many terminals
      if (allTerminals.length > terminalLimit) {
        console.warn(`Task ${taskId} has ${allTerminals.length} terminals - showing only first ${terminalLimit}`);
      }
    }
    
    // Get git status for this task's worktree
    let gitInfo = null;
    let mergeInfo = null;
    
    if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
      const gitService = new GitService(githubToken);
      
      const status = await gitService.info(task.worktree_path, 'status');
      const diff = await gitService.getDiff(task.worktree_path, 'HEAD', 'HEAD', { stat: true });
      
      gitInfo = {
        status: status.files ? status.files.map(f => `${f.status} ${f.file}`).join('\n') : '',
        diff: diff.output,
        hasChanges: status.output.trim().length > 0
      };
      
      // Update task if uncommitted changes status changed
      if (gitInfo.hasChanges !== task.has_uncommitted_changes) {
        await this.models.tasks.update(task.id, {
          has_uncommitted_changes: gitInfo.hasChanges
        });
      }
      
      // Check if task can be merged
      if (project && task.status !== 'merged') {
        const gitService = this.gitService || new GitService(githubToken);
        const conflicts = await gitService.checkConflicts(
          task.worktree_path,
          project.base_branch
        );
        
        mergeInfo = {
          hasConflicts: conflicts.hasConflicts,
          conflicts: conflicts.conflicts || [],
          canMerge: !conflicts.hasConflicts && gitInfo.hasChanges
        };
      }
    }
    
    // Get enhanced terminals with status
    const terminalsWithStatus = await Promise.all(
      terminals.map(async (terminal) => {
        let workerStatus = null;
        try {
          const sessionInfo = await getSessionInfo(terminal.shellhub_session_id);
          if (sessionInfo && sessionInfo.worker) {
            workerStatus = {
              status: sessionInfo.worker.status || 'unknown',
              lastActivity: sessionInfo.worker.lastActivity || null
            };
          }
        } catch (error) {
          console.error(`Failed to get session info for ${terminal.shellhub_session_id}:`, error.message);
        }
        
        return {
          ...terminal,
          workerStatus
        };
      })
    );
    
    return {
      ...task,
      git: gitInfo,
      mergeInfo: mergeInfo,
      terminals: terminalsWithStatus
    };
  }

  /**
   * List all tasks for a project with full status
   * @param {string} projectId - Project ID
   * @param {string} githubToken - GitHub token for authentication
   * @param {Object} monitors - Monitor services for live state
   * @returns {Promise<Array>} Array of tasks with full status
   */
  /**
   * List tasks with configurable detail levels
   * @param {string} projectId - Project ID
   * @param {Object} options - List options
   * @returns {Promise<Array>} Array of tasks
   */
  async list(projectId, options = {}) {
    const { 
      minimal = false,
      includeGitStatus = true,
      githubToken = null,
      monitors = {}
    } = options;
    
    if (minimal) {
      // Simple list without enrichment
      return this.models.tasks.findByProjectId(projectId);
    }
    
    return this._listProjectTasks(projectId, githubToken, monitors);
  }

  async _listProjectTasks(projectId, githubToken, monitors = {}) {
    const tasks = await this.models.tasks.findByProjectId(projectId);
    
    // Get the project to know the base branch
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const baseBranch = `origin/${project.base_branch || 'main'}`;
    
    // Enrich tasks with git status and session state
    const tasksWithFullStatus = await Promise.all(tasks.map(async (task) => {
      let gitStatus = null;
      
      if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
        try {
          gitStatus = await this._getTaskGitStatus(task.id, githubToken);
        } catch (error) {
          console.error(`Failed to get git status for task ${task.id}:`, error.message);
        }
      }
      
      // Get session state from AI monitor (live) or database (persisted)
      let sessionState = { status: 'not-started', lastStateChange: null };
      
      // First try to get live state from AI monitor
      let liveStatus = null;
      if (monitors.aiMonitor && monitors.aiMonitor.getSessionStatus) {
        const sessionId = `task-${task.id}`;
        liveStatus = monitors.aiMonitor.getSessionStatus(sessionId);
        
        if (liveStatus) {
          // Use live state from AI monitor - this is the most accurate
          sessionState = {
            status: liveStatus.currentState,
            lastStateChange: new Date().toISOString()
          };
        }
      }
      
      // If no live state from AI monitor, get from database
      if (!liveStatus) {
        const sessions = await this.models.sessions.findByTaskId(task.id);
        const activeSession = sessions.find(s => s.is_active);
        if (activeSession) {
          sessionState = {
            state: activeSession.ai_state,
            lastActivity: activeSession.last_activity
          };
        }
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
    }));
    
    return tasksWithFullStatus;
  }

  /**
   * Get comprehensive task state including git and session info
   * @param {string} taskId - Task ID
   * @param {Object} gitService - GitService instance for git operations
   * @param {Object} monitors - Monitor services for live state
   * @returns {Promise<Object>} Complete task state
   */
  async _getTaskState(taskId, githubToken, monitors = {}) {
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
        gitStatus = await this._getTaskGitStatus(taskId, githubToken);
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
   * Update task with changes from base branch (merge or rebase)
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @param {Object} options - Update options
   * @returns {Promise<Object>} Update result
   */
  async _updateTask(taskId, githubToken, options = {}) {
    const { method = 'merge' } = options;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Check for uncommitted changes
    const gitService = new GitService(githubToken);
    const statusResult = await gitService.getStatus(task.worktree_path);
    
    if (statusResult.hasChanges) {
      const error = new Error('Cannot update: You have uncommitted changes');
      error.statusCode = 400;
      error.hasUncommitted = true;
      error.changes = statusResult.files ? statusResult.files.map(f => `${f.status} ${f.file}`).join('\n') : '';
      throw error;
    }
    
    // Perform update (merge will check for conflicts internally)
    const baseBranch = `origin/${project.base_branch}`;
    
    let result;
    if (method === 'rebase') {
      // Rebase is no longer a separate method - use execute for advanced operations
      result = await gitService.execute(`git rebase ${baseBranch}`, task.worktree_path);
    } else {
      // Merge with conflict checking enabled
      result = await gitService.merge(task.worktree_path, baseBranch, { checkConflicts: true });
    }
    
    // Handle merge conflicts
    if (!result.success && result.hasConflicts) {
      const error = new Error('Merge conflicts detected');
      error.statusCode = 400;
      error.hasConflicts = true;
      error.conflicts = result.conflicts;
      throw error;
    }
    
    await this.models.projects.updateLastAccessed(project.id);
    
    // After rebase, check if branches became identical
    if (result.success && method === 'rebase' && task.status === 'merged') {
      const diffResult = await gitService.getDiff(task.worktree_path, project.base_branch, 'HEAD', { nameOnly: true });
      if (!diffResult.files || diffResult.files.length === 0) {
        // Branches are now identical, clear the "needs re-merge" flag
        await this.models.tasks.update(task.id, {
          has_commits_since_merge: false
        });
      }
    }
    
    // Emit event if successful
    if (result.success && this.eventEmitterService) {
      this.eventEmitterService.emit(TASK_EVENTS.UPDATED, { taskId, method });
    }
    
    return {
      success: result.success,
      output: result.output,
      method
    };
  }

  /**
   * Merge task branch into base branch
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @returns {Promise<Object>} Merge result
   */
  /**
   * Merge task to base branch
   * @param {string} taskId - Task ID
   * @param {string} operation - 'toBase', 'checkConflicts', or 'status'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Merge result
   */
  async merge(taskId, operation = 'toBase', options = {}) {
    const { githubToken } = options;
    
    switch (operation) {
      case 'toBase':
        return this._mergeToBase(taskId, githubToken);
      case 'checkConflicts':
        return this._checkMergeConflicts(taskId, githubToken);
      case 'status':
        return this._checkMergeStatus(taskId, githubToken);
      default:
        throw new Error(`Unknown merge operation: ${operation}`);
    }
  }

  async _mergeToBase(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const gitService = new GitService(githubToken);
    
    // First ensure the task branch is pushed to origin
    const pushResult = await gitService.push(task.worktree_path, task.branch, { setUpstream: true });
    if (!pushResult.success && !pushResult.error?.includes('Everything up-to-date')) {
      const error = new Error('Failed to push branch');
      error.statusCode = 500;
      error.details = pushResult.error;
      throw error;
    }
    
    // Now ensure we're on the base branch and up to date
    await gitService.branch(project.local_path, 'checkout', project.base_branch);
    await gitService.sync(project.local_path, { branch: project.base_branch });
    
    // Merge the task branch (will check for conflicts internally)
    const mergeResult = await gitService.merge(
      project.local_path, 
      `origin/${task.branch}`,
      { checkConflicts: true }
    );
    
    if (!mergeResult.success) {
      if (mergeResult.hasConflicts) {
        const error = new Error('Cannot merge: conflicts detected');
        error.statusCode = 400;
        error.hasConflicts = true;
        error.conflicts = mergeResult.conflicts;
        throw error;
      }
      const error = new Error('Merge failed');
      error.statusCode = 500;
      error.details = mergeResult.error;
      throw error;
    }
    
    // Get the merge commit SHA
    const currentInfo = await gitService.info(project.local_path, 'current');
    const mergeCommitSha = currentInfo.commit;
    
    // Push the merged changes to origin
    const pushBaseResult = await gitService.push(project.local_path, project.base_branch);
    if (!pushBaseResult.success) {
      // If push fails, we need to reset the merge
      // Reset is no longer a separate method - use execute for advanced operations
      await gitService.execute('git reset --hard HEAD~1', project.local_path);
      const error = new Error('Failed to push merged changes to origin');
      error.statusCode = 500;
      error.details = pushBaseResult.error;
      throw error;
    }
    
    // Update task with merge information
    await this.models.tasks.update(task.id, { 
      status: 'merged',
      completed_at: new Date().toISOString(),
      merged_at: new Date().toISOString(),
      merge_commit_sha: mergeCommitSha,
      has_commits_since_merge: false
    });
    
    // Update project last accessed
    await this.models.projects.updateLastAccessed(project.id);
    
    // Emit event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(TASK_EVENTS.TASK_MERGED, {
        projectId: project.id,
        taskId: task.id,
        branch: task.branch,
        baseBranch: project.base_branch,
        mergeCommit: mergeCommitSha
      });
    }
    
    return {
      message: `Successfully merged ${task.branch} into ${project.base_branch}`,
      mergedCommit: mergeCommitSha,
      mergedAt: new Date().toISOString()
    };
  }

  /**
   * Create or reconnect to terminal session for a task
   * @param {string} taskId - Task ID
   * @param {Object} sessionData - Session configuration
   * @param {Object} monitors - Monitor services
   * @returns {Promise<Object>} Session information
   */
  /**
   * Manage terminal sessions
   * @param {string} taskId - Task ID
   * @param {string} action - Action to perform: 'start', 'stop', 'cleanup'
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Action result
   */
  async terminal(taskId, action = 'start', options = {}) {
    const { sessionData = {}, monitors = {} } = options;
    
    switch (action) {
      case 'start':
        return this._manageTaskTerminalSession(taskId, sessionData, monitors);
      case 'stop':
        // Stop specific session if ID provided
        return this._stopTaskSession(taskId, options.sessionId);
      case 'cleanup':
        return this._cleanupTaskSessions(taskId);
      default:
        throw new Error(`Unknown terminal action: ${action}`);
    }
  }

  async _manageTaskTerminalSession(taskId, sessionData = {}, monitors = {}) {
    // Delegate to TerminalService which handles session complexity
    const terminalService = await this._getTerminalService();
    return await terminalService.createSession(taskId, sessionData, monitors);
  }
  
  async _stopTaskSession(taskId, sessionId) {
    const terminalService = await this._getTerminalService();
    return await terminalService.stopSession(sessionId || `task-${taskId}`);
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
   * Check for merge conflicts with base branch
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @returns {Promise<Object>} Conflict check result
   */
  async _checkMergeConflicts(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    
    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Check for conflicts using git service
    const gitService = new GitService(githubToken);
    
    // Use merge with checkConflicts to detect conflicts without actually merging
    const mergeResult = await gitService.merge(
      task.worktree_path,
      `origin/${project.base_branch}`,
      { checkConflicts: true, noCommit: true }
    );
    
    return {
      hasConflicts: !mergeResult.success && mergeResult.hasConflicts,
      conflicts: mergeResult.conflicts || []
    };
  }

  /**
   * Get lightweight task status
   * @param {string} taskId - Task ID
   * @param {string} githubToken - GitHub token for authentication
   * @param {Object} monitors - Monitor services
   * @returns {Promise<Object>} Task status
   */
  async _getTaskStatus(taskId, githubToken, monitors = {}) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Aggregate session data
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
    
    // Get git status
    let gitStatus = {
      ahead: 0,
      behind: 0,
      hasConflicts: false
    };
    
    if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
      const project = await this.models.projects.findById(task.project_id);
      if (project) {
        try {
          gitStatus = await this._getTaskGitStatus(taskId, githubToken);
        } catch (error) {
          console.error(`Error fetching git status for task ${taskId}:`, error);
        }
      }
    }
    
    // Calculate task state
    const taskState = task.status === 'merged' || task.merged_at ? 'merged' : 
                     task.is_archived ? 'archived' : 'active';
    
    return {
      id: task.id,
      taskState,
      sessionState: task.sessionState,
      gitStatus
    };
  }

  /**
   * Generate task ID
   */
  generateTaskId() {
    return require('crypto').randomBytes(4).toString('hex');
  }

  /**
   * Internal get split layout
   * @private
   */
  async _getSplitLayout(taskId, projectId) {
    const task = await this.models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Return split layout or default configuration
    const defaultLayout = {
      mode: 'tab',
      orientation: 'horizontal',
      primaryTerminalId: null,
      secondaryTerminalId: null,
      splitRatio: 0.5
    };
    
    return task.split_layout || defaultLayout;
  }

  /**
   * Internal update split layout
   * @private
   */
  async _updateSplitLayout(taskId, projectId, splitLayout) {
    const task = await this.models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Validate split layout structure
    const validModes = ['tab', 'split', 'split-4'];
    const validOrientations = ['horizontal', 'vertical'];
    
    if (splitLayout.mode && !validModes.includes(splitLayout.mode)) {
      const error = new Error('Invalid mode. Must be "tab", "split", or "split-4"');
      error.statusCode = 400;
      throw error;
    }
    
    if (splitLayout.orientation && !validOrientations.includes(splitLayout.orientation)) {
      const error = new Error('Invalid orientation. Must be "horizontal" or "vertical"');
      error.statusCode = 400;
      throw error;
    }
    
    if (splitLayout.splitRatio !== undefined) {
      const ratio = parseFloat(splitLayout.splitRatio);
      if (isNaN(ratio) || ratio < 0.1 || ratio > 0.9) {
        const error = new Error('Invalid splitRatio. Must be between 0.1 and 0.9');
        error.statusCode = 400;
        throw error;
      }
      splitLayout.splitRatio = ratio;
    }
    
    // Update the task with new split layout
    await this.models.tasks.update(taskId, {
      split_layout: splitLayout
    });
    
    // Emit split layout changed event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(SPLIT_EVENTS.LAYOUT_CHANGED, { taskId, layout: splitLayout });
    }
    
    return splitLayout;
  }

  /**
   * Check merge status for a task
   * @private
   */
  async _checkMergeStatus(taskId, githubToken = null) {
    const task = await this.models.tasks.findById(taskId);
    if (!task || !task.merged_at || !task.merge_commit_sha) {
      return null;
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      return null;
    }

    const gitService = githubToken ? new GitService(githubToken) : this.gitService;

    try {
      // Get current HEAD
      const currentInfo = await gitService.info(task.worktree_path, 'current');
      const currentHead = currentInfo.commit;
      
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
  async _cleanupTaskSessions(taskId) {
    // Delegate to TerminalService which handles session complexity
    const terminalService = await this._getTerminalService();
    return await terminalService.cleanupTaskSessions(taskId);
  }

  /**
   * Get task git status
   * @private
   */
  async _getTaskGitStatus(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task || !task.worktree_path || !fsSync.existsSync(task.worktree_path)) {
      return null;
    }
    
    const gitService = this.gitService || new GitService(githubToken);
    const status = await gitService.info(task.worktree_path, 'status');
    
    // Get branch info
    const currentInfo = await gitService.info(task.worktree_path, 'current');
    const currentBranch = currentInfo.branch;
    const aheadBehind = { ahead: currentInfo.ahead, behind: currentInfo.behind };
    
    return {
      branch: currentBranch,
      ...status,
      ahead: aheadBehind.ahead,
      behind: aheadBehind.behind
    };
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