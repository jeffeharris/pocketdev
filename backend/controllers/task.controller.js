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
  async listTasks(req, res) {
    const { projectId } = req.params;
    const aiMonitor = req.services.aiMonitor;
    
    try {
      const tasks = await this.models.tasks.findByProjectId(projectId);
      
      // Get the project to know the base branch
      const project = await this.models.projects.findById(projectId);
      const baseBranch = `origin/${project.base_branch || 'main'}`;
      
      // Create GitStatusService
      const githubTokenService = req.services.GitHubTokenService;
      const gitStatusService = new GitStatusService(this.models, githubTokenService);
      
      // Enrich tasks with git status and session state
      const tasksWithFullStatus = await Promise.all(tasks.map(async (task) => {
        let gitStatus = null;
        
        if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
          try {
            gitStatus = await gitStatusService.getTaskGitStatus(task.id, req.githubToken);
          } catch (error) {
            console.error(`Failed to get git status for task ${task.id}:`, error.message);
          }
        }
        
        // Get session state from AI monitor (live) or database (persisted)
        // This two-tier approach ensures we always show the most current state:
        // 1. Live state from AI monitor (if terminal session is active)
        // 2. Persisted state from database (if no active session)
        let sessionState = { status: 'not-started', lastStateChange: null };
        
        // First try to get live state from AI monitor
        let liveStatus = null;
        if (aiMonitor && aiMonitor.getSessionStatus) {
          const sessionId = `task-${task.id}`;
          liveStatus = aiMonitor.getSessionStatus(sessionId);
          
          if (liveStatus) {
            // Use live state from AI monitor - this is the most accurate
            sessionState = {
              status: liveStatus.currentState,
              lastStateChange: new Date().toISOString()
            };
          }
        }
        
        // If no live state from AI monitor, get from database
        // This happens when:
        // - No terminal session exists for this task
        // - Backend just restarted and hasn't received terminal data yet
        if (!liveStatus) {
          const taskWithSession = await this.getTaskWithSessionState(task.id);
          if (taskWithSession && taskWithSession.sessionState) {
            sessionState = taskWithSession.sessionState;
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
      
      res.json(tasksWithFullStatus);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get task status (lightweight endpoint for polling/real-time updates)
   */
  async getTaskStatus(req, res) {
    const { taskId } = req.params;
    
    try {
      const task = await this.getTaskWithSessionState(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Get git status
      let gitStatus = {
        ahead: 0,
        behind: 0,
        hasConflicts: false
      };
      
      if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
        // Get the project to know the base branch
        const project = await this.models.projects.findById(task.project_id);
        if (project) {
          const baseBranch = `origin/${project.base_branch || 'main'}`;
          const githubTokenService = req.services.GitHubTokenService;
          const gitStatusService = new GitStatusService(this.models, githubTokenService);
          gitStatus = await gitStatusService.getTaskGitStatus(task.id, req.services.git);
        }
      }
      
      // Return just the status information
      res.json({
        id: task.id,
        taskState: task.taskState,
        sessionState: task.sessionState,
        gitStatus
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get task details with git status
   */
  async getTask(req, res) {
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
      
      // Get project for base branch info
      const project = await this.models.projects.findById(projectId);
      
      // Get terminal sessions for this task (limit to 6 most recent)
      const allTerminals = await this.models.sessions.findAllActiveByTaskId(taskId);
      const terminals = allTerminals.slice(0, 6);
      
      // Log warning if too many terminals
      if (allTerminals.length > 6) {
        console.warn(`Task ${taskId} has ${allTerminals.length} terminals - showing only first 6`);
      }
      
      // Get git status for this task's worktree
      let gitInfo = null;
      let mergeInfo = null;
      
      // Create git modules for operations
      const workingTree = new GitWorkingTree(req.githubToken);
      const analyzer = new GitAnalyzer(req.githubToken);
      const repository = new GitRepository(req.githubToken);
      const githubTokenService = req.services.GitHubTokenService;
      const gitStatusService = new GitStatusService(this.models, githubTokenService);
      
      if (fsSync.existsSync(task.worktree_path)) {
        const status = await workingTree.getStatus(task.worktree_path);
        const diff = await analyzer.getDiff(task.worktree_path, '--stat');
        
        gitInfo = {
          status: status.output,
          diff: diff.output,
          hasChanges: status.output.trim().length > 0
        };
        
        // Update task if uncommitted changes status changed
        if (gitInfo.hasChanges !== task.has_uncommitted_changes) {
          await this.models.tasks.update(task.id, {
            has_uncommitted_changes: gitInfo.hasChanges
          });
        }
        
        // Check for commits since merge if task was merged
        if (task.merge_commit_sha) {
          mergeInfo = await this._checkMergeStatus(task, project, repository);
        }
      }
      
      // Get terminal states using TerminalService
      const terminalService = req.services.TerminalService;
      const terminalsWithStatus = await terminalService.getTaskSessions(taskId, {
        aiMonitor: req.services.aiMonitor,
        wsAdapter: req.services.wsAdapter
      });
      
      res.json({
        ...task,
        git: gitInfo,
        mergeInfo: mergeInfo,
        claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(task.worktree_path)}`,
        terminals: terminalsWithStatus
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
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
    const { method = 'merge', withClaude = false } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      
      // Check for uncommitted changes
      const workingTree = new GitWorkingTree(req.githubToken);
      const statusResult = await workingTree.getStatus(task.worktree_path);
      if (statusResult.output.trim()) {
        return res.status(400).json({ 
          error: 'Cannot update: You have uncommitted changes',
          hasUncommitted: true,
          changes: statusResult.output
        });
      }
      
      // Check for conflicts before attempting merge
      const analyzer = new GitAnalyzer(req.githubToken);
      const repository = new GitRepository(req.githubToken);
      const conflicts = await analyzer.checkMergeConflicts(
        task.worktree_path, 
        `origin/${project.base_branch}`
      );
      
      if (conflicts.hasConflicts) {
        return res.status(400).json({
          error: 'Merge conflicts detected',
          hasConflicts: true,
          conflicts: conflicts.conflicts
        });
      }
      
      // Perform update directly since no conflicts detected
      let result;
      if (method === 'rebase') {
        result = await repository.rebase(task.worktree_path, `origin/${project.base_branch}`);
      } else {
        result = await repository.merge(task.worktree_path, `origin/${project.base_branch}`);
      }
      
      await this.models.projects.updateLastAccessed(project.id);
      
      // After rebase, check if branches became identical
      if (result.success && method === 'rebase' && task.status === 'merged') {
        const diffResult = await analyzer.getDiff(task.worktree_path, `${project.base_branch}..HEAD --name-only`);
        if (!diffResult.output.trim()) {
          // Branches are now identical, clear the "needs re-merge" flag
          await this.models.tasks.update(task.id, {
            has_commits_since_merge: false
          });
        }
      }
      
      // Trigger status update if successful
      if (result.success) {
        await this.triggerStatusUpdate(taskId, req);
      }
      
      res.json({ 
        success: result.success, 
        output: result.output,
        method
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Check for merge conflicts
   */
  async checkMergeConflicts(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      
      // Check for conflicts using git analyzer
      const analyzer = new GitAnalyzer(req.githubToken);
      const conflicts = await analyzer.checkMergeConflicts(
        task.worktree_path, 
        `origin/${project.base_branch}`
      );
      
      res.json(conflicts);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Merge task into base branch
   */
  async mergeToBase(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      const repository = new GitRepository(req.githubToken);
      const workingTree = new GitWorkingTree(req.githubToken);
      const analyzer = new GitAnalyzer(req.githubToken);
      
      // Direct merge
      // First ensure the task branch is pushed to origin
      const pushResult = await repository.push(task.worktree_path, task.branch, { setUpstream: true });
      if (!pushResult.success && !pushResult.error?.includes('Everything up-to-date')) {
        return res.status(500).json({ 
          error: 'Failed to push branch', 
          details: pushResult.error 
        });
      }
      
      // Now ensure we're on the base branch and up to date
      await workingTree.checkout(project.local_path, project.base_branch);
      await repository.pull(project.local_path, 'origin', project.base_branch);
      
      // Check for conflicts before attempting merge
      const conflicts = await analyzer.checkMergeConflicts(
        project.local_path,
        `origin/${task.branch}`
      );
      
      if (conflicts.hasConflicts) {
        return res.status(400).json({
          error: 'Cannot merge: conflicts detected',
          hasConflicts: true,
          conflicts: conflicts.conflicts
        });
      }
      
      // Merge the task branch
      const mergeResult = await repository.merge(
          project.local_path, 
          `origin/${task.branch}`,
          `Merge branch '${task.branch}' into ${project.base_branch}`
        );
        
        if (!mergeResult.success) {
          return res.status(500).json({ 
            error: 'Merge failed', 
            details: mergeResult.error 
          });
        }
        
        // Get the merge commit SHA using repository.execute
        const mergeCommitResult = await repository.execute('git rev-parse HEAD', project.local_path);
        const mergeCommitSha = mergeCommitResult.output.trim();
        
        // Push the merged changes to origin
        console.log(`Pushing merged changes in ${project.base_branch} to origin...`);
        const pushBaseResult = await repository.push(project.local_path, project.base_branch);
        if (!pushBaseResult.success) {
          // If push fails, we need to reset the merge
          await repository.execute('git reset --hard HEAD~1', project.local_path);
          return res.status(500).json({ 
            error: 'Failed to push merged changes to origin', 
            details: pushBaseResult.error 
          });
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
        
        // Trigger status update for the task
        await this.triggerStatusUpdate(taskId, req);
        
        // Emit task state changed event
        if (req.services?.EventEmitterService) {
          req.services.EventEmitterService.emit(TASK_EVENTS.STATE_CHANGED, { taskId, newState: 'merged', oldState: 'active' });
        }
        
        res.json({
          message: `Successfully merged ${task.branch} into ${project.base_branch}`,
          output: mergeResult.output,
          mergeCommit: mergeCommitSha
        });
      }
    } catch (error) {
      res.status(500).json({ error: error.message });
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