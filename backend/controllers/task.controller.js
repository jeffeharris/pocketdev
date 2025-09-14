/**
 * TaskController - Consolidated controller for all task operations
 * 
 * This controller consolidates all task-related operations that were previously
 * scattered across multiple controller files (task, task-git, task-pr, task-container).
 * Following the AI-assisted architecture principle of "one concept, one file",
 * all task operations are now in this single controller.
 * 
 * Organization:
 * - Core CRUD Operations
 * - Git Operations
 * - Pull Request Operations
 * - Container Operations
 * - Layout/UI State Operations
 * 
 * @typedef {import('../../shared/types/index').Task} Task
 * @typedef {import('../../shared/types/index').CreateTaskDTO} CreateTaskDTO
 * @typedef {import('../../shared/types/index').UpdateTaskDTO} UpdateTaskDTO
 * @typedef {import('../../shared/types/index').GitStatus} GitStatus
 * @typedef {import('../../shared/types/index').APIResponse} APIResponse
 */

import { Logger } from '../utils/logger.js';
import { TaskState } from '../../shared/types/index.js';

export class TaskController {
  constructor(models, projectsDir = '/projects') {
    this.models = models;
    this.projectsDir = projectsDir;
    this.logger = new Logger('TaskController');
  }

  /**
   * Async handler wrapper to eliminate try-catch boilerplate
   * Wraps async route handlers with consistent error handling
   */
  wrap(handlerName, handler) {
    return async (req, res) => {
      try {
        await handler.call(this, req, res);
      } catch (error) {
        this.logger.error(`Failed to ${handlerName}`, {
          correlationId: req.correlationId,
          error: error.message
        });
        res.status(error.statusCode || 500).json({ 
          error: error.message,
          correlationId: req.correlationId
        });
      }
    };
  }

  // ========== CORE CRUD OPERATIONS ==========

  /**
   * Create a new task
   */
  createTask = this.wrap('create task', async (req, res) => {
    const { projectId } = req.params;
    const { name, branch, useExistingBranch = false, createSession = false } = req.body;
    
    const result = await req.services.taskService.create(projectId, {
      name,
      branch,
      useExistingBranch,
      githubToken: req.githubToken,
      createSession,
      hostname: req.get('host')
    });
    
    res.status(201).json(result);
  });

  /**
   * Get all tasks for a project
   */
  getTasks = this.wrap('get tasks', async (req, res) => {
    const { projectId } = req.params;
    const { minimal } = req.query;
    
    const tasks = await req.services.taskService.list(projectId, {
      minimal: minimal === 'true'
    });
    
    res.json(tasks);
  });

  /**
   * Get single task
   */
  getTask = this.wrap('get task', async (req, res) => {
    const { taskId } = req.params;
    
    const task = await req.services.taskService.get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    res.json(task);
  });

  /**
   * Update task metadata
   */
  updateTask = this.wrap('update task', async (req, res) => {
    const { taskId } = req.params;
    const updates = req.body;
    
    const result = await req.services.taskService.update(taskId, updates);
    res.json(result);
  });

  /**
   * Open task (setup worktree and terminal)
   */
  openTask = this.wrap('open task', async (req, res) => {
    const { projectId, taskId } = req.params;
    const { restoreLayout = false } = req.query;
    
    const result = await req.services.taskService.open(taskId, {
      projectId,
      githubToken: req.githubToken,
      hostname: req.get('host'),
      restoreLayout: restoreLayout === 'true'
    });
    
    res.json(result);
  });

  /**
   * Close task (cleanup resources)
   */
  closeTask = this.wrap('close task', async (req, res) => {
    const { taskId } = req.params;
    
    const result = await req.services.taskService.close(taskId);
    res.json(result);
  });

  /**
   * Sync task with git status
   */
  syncTask = this.wrap('sync task', async (req, res) => {
    const { projectId, taskId } = req.params;
    
    const result = await req.services.taskService.sync(taskId, {
      projectId,
      githubToken: req.githubToken
    });
    
    res.json(result);
  });

  /**
   * Check if task can be safely deleted
   */
  checkDelete = this.wrap('check delete safety', async (req, res) => {
    const { taskId } = req.params;
    
    const safetyCheck = await req.services.taskService.delete(taskId, {
      checkSafety: true,
      githubToken: req.githubToken
    });
    
    res.json(safetyCheck);
  });

  /**
   * Delete or archive task
   */
  deleteTask = this.wrap('delete task', async (req, res) => {
    const { taskId } = req.params;
    const { force = false, softDelete = true } = req.query;
    
    const result = await req.services.taskService.delete(taskId, {
      force: force === 'true',
      softDelete: softDelete !== 'false'
    });
    
    res.json(result);
  });

  // ========== GIT OPERATIONS ==========

  /**
   * Get detailed git status
   */
  getGitStatus = this.wrap('get git status', async (req, res) => {
    const { taskId } = req.params;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    const status = await gitService.getStatus(task.worktree_path);
    
    res.json(status);
  });

  /**
   * Get file changes (diff)
   */
  getFileChanges = this.wrap('get file changes', async (req, res) => {
    const { taskId } = req.params;
    const { staged = false } = req.query;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    const changes = await gitService.getFileChanges(task.worktree_path, {
      staged: staged === 'true'
    });
    
    res.json(changes);
  });

  /**
   * Stage files for commit
   */
  stageFiles = this.wrap('stage files', async (req, res) => {
    const { taskId } = req.params;
    const { files } = req.body;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    await gitService.stageFiles(task.worktree_path, files);
    
    res.json({ success: true });
  });

  /**
   * Unstage files
   */
  unstageFiles = this.wrap('unstage files', async (req, res) => {
    const { taskId } = req.params;
    const { files } = req.body;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    await gitService.unstageFiles(task.worktree_path, files);
    
    res.json({ success: true });
  });

  /**
   * Create commit
   */
  createCommit = this.wrap('create commit', async (req, res) => {
    const { taskId } = req.params;
    const { message } = req.body;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    const commitId = await gitService.commit(task.worktree_path, message);
    
    res.json({ commitId });
  });

  /**
   * Push changes to remote
   */
  pushChanges = this.wrap('push changes', async (req, res) => {
    const { taskId } = req.params;
    const { force = false } = req.body;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    await gitService.push(task.worktree_path, task.branch, {
      force,
      githubToken: req.githubToken
    });
    
    res.json({ success: true });
  });

  /**
   * Pull changes from remote
   */
  pullChanges = this.wrap('pull changes', async (req, res) => {
    const { taskId } = req.params;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    const result = await gitService.pull(task.worktree_path, {
      githubToken: req.githubToken
    });
    
    res.json(result);
  });

  /**
   * Check for merge conflicts
   */
  checkMergeConflicts = this.wrap('check merge conflicts', async (req, res) => {
    const { taskId } = req.params;
    const { targetBranch = 'main' } = req.query;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    const conflicts = await gitService.checkMergeConflicts(
      task.worktree_path,
      task.branch,
      targetBranch
    );
    
    res.json(conflicts);
  });

  /**
   * Get commit history
   */
  getCommitHistory = this.wrap('get commit history', async (req, res) => {
    const { taskId } = req.params;
    const { limit = 50 } = req.query;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    const history = await gitService.getCommitHistory(task.worktree_path, {
      limit: parseInt(limit)
    });
    
    res.json(history);
  });

  /**
   * Reset changes (hard reset)
   */
  resetChanges = this.wrap('reset changes', async (req, res) => {
    const { taskId } = req.params;
    const { mode = 'mixed' } = req.body;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.gitService;
    await gitService.reset(task.worktree_path, mode);
    
    res.json({ success: true });
  });

  // ========== PULL REQUEST OPERATIONS ==========

  /**
   * Create pull request
   */
  createPullRequest = this.wrap('create pull request', async (req, res) => {
    const { projectId, taskId } = req.params;
    const { title, body, draft = false } = req.body;
    
    const result = await req.services.taskService.createPullRequest(taskId, {
      projectId,
      title,
      body,
      draft,
      githubToken: req.githubToken
    });
    
    res.json(result);
  });

  /**
   * Get pull request details
   */
  getPullRequest = this.wrap('get pull request', async (req, res) => {
    const { taskId } = req.params;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task || !task.pr_number) {
      return res.status(404).json({ error: 'No pull request found for this task' });
    }
    
    const project = await this.models.projects.findById(task.project_id);
    const prService = req.services.pullRequestService;
    
    const pr = await prService.get(project.github_url, task.pr_number, {
      githubToken: req.githubToken
    });
    
    res.json(pr);
  });

  /**
   * Update pull request
   */
  updatePullRequest = this.wrap('update pull request', async (req, res) => {
    const { taskId } = req.params;
    const updates = req.body;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task || !task.pr_number) {
      return res.status(404).json({ error: 'No pull request found for this task' });
    }
    
    const project = await this.models.projects.findById(task.project_id);
    const prService = req.services.pullRequestService;
    
    const result = await prService.update(
      project.github_url,
      task.pr_number,
      updates,
      { githubToken: req.githubToken }
    );
    
    res.json(result);
  });

  // ========== CONTAINER OPERATIONS ==========

  /**
   * Stop container and cleanup
   */
  stopContainer = this.wrap('stop container', async (req, res) => {
    const { taskId } = req.params;
    const { cleanup = false } = req.query;
    
    const result = await req.services.containerService.stop(taskId, {
      cleanup: cleanup === 'true'
    });
    
    res.json(result);
  });

  /**
   * Restart container
   */
  restartContainer = this.wrap('restart container', async (req, res) => {
    const { taskId } = req.params;
    
    const result = await req.services.containerService.restart(taskId);
    res.json(result);
  });

  /**
   * Get container logs
   */
  getContainerLogs = this.wrap('get container logs', async (req, res) => {
    const { taskId } = req.params;
    const { tail = 100 } = req.query;
    
    const logs = await req.services.containerService.getLogs(taskId, {
      tail: parseInt(tail)
    });
    
    res.json({ logs });
  });

  /**
   * Get container stats
   */
  getContainerStats = this.wrap('get container stats', async (req, res) => {
    const { taskId } = req.params;
    
    const stats = await req.services.containerService.getStats(taskId);
    res.json(stats);
  });

  // ========== LAYOUT/UI STATE OPERATIONS ==========

  /**
   * Save terminal layout
   */
  saveTerminalLayout = this.wrap('save terminal layout', async (req, res) => {
    const { taskId } = req.params;
    const layout = req.body;
    
    await req.services.taskService.saveLayout(taskId, layout);
    res.json({ success: true });
  });

  /**
   * Get terminal layout
   */
  getTerminalLayout = this.wrap('get terminal layout', async (req, res) => {
    const { taskId } = req.params;
    
    const layout = await req.services.taskService.getLayout(taskId);
    res.json(layout || { terminals: [] });
  });

  /**
   * Get split layout configuration
   */
  getSplitLayout = this.wrap('get split layout', async (req, res) => {
    const { taskId } = req.params;
    
    const layout = await req.services.taskService.getLayout(taskId);
    res.json(layout || { mode: 'single' });
  });

  /**
   * Update split layout configuration
   */
  updateSplitLayout = this.wrap('update split layout', async (req, res) => {
    const { projectId, taskId } = req.params;
    const layout = req.body;
    
    await req.services.taskService.setLayout(taskId, projectId, layout);
    res.json({ success: true });
  });
}