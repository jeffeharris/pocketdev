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
    
    const result = await req.services.TaskService.create(projectId, {
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
    
    const tasks = await req.services.TaskService.list(projectId, {
      minimal: minimal === 'true'
    });
    
    res.json(tasks);
  });

  /**
   * Get single task
   */
  getTask = this.wrap('get task', async (req, res) => {
    const { projectId, taskId } = req.params;
    
    // Include terminals and sessions for the frontend
    const task = await req.services.TaskService.get(
      taskId, 
      ['terminals', 'sessions', 'gitStatus'],
      { githubToken: req.githubToken, projectId }
    );
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
    
    const result = await req.services.TaskService.update(taskId, updates);
    res.json(result);
  });

  /**
   * Open task (setup worktree and terminal)
   */
  openTask = this.wrap('open task', async (req, res) => {
    const { projectId, taskId } = req.params;
    const { restoreLayout = false } = req.query;
    
    const result = await req.services.TaskService.open(taskId, {
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
    
    const result = await req.services.TaskService.close(taskId);
    res.json(result);
  });

  /**
   * Sync task with git status
   */
  syncTask = this.wrap('sync task', async (req, res) => {
    const { projectId, taskId } = req.params;
    
    const result = await req.services.TaskService.sync(taskId, {
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
    
    const safetyCheck = await req.services.TaskService.delete(taskId, {
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
    
    const result = await req.services.TaskService.delete(taskId, {
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const gitService = req.services.GitService;
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
    
    const result = await req.services.TaskService.createPullRequest(taskId, {
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
    
    await req.services.TaskService.saveLayout(taskId, layout);
    res.json({ success: true });
  });

  /**
   * Get terminal layout
   */
  getTerminalLayout = this.wrap('get terminal layout', async (req, res) => {
    const { taskId } = req.params;
    
    const layout = await req.services.TaskService.getLayout(taskId);
    res.json(layout || { terminals: [] });
  });

  /**
   * Get split layout configuration
   */
  getSplitLayout = this.wrap('get split layout', async (req, res) => {
    const { taskId } = req.params;
    
    const layout = await req.services.TaskService.getLayout(taskId);
    res.json(layout || { mode: 'single' });
  });

  /**
   * Update split layout configuration
   */
  updateSplitLayout = this.wrap('update split layout', async (req, res) => {
    const { projectId, taskId } = req.params;
    const layout = req.body;
    
    await req.services.TaskService.setLayout(taskId, projectId, layout);
    res.json({ success: true });
  });

  /**
   * Get all changes for a task (working, staged, committed)
   */
  getAllChanges = this.wrap('get all changes', async (req, res) => {
    const { taskId } = req.params;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.GitService;
    const status = await gitService.getStatus(task.worktree_path);
    
    // Get commits (unpushed)
    const commits = await gitService.getCommits(task.worktree_path, { limit: 10 });
    
    // Build file list from status
    const files = [];
    
    // Add staged files
    if (status.staged && status.staged.length > 0) {
      files.push(...status.staged.map(f => ({ 
        path: f,
        staged: true,
        type: 'modified'
      })));
    }
    
    // Add modified files
    if (status.modified && status.modified.length > 0) {
      files.push(...status.modified.map(f => ({ 
        path: f,
        unstaged: true,
        type: 'modified'
      })));
    }
    
    // Add untracked files
    if (status.untracked && status.untracked.length > 0) {
      files.push(...status.untracked.map(f => ({ 
        path: f,
        untracked: true,
        type: 'added'
      })));
    }
    
    res.json({
      files,
      summary: {
        staged: status.staged?.length || 0,
        unstaged: status.modified?.length || 0,
        untracked: status.untracked?.length || 0,
        committed: commits.length,
        total: files.length,
        unpushedCommits: commits.length
      },
      unpushedCommits: commits,
      hasWorkingChanges: files.length > 0
    });
  });

  /**
   * Get diff for task viewing
   */
  getTaskDiff = this.wrap('get task diff', async (req, res) => {
    const { taskId } = req.params;
    const { compareWith = 'working' } = req.query;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.GitService;
    const status = await gitService.getStatus(task.worktree_path);
    
    // Build file list from status
    const files = [];
    
    if (compareWith === 'base') {
      // Get diff against base branch
      const baseBranch = task.base_branch || 'main';
      const diff = await gitService.getDiff(task.worktree_path, `origin/${baseBranch}`, 'HEAD');
      
      // Parse diff to get file list
      const fileSet = new Set();
      const lines = diff.output.split('\n');
      for (const line of lines) {
        if (line.startsWith('diff --git')) {
          const match = line.match(/b\/(.+)$/);
          if (match) {
            fileSet.add(match[1]);
          }
        }
      }
      
      files.push(...Array.from(fileSet).map(f => ({
        path: f,
        type: 'modified',
        committed: true
      })));
    } else {
      // Working changes
      if (status.staged && status.staged.length > 0) {
        files.push(...status.staged.map(f => ({ 
          path: f,
          staged: true,
          type: 'modified'
        })));
      }
      
      if (status.modified && status.modified.length > 0) {
        files.push(...status.modified.map(f => ({ 
          path: f,
          unstaged: true,
          type: 'modified'
        })));
      }
      
      if (status.untracked && status.untracked.length > 0) {
        files.push(...status.untracked.map(f => ({ 
          path: f,
          untracked: true,
          type: 'added'
        })));
      }
    }
    
    res.json({
      files,
      compareWith,
      hasWorkingChanges: files.length > 0
    });
  });

  /**
   * Get diff for a specific file
   */
  getFileDiff = this.wrap('get file diff', async (req, res) => {
    const { taskId, file } = req.params;
    const { compareWith = 'working' } = req.query;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.GitService;
    const filePath = decodeURIComponent(file);
    
    let diff;
    if (compareWith === 'base') {
      // Diff against base branch
      const baseBranch = task.base_branch || 'main';
      const result = await gitService.getDiff(task.worktree_path, `origin/${baseBranch}`, 'HEAD', {
        files: [filePath]
      });
      diff = result.output;
    } else if (compareWith === 'staged') {
      // Diff for staged files
      const result = await gitService.getDiff(task.worktree_path, 'HEAD', null, {
        files: [filePath],
        staged: true
      });
      diff = result.output;
    } else {
      // Working tree diff
      const result = await gitService.getDiff(task.worktree_path, 'HEAD', null, {
        files: [filePath]
      });
      diff = result.output;
    }
    
    res.json({
      path: filePath,
      diff: diff || '',
      hasDiff: !!diff
    });
  });

  /**
   * Check for merge conflicts
   */
  checkConflicts = this.wrap('check conflicts', async (req, res) => {
    const { taskId } = req.params;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.GitService;
    const baseBranch = task.base_branch || 'main';
    const conflicts = await gitService.checkConflicts(task.worktree_path, baseBranch);
    
    res.json({ hasConflicts: conflicts.hasConflicts, conflicts });
  });

  /**
   * Legacy git operation handler
   */
  gitOperation = this.wrap('git operation', async (req, res) => {
    const { taskId } = req.params;
    const { operation, ...options } = req.body;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.GitService;
    let result;
    
    // Handle different operations
    switch (operation) {
      case 'add':
        // Stage files using git add
        const addCmd = options.files ? `git add ${options.files}` : 'git add .';
        result = await gitService.execute(addCmd, task.worktree_path);
        break;
      case 'commit':
        result = await gitService.commit(task.worktree_path, options.message, options.files);
        break;
      case 'push':
        result = await gitService.push(task.worktree_path, task.branch);
        break;
      case 'pull':
        result = await gitService.sync(task.worktree_path, { branch: task.branch });
        break;
      case 'unstage':
        // Unstage files using git reset
        const resetCmd = options.files ? `git reset HEAD ${options.files}` : 'git reset HEAD';
        result = await gitService.execute(resetCmd, task.worktree_path);
        break;
      default:
        return res.status(400).json({ error: `Unknown operation: ${operation}` });
    }
    
    if (!result.success) {
      return res.status(400).json({ error: result.error, operation });
    }
    
    res.json({ success: true, operation, output: result.output });
  });

  /**
   * Get changed files (for backward compatibility)
   */
  getChangedFiles = this.wrap('get changed files', async (req, res) => {
    const { taskId } = req.params;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const gitService = req.services.GitService;
    const status = await gitService.getStatus(task.worktree_path);
    
    // Build changed files list from status
    const files = [];
    
    if (status.staged) files.push(...status.staged.map(f => ({ path: f, staged: true })));
    if (status.modified) files.push(...status.modified.map(f => ({ path: f, modified: true })));
    if (status.untracked) files.push(...status.untracked.map(f => ({ path: f, untracked: true })));
    
    res.json({ files });
  });
}