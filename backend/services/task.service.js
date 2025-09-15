import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { TASK_EVENTS, SPLIT_EVENTS } from './events.js';
import { WorktreeService } from './worktree.service.js';
import { GitService } from './git.service.js';
import { TaskRepository } from './internal/task-repository.js';
import { TaskGitOperations } from './internal/task-git-operations.js';
import { TaskTerminalManager } from './internal/task-terminal-manager.js';
import { Task as TaskDomain, ValidationError } from '../../shared/domain/index.js';
import { TaskRepository as DomainTaskRepository } from '../repositories/task.repository.js';
import { Logger } from '../utils/logger.js';

/**
 * TaskService - Orchestrates task operations using internal services
 * A proper "deep module" with simple interface hiding complex implementation
 */
export class TaskService {
  constructor(models, githubTokenService, eventEmitterService = null, gitService = null, projectsDir = '/projects') {
    // Internal services that handle specific aspects
    this.repository = new TaskRepository(models);
    this.gitOps = new TaskGitOperations(models, githubTokenService);
    this.terminalManager = new TaskTerminalManager(models, eventEmitterService);
    
    // NEW: Domain repository for gradual migration
    this.domainRepository = new DomainTaskRepository(models);
    
    // Core dependencies
    this.models = models;
    this.githubTokenService = githubTokenService;
    this.eventEmitterService = eventEmitterService;
    this.gitService = gitService;
    this.projectsDir = projectsDir;
    this.worktreeService = new WorktreeService();
    this.logger = new Logger('TaskService');
  }

  /**
   * Create a new task
   */
  async create(projectId, options = {}) {
    const { name, branch, useExistingBranch = false, githubToken = null, createSession = false, hostname = null } = options;
    
    return await this.logger.timeOperation('task.create', async () => {
      // Get project
      const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Generate task ID and worktree path
    const { v4: uuidv4 } = await import('uuid');
    const taskId = uuidv4().slice(0, 8);
    const worktreePath = path.join(this.projectsDir, `${project.id}-task-${taskId}`);
    
    // Use domain object for validation
    const taskDomain = new TaskDomain(
      taskId,
      projectId,
      name,
      branch,
      worktreePath,
      'active',
      false,
      false
    );
    
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
      const task = await this.repository.create({
        id: taskId,
        project_id: project.id,
        name,
        branch,
        worktree_path: worktreePath
      });
      
      // Create terminal session if requested
      let sessionInfo = null;
      if (createSession) {
        sessionInfo = await this.terminalManager.createTaskSession(taskId, worktreePath);
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
    }, { projectId, name, branch });
  }

  /**
   * Get task details
   */
  async get(taskId, includes = [], options = {}) {
    const { githubToken, projectId } = options;
    
    // Get base task data
    const task = await this.repository.findById(taskId);
    
    // Validate project ownership if projectId provided
    if (projectId && task.project_id !== projectId) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Add optional includes
    if (includes.includes('sessions')) {
      const taskWithSessions = await this.repository.getTaskWithSessions(taskId);
      Object.assign(task, {
        sessions: taskWithSessions.sessions,
        sessionState: taskWithSessions.sessionState,
        active_session_count: taskWithSessions.active_session_count
      });
    }
    
    if (includes.includes('gitStatus')) {
      task.gitStatus = await this.gitOps.getTaskGitStatus(task, githubToken);
    }
    
    if (includes.includes('terminals')) {
      task.terminals = await this.terminalManager.getTaskTerminals(taskId);
    }
    
    return task;
  }

  /**
   * List tasks for a project
   */
  async list(projectId, options = {}) {
    const { minimal = false, githubToken, monitors = {} } = options;
    
    const tasks = await this.repository.findByProjectId(projectId);
    
    if (minimal) {
      return tasks;
    }
    
    // Enrich with git status and session state
    const enrichedTasks = await Promise.all(tasks.map(async (task) => {
      let gitStatus = null;
      
      if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
        try {
          gitStatus = await this.gitOps.getTaskGitStatus(task, githubToken);
        } catch (error) {
          console.error(`Failed to get git status for task ${task.id}:`, error.message);
        }
      }
      
      // Get session state
      const taskWithSessions = await this.repository.getTaskWithSessions(task.id);
      
      return {
        ...task,
        gitStatus,
        sessionState: taskWithSessions.sessionState,
        active_session_count: taskWithSessions.active_session_count
      };
    }));
    
    return enrichedTasks;
  }

  /**
   * Update task metadata only
   */
  async update(taskId, updates = {}) {
    const updatedTask = await this.repository.update(taskId, updates);
    
    // Emit task updated event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(TASK_EVENTS.UPDATED, { taskId, changes: updates });
    }
    
    return updatedTask;
  }

  /**
   * Delete or archive a task
   */
  async delete(taskId, options = {}) {
    const { force = false, softDelete = true, checkSafety = false, githubToken } = options;
    
    if (checkSafety) {
      return this._checkDeletionSafety(taskId, githubToken);
    }
    
    const task = await this.repository.findById(taskId);
    const project = await this.repository.getProject(taskId);
    
    // Clean up terminal sessions
    await this.terminalManager.cleanupSessions(taskId);
    
    if (softDelete && !force) {
      // Archive the task
      await this.repository.archive(taskId);
      
      // Move worktree to archived location
      const archivePath = path.join(
        this.projectsDir, 
        '.archived', 
        `${project.id}-task-${task.id}-${Date.now()}`
      );
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      
      if (fsSync.existsSync(task.worktree_path)) {
        await fs.rename(task.worktree_path, archivePath);
      }
      
      // Emit event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit(TASK_EVENTS.ARCHIVED, { taskId });
      }
      
      return { success: true, message: 'Task archived', archived: true };
    } else {
      // Hard delete
      await this.repository.delete(taskId);
      
      // Remove worktree
      if (fsSync.existsSync(task.worktree_path)) {
        await this.worktreeService.remove(project.local_path, task.worktree_path);
      }
      
      // Emit event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit(TASK_EVENTS.DELETED, { taskId });
      }
      
      return { success: true, message: 'Task deleted', deleted: true };
    }
  }

  /**
   * Sync task with remote repository
   */
  async sync(taskId, operation = 'pull', options = {}) {
    const { githubToken } = options;
    
    const task = await this.repository.findById(taskId);
    const project = await this.repository.getProject(taskId);
    
    if (operation === 'pull') {
      return await this.gitOps.pullUpdates(task, project, githubToken);
    } else if (operation === 'push') {
      const gitService = this.gitService || new GitService(githubToken);
      return await gitService.push(task.worktree_path, task.branch, { setUpstream: true });
    }
    
    throw new Error(`Unknown sync operation: ${operation}`);
  }

  /**
   * Get task split layout configuration
   */
  async getLayout(taskId) {
    const task = await this.repository.findById(taskId);
    if (!task) {
      const error = new Error('Task not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Return the layout or default
    return task.split_layout || { mode: 'tab' };
  }

  /**
   * Set task split layout configuration
   */
  async setLayout(taskId, projectId, layout) {
    const task = await this.repository.findById(taskId);
    if (task.project_id !== projectId) {
      const error = new Error('Task not found in this project');
      error.statusCode = 404;
      throw error;
    }
    
    // Validate layout structure
    const validModes = ['tab', 'split', 'split-4'];
    const validOrientations = ['horizontal', 'vertical'];
    
    if (layout.mode && !validModes.includes(layout.mode)) {
      const error = new Error('Invalid mode. Must be "tab", "split", or "split-4"');
      error.statusCode = 400;
      throw error;
    }
    
    if (layout.orientation && !validOrientations.includes(layout.orientation)) {
      const error = new Error('Invalid orientation. Must be "horizontal" or "vertical"');
      error.statusCode = 400;
      throw error;
    }
    
    if (layout.splitRatio !== undefined) {
      const ratio = parseFloat(layout.splitRatio);
      if (isNaN(ratio) || ratio < 0.1 || ratio > 0.9) {
        const error = new Error('Invalid splitRatio. Must be between 0.1 and 0.9');
        error.statusCode = 400;
        throw error;
      }
      layout.splitRatio = ratio;
    }
    
    // Update the task
    await this.repository.update(taskId, { split_layout: layout });
    
    // Emit event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(SPLIT_EVENTS.LAYOUT_CHANGED, { taskId, layout });
    }
    
    return layout;
  }

  /**
   * Merge task operations
   */
  async merge(taskId, operation = 'toBase', options = {}) {
    const { githubToken } = options;
    
    const task = await this.repository.findById(taskId);
    const project = await this.repository.getProject(taskId);
    
    switch (operation) {
      case 'toBase':
        const result = await this.gitOps.mergeToBase(task, project, githubToken);
        // Update task with merge info
        await this.repository.update(taskId, {
          merged_at: result.mergedAt,
          merge_commit_sha: result.mergedCommit,
          status: 'merged'
        });
        return result;
        
      case 'checkConflicts':
        return await this.gitOps.checkMergeConflicts(task, project, githubToken);
        
      case 'status':
        const status = await this.gitOps.checkMergeStatus(task, project, githubToken);
        // Update database if status changed
        if (status && status.hasCommitsSinceMerge !== task.has_commits_since_merge) {
          await this.repository.update(taskId, {
            has_commits_since_merge: status.hasCommitsSinceMerge
          });
        }
        return status;
        
      default:
        throw new Error(`Unknown merge operation: ${operation}`);
    }
  }

  /**
   * Manage terminal sessions
   */
  async terminal(taskId, action = 'start', options = {}) {
    const { sessionData = {}, monitors = {} } = options;
    
    switch (action) {
      case 'start':
        return await this.terminalManager.createSession(taskId, sessionData, monitors);
      case 'stop':
        return await this.terminalManager.stopSession(taskId, options.sessionId);
      case 'cleanup':
        return await this.terminalManager.cleanupSessions(taskId);
      default:
        throw new Error(`Unknown terminal action: ${action}`);
    }
  }

  /**
   * Get task as domain object (NEW - for gradual migration)
   */
  async getTaskDomain(taskId) {
    return await this.domainRepository.findById(taskId);
  }
  
  /**
   * Check if task can be merged using domain rules
   */
  async canMerge(taskId) {
    const task = await this.domainRepository.findById(taskId);
    
    // Get latest git status to update the domain object
    const gitStatus = await this.gitOps.getStatus(task.worktreePath);
    task.hasUncommittedChanges = gitStatus.hasUncommittedChanges || false;
    task.hasConflicts = gitStatus.hasConflicts || false;
    task.aheadCount = gitStatus.ahead || 0;
    task.behindCount = gitStatus.behind || 0;
    
    return {
      canMerge: task.canMerge(),
      reason: !task.canMerge() ? this._getMergeBlockReason(task) : null,
      needsPull: task.needsPull(),
      needsPush: task.needsPush()
    };
  }
  
  /**
   * Archive merged tasks using domain rules
   */
  async archiveMergedTasks(projectId, daysOld = 30) {
    const tasks = await this.domainRepository.findByProject(projectId);
    const archived = [];
    
    for (const task of tasks) {
      if (task.state === 'merged' && task.canArchive()) {
        // Check age if needed
        const dbTask = await this.models.tasks.findById(task.id);
        const mergedDate = new Date(dbTask.merged_at);
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysOld);
        
        if (mergedDate < cutoffDate) {
          task.archive();
          await this.domainRepository.save(task);
          archived.push(task);
          
          // Emit event
          if (this.eventEmitterService) {
            this.eventEmitterService.emit(TASK_EVENTS.ARCHIVED, { taskId: task.id });
          }
        }
      }
    }
    
    return archived;
  }
  
  _getMergeBlockReason(task) {
    if (task.hasConflicts) return 'Task has merge conflicts';
    if (task.hasUncommittedChanges) return 'Task has uncommitted changes';
    if (task.state !== 'active') return `Task is ${task.state}`;
    return 'Unknown reason';
  }
  
  /**
   * Check deletion safety (private)
   */
  async _checkDeletionSafety(taskId, githubToken) {
    const task = await this.repository.findById(taskId);
    const project = await this.repository.getProject(taskId);
    
    // Check for uncommitted changes
    let hasUncommittedChanges = false;
    let uncommittedFiles = [];
    
    if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
      const gitStatus = await this.gitOps.getTaskGitStatus(task, githubToken);
      hasUncommittedChanges = gitStatus?.hasChanges || false;
      uncommittedFiles = gitStatus?.files || [];
    }
    
    // Check for active sessions
    const hasActiveSessions = await this.repository.hasActiveSessions(taskId);
    
    // Check if branch is pushed
    const gitService = this.gitService || new GitService(githubToken);
    let isPushed = false;
    
    try {
      const branchesResult = await gitService.getBranches(task.worktree_path, true);
      isPushed = branchesResult.branches?.some(b => 
        b.includes(`origin/${task.branch}`) || 
        b.includes(`remotes/origin/${task.branch}`)
      ) || false;
    } catch (error) {
      console.warn('Could not check if branch is pushed:', error.message);
    }
    
    return {
      canDelete: !hasUncommittedChanges && !hasActiveSessions,
      hasUncommittedChanges,
      uncommittedFiles,
      hasActiveSessions,
      isPushed,
      warnings: [
        hasUncommittedChanges && 'Task has uncommitted changes',
        hasActiveSessions && 'Task has active terminal sessions',
        !isPushed && 'Branch has not been pushed to remote'
      ].filter(Boolean)
    };
  }
}