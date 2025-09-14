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
 */

import { Logger } from '../utils/logger.js';

export class TaskController {
  constructor(models, projectsDir = '/projects') {
    this.models = models;
    this.projectsDir = projectsDir;
    this.logger = new Logger('TaskController');
  }

  // ========== CORE CRUD OPERATIONS ==========

  /**
   * Create a new task
   */
  async createTask(req, res) {
    try {
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
    } catch (error) {
      this.logger.error('Failed to create task', {
        correlationId: req.correlationId,
        error: error.message,
        projectId: req.params.projectId
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * List tasks with minimal information
   */
  async listTasksMinimal(req, res) {
    try {
      const { projectId } = req.params;
      
      const tasks = await req.services.taskService.list(projectId, {
        minimal: true
      });
      
      res.json(tasks);
    } catch (error) {
      this.logger.error('Failed to list tasks (minimal)', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * List all tasks with full details
   */
  async listTasks(req, res) {
    try {
      const { projectId } = req.params;
      
      const tasks = await req.services.taskService.list(projectId, {
        githubToken: req.githubToken,
        monitors: req.monitors
      });
      
      res.json(tasks);
    } catch (error) {
      this.logger.error('Failed to list tasks', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get task details
   */
  async getTask(req, res) {
    try {
      const { projectId, taskId } = req.params;
      const { includes = [] } = req.query;
      
      const task = await req.services.taskService.get(taskId, includes, {
        githubToken: req.githubToken,
        projectId
      });
      
      res.json(task);
    } catch (error) {
      this.logger.error('Failed to get task', {
        correlationId: req.correlationId,
        error: error.message,
        taskId: req.params.taskId
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get task status for real-time updates
   */
  async getTaskStatus(req, res) {
    try {
      const { projectId, taskId } = req.params;
      
      const task = await req.services.taskService.get(taskId, ['gitStatus', 'sessions'], {
        githubToken: req.githubToken,
        projectId
      });
      
      res.json({
        id: task.id,
        name: task.name,
        branch: task.branch,
        sessionState: task.sessionState,
        gitStatus: task.gitStatus,
        active_session_count: task.active_session_count
      });
    } catch (error) {
      this.logger.error('Failed to get task status', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Update task metadata
   */
  async updateTaskMetadata(req, res) {
    try {
      const { taskId } = req.params;
      const updates = req.body;
      
      const updatedTask = await req.services.taskService.update(taskId, updates);
      res.json(updatedTask);
    } catch (error) {
      this.logger.error('Failed to update task metadata', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Update task with remote changes
   */
  async updateTask(req, res) {
    try {
      const { projectId, taskId } = req.params;
      
      const result = await req.services.taskService.sync(taskId, {
        projectId,
        githubToken: req.githubToken
      });
      
      res.json(result);
    } catch (error) {
      this.logger.error('Failed to update task', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Check if task can be safely deleted
   */
  async checkDelete(req, res) {
    try {
      const { taskId } = req.params;
      
      const safetyCheck = await req.services.taskService.delete(taskId, {
        checkSafety: true,
        githubToken: req.githubToken
      });
      
      res.json(safetyCheck);
    } catch (error) {
      this.logger.error('Failed to check delete safety', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Delete or archive task
   */
  async deleteTask(req, res) {
    try {
      const { taskId } = req.params;
      const { force = false, softDelete = true } = req.query;
      
      const result = await req.services.taskService.delete(taskId, {
        force: force === 'true',
        softDelete: softDelete !== 'false'
      });
      
      res.json(result);
    } catch (error) {
      this.logger.error('Failed to delete task', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  // ========== GIT OPERATIONS ==========

  /**
   * Get detailed git status
   */
  async getGitStatus(req, res) {
    try {
      const { taskId } = req.params;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const gitService = req.services.gitService;
      const status = await gitService.getStatus(task.worktree_path);
      
      res.json(status);
    } catch (error) {
      this.logger.error('Failed to get git status', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get changed files with diff details
   */
  async getChangedFiles(req, res) {
    try {
      const { taskId } = req.params;
      const { includeContent = false } = req.query;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const gitService = req.services.gitService;
      const changes = await gitService.getStatus(task.worktree_path);
      
      if (includeContent === 'true') {
        // Add diff content for each file
        for (const file of changes.files) {
          const diff = await gitService.getDiff(task.worktree_path, { file: file.path });
          file.diff = diff.output;
        }
      }
      
      res.json(changes);
    } catch (error) {
      this.logger.error('Failed to get changed files', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get all changes (working tree + committed not in base)
   */
  async getAllChanges(req, res) {
    try {
      const { taskId } = req.params;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      const gitService = req.services.gitService;
      
      // Get working tree changes
      const status = await gitService.getStatus(task.worktree_path);
      
      // Get commits not in base branch
      const commits = await gitService.getCommits(task.worktree_path, {
        notIn: project.base_branch
      });
      
      res.json({
        workingTree: status.files,
        commits: commits.commits,
        totalChanges: status.files.length + commits.commits.length
      });
    } catch (error) {
      this.logger.error('Failed to get all changes', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get full diff for all changes in the task
   */
  async getTaskDiff(req, res) {
    try {
      const { taskId } = req.params;
      const { base = 'HEAD' } = req.query;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const gitService = req.services.gitService;
      const diff = await gitService.getDiff(task.worktree_path, { base });
      
      res.json(diff);
    } catch (error) {
      this.logger.error('Failed to get task diff', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get diff for a specific file
   */
  async getFileDiff(req, res) {
    try {
      const { taskId, file } = req.params;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const gitService = req.services.gitService;
      const diff = await gitService.getDiff(task.worktree_path, { file });
      
      res.json(diff);
    } catch (error) {
      this.logger.error('Failed to get file diff', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get commit history for the task
   */
  async getCommitHistory(req, res) {
    try {
      const { taskId } = req.params;
      const { limit = 50 } = req.query;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const gitService = req.services.gitService;
      const commits = await gitService.getCommits(task.worktree_path, { limit });
      
      res.json(commits);
    } catch (error) {
      this.logger.error('Failed to get commit history', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Check for merge conflicts
   */
  async checkConflicts(req, res) {
    try {
      const { taskId } = req.params;
      
      const conflicts = await req.services.taskService.merge(taskId, 'check', {
        githubToken: req.githubToken
      });
      
      res.json(conflicts);
    } catch (error) {
      this.logger.error('Failed to check conflicts', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Check merge conflicts (legacy endpoint)
   */
  async checkMergeConflicts(req, res) {
    return this.checkConflicts(req, res);
  }

  /**
   * Merge task to base branch
   */
  async mergeToBase(req, res) {
    try {
      const { taskId } = req.params;
      
      const result = await req.services.taskService.merge(taskId, 'toBase', {
        githubToken: req.githubToken
      });
      
      res.json(result);
    } catch (error) {
      this.logger.error('Failed to merge to base', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Generic git operation (legacy endpoint)
   */
  async gitOperation(req, res) {
    try {
      const { taskId } = req.params;
      const { operation, ...params } = req.body;
      
      // Map legacy operations to new methods
      switch (operation) {
        case 'status':
          return this.getGitStatus(req, res);
        case 'commit':
          return this.commitChanges(req, res);
        case 'push':
          return this.pushChanges(req, res);
        default:
          res.status(400).json({ error: `Unknown operation: ${operation}` });
      }
    } catch (error) {
      this.logger.error('Failed to perform git operation', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  // ========== PULL REQUEST OPERATIONS ==========

  /**
   * Create pull request
   */
  async createPullRequest(req, res) {
    try {
      const { taskId } = req.params;
      const { title, body, draft = false } = req.body;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      const githubService = req.services.githubService;
      
      const pr = await githubService.createPullRequest({
        owner: project.owner,
        repo: project.name,
        title: title || `Task: ${task.name}`,
        body: body || `Automated PR for task ${task.name}`,
        head: task.branch,
        base: project.base_branch,
        draft
      });
      
      // Update task with PR info
      await this.models.tasks.update(taskId, {
        pr_number: pr.number,
        pr_url: pr.html_url
      });
      
      res.json(pr);
    } catch (error) {
      this.logger.error('Failed to create pull request', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Merge pull request
   */
  async mergePullRequest(req, res) {
    try {
      const { taskId } = req.params;
      const { mergeMethod = 'merge' } = req.body;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task || !task.pr_number) {
        return res.status(404).json({ error: 'Task or pull request not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      const githubService = req.services.githubService;
      
      const result = await githubService.mergePullRequest({
        owner: project.owner,
        repo: project.name,
        pullNumber: task.pr_number,
        mergeMethod
      });
      
      // Update task status
      await this.models.tasks.update(taskId, {
        is_merged: true,
        merged_at: new Date().toISOString()
      });
      
      res.json(result);
    } catch (error) {
      this.logger.error('Failed to merge pull request', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get PR status
   */
  async getPullRequestStatus(req, res) {
    try {
      const { taskId } = req.params;
      
      const task = await this.models.tasks.findById(taskId);
      if (!task || !task.pr_number) {
        return res.json({ exists: false });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      const githubService = req.services.githubService;
      
      const pr = await githubService.getPullRequest({
        owner: project.owner,
        repo: project.name,
        pullNumber: task.pr_number
      });
      
      res.json({
        exists: true,
        ...pr
      });
    } catch (error) {
      // PR might not exist
      res.json({ exists: false });
    }
  }

  // ========== CONTAINER OPERATIONS ==========

  /**
   * Deploy containers for validation
   */
  async deployContainers(req, res) {
    try {
      const { taskId } = req.params;
      const { services = ['frontend', 'backend'] } = req.body;
      
      // Container deployment would be implemented here
      // For now, return mock response
      res.json({
        success: true,
        message: 'Container deployment not yet implemented',
        taskId,
        services
      });
    } catch (error) {
      this.logger.error('Failed to deploy containers', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Stop containers
   */
  async stopContainers(req, res) {
    try {
      const { taskId } = req.params;
      
      res.json({
        success: true,
        message: 'Container stopping not yet implemented',
        taskId
      });
    } catch (error) {
      this.logger.error('Failed to stop containers', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get running services
   */
  async getServices(req, res) {
    try {
      const { taskId } = req.params;
      
      res.json({
        services: [],
        message: 'Service listing not yet implemented',
        taskId
      });
    } catch (error) {
      this.logger.error('Failed to get services', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get preview URL
   */
  async getPreviewUrl(req, res) {
    try {
      const { taskId } = req.params;
      
      res.json({
        url: null,
        message: 'Preview URL generation not yet implemented',
        taskId
      });
    } catch (error) {
      this.logger.error('Failed to get preview URL', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(req, res) {
    try {
      const { taskId } = req.params;
      const { service = 'all', lines = 100 } = req.query;
      
      res.json({
        logs: [],
        message: 'Container log retrieval not yet implemented',
        taskId,
        service,
        lines
      });
    } catch (error) {
      this.logger.error('Failed to get container logs', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Debug shell access
   */
  async debugShell(req, res) {
    try {
      const { taskId } = req.params;
      
      res.json({
        message: 'Debug shell not yet implemented',
        taskId
      });
    } catch (error) {
      this.logger.error('Failed to access debug shell', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Restart containers
   */
  async restartContainers(req, res) {
    try {
      const { taskId } = req.params;
      
      res.json({
        success: true,
        message: 'Container restart not yet implemented',
        taskId
      });
    } catch (error) {
      this.logger.error('Failed to restart containers', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  // ========== LAYOUT/UI STATE OPERATIONS ==========

  /**
   * Get split layout configuration
   */
  async getSplitLayout(req, res) {
    try {
      const { taskId } = req.params;
      
      const layout = await req.services.taskService.getLayout(taskId);
      res.json(layout || { mode: 'single' });
    } catch (error) {
      this.logger.error('Failed to get split layout', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }

  /**
   * Update split layout configuration
   */
  async updateSplitLayout(req, res) {
    try {
      const { projectId, taskId } = req.params;
      const layout = req.body;
      
      await req.services.taskService.setLayout(taskId, projectId, layout);
      res.json({ success: true });
    } catch (error) {
      this.logger.error('Failed to update split layout', {
        correlationId: req.correlationId,
        error: error.message
      });
      res.status(error.statusCode || 500).json({ 
        error: error.message,
        correlationId: req.correlationId
      });
    }
  }
}