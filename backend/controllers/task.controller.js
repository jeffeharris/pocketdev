import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { GitService } from '../services/git.service.js';
import { WorktreeService } from '../services/worktree.service.js';

/**
 * Core task controller for CRUD operations
 * Git, PR, and Container operations are handled by separate controllers
 */
export class TaskController {
  constructor(models, projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), '../projects')) {
    this.models = models;
    this.projectsDir = projectsDir;
    this.gitService = new GitService();
    this.worktreeService = new WorktreeService();
  }

  /**
   * Trigger git status update after operations that change git state
   */
  async triggerStatusUpdate(taskId, req) {
    if (req.app.locals.gitStatusMonitor) {
      req.app.locals.gitStatusMonitor.checkTask(taskId).catch(err => 
        console.error(`Failed to update git status for task ${taskId}:`, err)
      );
    }
  }

  /**
   * Create a new task (worktree) within a project
   */
  async createTask(req, res) {
    const { projectId } = req.params;
    const { name, branch } = req.body;
    
    if (!name || !branch) {
      return res.status(400).json({ error: 'Task name and branch are required' });
    }
    
    try {
      const project = await this.models.projects.findById(projectId);
      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }
      
      const taskId = this.models.tasks.generateId();
      const worktreePath = path.join(this.projectsDir, `${project.id}-task-${taskId}`);
      
      // Create worktree using service
      await this.worktreeService.create(project.local_path, branch, worktreePath, project.base_branch);
      
      // Configure git credentials
      await this.gitService.configureCredentials(worktreePath);
      
      // Create task in database
      const task = await this.models.tasks.create(project.id, {
        id: taskId,
        name,
        branch,
        worktree_path: worktreePath
      });
      
      // Update project last accessed
      await this.models.projects.updateLastAccessed(project.id);
      
      // Create shelltender session for this task
      try {
        const { createTaskSession } = await import('../../shared/shelltender-client.js');
        await createTaskSession(taskId, worktreePath);
        
        // Connect session monitor to the new task
        const sessionMonitor = req.app.locals.wsAdapter;
        const aiMonitor = req.app.locals.aiMonitor;
        if (sessionMonitor && aiMonitor) {
          const sessionId = `task-${taskId}`;
          console.log('Connecting monitor to new task session:', sessionId);
          await sessionMonitor.connectToSession(sessionId);
          await aiMonitor.registerSessionPatterns(sessionId);
        }
      } catch (error) {
        console.warn('Failed to create shelltender session:', error.message);
      }
      
      res.json({ 
        success: true, 
        task: {
          ...task,
          claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(worktreePath)}`
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
    const aiMonitor = req.app.locals.aiMonitor;
    
    try {
      const tasks = await this.models.tasks.findByProjectId(projectId);
      
      // Get the project to know the base branch
      const project = await this.models.projects.findById(projectId);
      const baseBranch = `origin/${project.base_branch || 'main'}`;
      
      // Enrich tasks with git status and session state
      const tasksWithFullStatus = await Promise.all(tasks.map(async (task) => {
        let gitStatus = null;
        
        if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
          try {
            gitStatus = await this.gitService.getBranchStatus(
              task.worktree_path, 
              task.branch, 
              baseBranch
            );
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
          const taskWithSession = await this.models.tasks.findByIdWithSessionState(task.id);
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
      const task = await this.models.tasks.findByIdWithSessionState(taskId);
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
          gitStatus = await this.gitService.getBranchStatus(
            task.worktree_path, 
            task.branch, 
            baseBranch
          );
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
      
      // Get terminal sessions for this task
      const terminals = await this.models.sessions.findAllActiveByTaskId(taskId);
      
      // Get git status for this task's worktree
      let gitInfo = null;
      let mergeInfo = null;
      
      if (fsSync.existsSync(task.worktree_path)) {
        const status = await this.gitService.getStatus(task.worktree_path);
        const diff = await this.gitService.getDiff(task.worktree_path, '--stat');
        
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
          mergeInfo = await this._checkMergeStatus(task, project);
        }
      }
      
      // Check Shelltender status for each terminal
      const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
      const terminalsWithStatus = await Promise.all(
        terminals.map(async (terminal) => {
          let shelltenderStatus = 'not-found';
          
          try {
            const sessionId = terminal.session_id || terminal.shelltender_session_id;
            if (sessionId) {
              const response = await fetch(`${shelltenderUrl}/api/sessions/${sessionId}`);
              if (response.ok) {
                const session = await response.json();
                shelltenderStatus = session.status === 'active' ? 'active' : 'inactive';
              }
            }
          } catch (error) {
            console.error(`Failed to check Shelltender status for session ${terminal.id}:`, error.message);
          }
          
          return {
            sessionId: terminal.session_id || terminal.shelltender_session_id,
            dbSessionId: terminal.id,
            shelltenderSessionId: terminal.session_id || terminal.shelltender_session_id,
            tabName: terminal.tab_name,
            tabOrder: terminal.tab_order,
            aiState: terminal.ai_state,
            aiAgent: terminal.ai_agent,
            shelltenderStatus
          };
        })
      );
      
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
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Verify task belongs to project
      if (task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found in this project' });
      }
      
      // Build update object with only provided fields
      const updates = {};
      if (name !== undefined) updates.name = name;
      if (description !== undefined) updates.description = description;
      
      // Update the task
      const updatedTask = await this.models.tasks.update(taskId, updates);
      
      res.json(updatedTask);
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
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Check for uncommitted changes
      const status = await this.gitService.getStatus(task.worktree_path);
      const hasUncommittedChanges = status.output.trim().length > 0;
      
      // Check for unpushed commits
      let hasUnpushedCommits = false;
      try {
        const unpushed = await this.gitService.getUnpushedCommits(task.worktree_path, task.branch);
        hasUnpushedCommits = unpushed.output.trim().length > 0;
      } catch (e) {
        hasUnpushedCommits = true;
      }
      
      // Get diff summary if changes exist
      let diffSummary = '';
      if (hasUncommittedChanges) {
        const diff = await this.gitService.getDiff(task.worktree_path, '--stat');
        diffSummary = diff.output;
      }
      
      res.json({
        canDelete: !hasUncommittedChanges && !hasUnpushedCommits,
        hasUncommittedChanges,
        hasUnpushedCommits,
        diffSummary,
        warnings: []
          .concat(hasUncommittedChanges ? ['Task has uncommitted changes that will be lost'] : [])
          .concat(hasUnpushedCommits ? ['Task has commits that have not been pushed to remote'] : [])
      });
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
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      
      // Clean up all Shelltender sessions for this task
      await this.cleanupTaskSessions(taskId);
      
      if (softDelete && !force) {
        // Soft delete - archive the task
        await this.models.tasks.archive(task.id);
        
        // Move worktree to archived location
        const archivePath = path.join(this.projectsDir, '.archived', `${project.id}-task-${task.id}-${Date.now()}`);
        await fs.mkdir(path.dirname(archivePath), { recursive: true });
        await this.worktreeService.move(task.worktree_path, archivePath);
        
        res.json({ 
          success: true, 
          softDeleted: true,
          message: 'Task archived. Can be restored within 30 days.' 
        });
      } else {
        // Hard delete
        await this.worktreeService.remove(project.local_path, task.worktree_path);
        await this.models.tasks.delete(task.id);
        
        res.json({ success: true, hardDeleted: true });
      }
      
      await this.models.projects.updateLastAccessed(project.id);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
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
      const statusResult = await this.gitService.getStatus(task.worktree_path);
      if (statusResult.output.trim()) {
        return res.status(400).json({ 
          error: 'Cannot update: You have uncommitted changes',
          hasUncommitted: true,
          changes: statusResult.output
        });
      }
      
      if (withClaude) {
        // Create a special merge task that uses the same worktree
        const operation = method === 'rebase' ? 'rebase' : 'merge';
        const mergeTaskName = `${operation} ${project.base_branch} into ${task.name}`;
        const prompt = `Help me ${operation} the branch '${project.base_branch}' into this task branch '${task.branch}'. ` +
          `IMPORTANT: If there are conflicts, show me each conflicted section using git diff before resolving. ` +
          `For each conflict, explain what would be lost by choosing either version, then suggest a resolution. ` +
          `Start by checking the current status and then perform the ${operation}.`;
        
        // Create a temporary merge task in the database
        const mergeTaskId = this.models.tasks.generateId();
        const mergeTask = await this.models.tasks.create(project.id, {
          id: mergeTaskId,
          name: mergeTaskName,
          branch: task.branch,
          worktree_path: task.worktree_path
        });
        
        // Update metadata to mark this as a merge task
        await this.models.tasks.update(mergeTaskId, {
          metadata: {
            isMergeTask: true,
            parentTaskId: task.id,
            operation: operation
          }
        });
        
        // Write prompt to a file in the worktree
        const promptFile = path.join(task.worktree_path, '.claude-prompt');
        await fs.writeFile(promptFile, prompt);
        
        // Return the merge task info so UI can open it
        res.json({ 
          success: true,
          claudeAssisted: true,
          mergeTask: {
            id: mergeTask.id,
            name: mergeTask.name,
            claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(task.worktree_path)}`
          },
          message: `Created merge task with Claude assistance`
        });
      } else {
        // Perform update directly
        let result;
        if (method === 'rebase') {
          result = await this.gitService.rebase(task.worktree_path, `origin/${project.base_branch}`);
        } else {
          result = await this.gitService.merge(task.worktree_path, `origin/${project.base_branch}`);
        }
        
        await this.models.projects.updateLastAccessed(project.id);
        
        // After rebase, check if branches became identical
        if (result.success && method === 'rebase' && task.status === 'merged') {
          const diffResult = await this.gitService.getDiff(task.worktree_path, `${project.base_branch}..HEAD --name-only`);
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
      }
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
      
      // Check for conflicts using git service
      const conflicts = await this.gitService.checkMergeConflicts(
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
    const { withClaude = false } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      
      if (withClaude) {
        // Create a merge task for Claude assistance
        const mergeTaskName = `merge ${task.branch} into ${project.base_branch}`;
        const mergeTaskId = this.models.tasks.generateId();
        
        // Create a new branch for the merge
        const mergeBranch = `merge/${task.branch}-into-${project.base_branch}`.replace(/[^a-zA-Z0-9-]/g, '-');
        const mergeWorktreePath = path.join(this.projectsDir, `${project.id}-merge-${mergeTaskId}`);
        
        // Pull latest base branch changes
        await this.gitService.checkout(project.local_path, project.base_branch);
        await this.gitService.pull(project.local_path, 'origin', project.base_branch);
        
        // Create worktree from base branch
        await this.worktreeService.create(project.local_path, mergeBranch, mergeWorktreePath, project.base_branch);
        
        // Attempt merge in the new worktree
        const mergeResult = await this.gitService.merge(mergeWorktreePath, `origin/${task.branch}`);
        
        // Create merge task in database
        const mergeTask = await this.models.tasks.create(project.id, {
          id: mergeTaskId,
          name: mergeTaskName,
          branch: mergeBranch,
          worktree_path: mergeWorktreePath
        });
        
        // Add metadata to indicate this is a merge task
        await this.models.tasks.update(mergeTaskId, {
          metadata: {
            isMergeTask: true,
            sourceBranch: task.branch,
            targetBranch: project.base_branch,
            originalTaskId: task.id
          }
        });
        
        // Write instructions for Claude
        const promptFile = path.join(mergeWorktreePath, '.claude-prompt');
        const prompt = `Help me complete the merge of branch '${task.branch}' into '${project.base_branch}'.

There are merge conflicts that need to be resolved. Please:
1. Check the current git status to see conflicting files
2. For EACH conflict, use 'git diff' to show me the conflicting sections
3. Explain what each version contains and what would be lost by choosing either side
4. Suggest how to resolve the conflict and wait for my approval
5. Only after showing me all conflicts, proceed with resolution
6. Make sure the code still works after merging
7. Commit the merge with an appropriate message

IMPORTANT: Never use 'git checkout --theirs' or '--ours' without first showing what would be removed.

Original task: ${task.name}`;
        
        await fs.writeFile(promptFile, prompt);
        
        res.json({
          success: true,
          mergeTask: {
            id: mergeTask.id,
            name: mergeTask.name,
            branch: mergeTask.branch,
            claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(mergeWorktreePath)}`
          }
        });
        
      } else {
        // Direct merge without Claude
        // First ensure the task branch is pushed to origin
        const pushResult = await this.gitService.push(task.worktree_path, task.branch, { setUpstream: true });
        if (!pushResult.success && !pushResult.error?.includes('Everything up-to-date')) {
          return res.status(500).json({ 
            error: 'Failed to push branch', 
            details: pushResult.error 
          });
        }
        
        // Now ensure we're on the base branch and up to date
        await this.gitService.checkout(project.local_path, project.base_branch);
        await this.gitService.pull(project.local_path, 'origin', project.base_branch);
        
        // Merge the task branch
        const mergeResult = await this.gitService.merge(
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
        
        // Get the merge commit SHA
        const mergeCommitResult = await this.gitService.getHeadCommit(project.local_path);
        const mergeCommitSha = mergeCommitResult.output.trim();
        
        // Push the merged changes to origin
        console.log(`Pushing merged changes in ${project.base_branch} to origin...`);
        const pushBaseResult = await this.gitService.push(project.local_path, project.base_branch);
        if (!pushBaseResult.success) {
          // If push fails, we need to reset the merge
          await this.gitService.command(project.local_path, `git reset --hard HEAD~1`);
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
        
        // Send task state change via WebSocket
        if (req.app.locals.websocketService) {
          req.app.locals.websocketService.sendTaskStateChange(taskId, 'merged');
        }
        
        res.json({
          success: true,
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
  async _checkMergeStatus(task, project) {
    try {
      // Get current HEAD
      const headResult = await this.gitService.getHeadCommit(task.worktree_path);
      const currentHead = headResult.output.trim();
      
      // Check if we have commits since merge
      let hasCommitsSinceMerge = false;
      if (currentHead !== task.merge_commit_sha) {
        // Count commits since merge
        const countResult = await this.gitService.command(task.worktree_path, 
          `git rev-list ${task.merge_commit_sha}..HEAD --count 2>/dev/null || echo 0`);
        const commitsSinceMerge = parseInt(countResult.output.trim()) || 0;
        
        // Check if there are actual differences with the base branch
        if (project.base_branch) {
          const diffResult = await this.gitService.getDiff(task.worktree_path,
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
    try {
      // Get all active sessions for this task
      const sessions = await this.models.sessions.findAllActiveByTaskId(taskId);
      
      if (sessions.length === 0) {
        console.log(`No active sessions found for task ${taskId}`);
        return;
      }
      
      const shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
      
      // Terminate each Shelltender session
      for (const session of sessions) {
        if (session.shelltender_session_id) {
          try {
            console.log(`Terminating Shelltender session: ${session.shelltender_session_id}`);
            const response = await fetch(`${shelltenderUrl}/api/sessions/${session.shelltender_session_id}`, {
              method: 'DELETE'
            });
            
            if (!response.ok) {
              console.error(`Failed to terminate session ${session.shelltender_session_id}:`, response.statusText);
            }
          } catch (error) {
            console.error(`Error terminating session ${session.shelltender_session_id}:`, error.message);
            // Continue with other sessions even if one fails
          }
        }
      }
      
      console.log(`Cleaned up ${sessions.length} sessions for task ${taskId}`);
    } catch (error) {
      console.error(`Error cleaning up sessions for task ${taskId}:`, error);
      // Don't throw - we don't want session cleanup failure to prevent task deletion
    }
  }
}