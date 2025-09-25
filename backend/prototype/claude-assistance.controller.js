/**
 * Claude Assistance Prototype Controller
 * 
 * EXPERIMENTAL: This controller contains the Claude-assisted merge conflict resolution
 * functionality that was extracted from task.controller.js during the Level 1 refactoring.
 * 
 * The idea is to create temporary "merge tasks" when conflicts are detected, write
 * instructions to a .claude-prompt file, and provide a special URL (port 7681) that
 * would open Claude with the context to help resolve conflicts.
 * 
 * STATUS: Not connected to frontend, port 7681 service doesn't exist yet.
 * 
 * PRESERVED: 2025-09-12 during controller refactoring
 */

import path from 'path';
import fs from 'fs/promises';

export class ClaudeAssistanceController {
  constructor(models, projectsDir) {
    this.models = models;
    this.projectsDir = projectsDir || process.env.PROJECTS_DIR || path.join(process.cwd(), '../projects');
    this.worktreeService = null; // Would need to be injected
  }

  generateTaskId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${timestamp}-${random}`;
  }

  /**
   * Create a Claude-assisted update task when merge conflicts are detected
   * This was part of updateTask in task.controller.js
   */
  async createClaudeUpdateTask(req, res) {
    const { projectId, taskId } = req.params;
    const { method = 'merge' } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(projectId);
      
      // Create a special merge task that uses the same worktree
      const operation = method === 'rebase' ? 'rebase' : 'merge';
      const mergeTaskName = `${operation} ${project.base_branch} into ${task.name}`;
      const prompt = `Help me ${operation} the branch '${project.base_branch}' into this task branch '${task.branch}'. ` +
        `IMPORTANT: If there are conflicts, show me each conflicted section using git diff before resolving. ` +
        `For each conflict, explain what would be lost by choosing either version, then suggest a resolution. ` +
        `Start by checking the current status and then perform the ${operation}.`;
      
      // Create a temporary merge task in the database
      const mergeTaskId = this.generateTaskId();
      const mergeTask = await this.models.tasks.create({
        project_id: project.id,
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
        claudeAssisted: true,
        mergeTask: {
          id: mergeTask.id,
          name: mergeTask.name,
          claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(task.worktree_path)}`
        },
        message: `Created merge task with Claude assistance`
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Create a Claude-assisted merge task for merging to base branch
   * This was part of mergeToBase in task.controller.js
   */
  async createClaudeMergeTask(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(task.project_id);
      
      // Would need these services injected
      const repository = null; // new GitRepository(req.githubToken);
      const workingTree = null; // new GitWorkingTree(req.githubToken);
      
      // Create a merge task for Claude assistance
      const mergeTaskName = `merge ${task.branch} into ${project.base_branch}`;
      const mergeTaskId = this.generateTaskId();
      
      // Create a new branch for the merge
      const mergeBranch = `merge/${task.branch}-into-${project.base_branch}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const mergeWorktreePath = path.join(this.projectsDir, `${project.id}-merge-${mergeTaskId}`);
      
      // Pull latest base branch changes
      await workingTree.checkout(project.local_path, project.base_branch);
      await repository.pull(project.local_path, 'origin', project.base_branch);
      
      // Create worktree from base branch
      await this.worktreeService.create(project.local_path, mergeBranch, mergeWorktreePath, project.base_branch);
      
      // Attempt merge in the new worktree
      const mergeResult = await repository.merge(mergeWorktreePath, `origin/${task.branch}`);
      
      // Create merge task in database
      const mergeTask = await this.models.tasks.create({
        project_id: project.id,
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
        mergeTask: {
          id: mergeTask.id,
          name: mergeTask.name,
          branch: mergeTask.branch,
          claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(mergeWorktreePath)}`
        }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * In the task detail response, we used to include a claudeUrl
   */
  getClaudeUrl(hostname, worktreePath) {
    return `http://${hostname}:7681/?arg=${encodeURIComponent(worktreePath)}`;
  }
}

/* 
NOTES FOR FUTURE IMPLEMENTATION:

1. Port 7681 service needs to be created - possibly a WebSocket server that:
   - Accepts the worktree path as a parameter
   - Reads the .claude-prompt file
   - Opens a terminal session in that worktree
   - Injects the prompt to Claude

2. Frontend needs UI to trigger this:
   - "Update with Claude" button when conflicts detected
   - "Merge with Claude" option in merge dialog
   - Display the Claude URL or auto-open it

3. Services need to be properly injected:
   - GitRepository
   - GitWorkingTree
   - WorktreeService

4. Consider cleaning up temporary merge tasks after resolution

5. The isMergeTask metadata could be used to:
   - Hide these tasks from the main task list
   - Auto-cleanup after successful merge
   - Show special UI for merge tasks
*/