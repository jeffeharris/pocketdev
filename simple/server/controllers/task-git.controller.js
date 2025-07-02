import { GitService } from '../services/git.service.js';

/**
 * Controller for git-related task operations
 */
export class TaskGitController {
  constructor(models) {
    this.models = models;
    this.gitService = new GitService();
  }

  /**
   * Get detailed git status
   */
  async getGitStatus(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await this.models.projects.findById(projectId);
      
      // Get detailed git status
      const statusResult = await this.gitService.getStatus(task.worktree_path);
      const cleanStatus = statusResult.output.trim().length === 0;
      
      // Check ahead/behind status
      let aheadBehind = { ahead: 0, behind: 0 };
      try {
        const aheadResult = await this.gitService.command(task.worktree_path, 
          `git rev-list --count origin/${project.base_branch}..HEAD`);
        const behindResult = await this.gitService.command(task.worktree_path,
          `git rev-list --count HEAD..origin/${project.base_branch}`);
        
        aheadBehind.ahead = parseInt(aheadResult.output.trim()) || 0;
        aheadBehind.behind = parseInt(behindResult.output.trim()) || 0;
      } catch (error) {
        console.warn('Could not get ahead/behind status:', error);
      }

      // Count changed files
      let filesChanged = 0;
      if (!cleanStatus) {
        filesChanged = statusResult.output.split('\n').filter(line => line.trim()).length;
      }

      res.json({
        clean: cleanStatus,
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
        filesChanged,
        rawStatus: statusResult.output
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get changed files with diff details
   */
  async getChangedFiles(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      // Get list of changed files
      const statusResult = await this.gitService.getStatus(task.worktree_path);
      const changedFiles = [];
      
      // Parse git status output
      const lines = statusResult.output.split('\n').filter(line => line.trim());
      for (const line of lines) {
        const [status, ...pathParts] = line.trim().split(/\s+/);
        const filePath = pathParts.join(' ');
        
        if (!filePath) continue;
        
        // Get diff stats for the file
        let additions = 0;
        let deletions = 0;
        let type = 'modified';
        
        if (status.includes('A')) type = 'added';
        else if (status.includes('D')) type = 'deleted';
        else if (status.includes('M')) type = 'modified';
        else if (status.includes('R')) type = 'renamed';
        
        // Get detailed diff stats
        try {
          const diffResult = await this.gitService.command(task.worktree_path,
            `git diff --numstat -- "${filePath}"`);
          const stats = diffResult.output.trim().split('\t');
          if (stats.length >= 2) {
            additions = parseInt(stats[0]) || 0;
            deletions = parseInt(stats[1]) || 0;
          }
        } catch (error) {
          console.warn('Could not get diff stats for:', filePath);
        }
        
        changedFiles.push({
          path: filePath,
          type,
          additions,
          deletions
        });
      }
      
      // Also get committed but unpushed changes
      try {
        const unpushedResult = await this.gitService.command(task.worktree_path,
          `git diff --name-status origin/${task.branch}..HEAD`);
        const unpushedLines = unpushedResult.output.split('\n').filter(line => line.trim());
        
        for (const line of unpushedLines) {
          const [status, ...pathParts] = line.trim().split(/\s+/);
          const filePath = pathParts.join(' ');
          
          if (!filePath) continue;
          
          // Check if already in changed files
          if (!changedFiles.some(f => f.path === filePath)) {
            let type = 'modified';
            if (status === 'A') type = 'added';
            else if (status === 'D') type = 'deleted';
            else if (status === 'M') type = 'modified';
            
            changedFiles.push({
              path: filePath,
              type,
              additions: 0,
              deletions: 0,
              committed: true
            });
          }
        }
      } catch (error) {
        console.warn('Could not get unpushed changes:', error);
      }
      
      res.json(changedFiles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get diff for a specific file
   */
  async getFileDiff(req, res) {
    const { projectId, taskId, file } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const diffResult = await this.gitService.getDiff(task.worktree_path, `-- "${file}"`);
      
      res.json({
        path: file,
        diff: diffResult.output,
        hasDiff: diffResult.output.trim().length > 0
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Check for conflicts (simplified endpoint)
   */
  async checkConflicts(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await this.models.projects.findById(projectId);
      const conflicts = await this.gitService.checkMergeConflicts(
        task.worktree_path, 
        `origin/${project.base_branch}`
      );
      
      res.json({
        hasConflicts: conflicts.hasConflicts,
        conflicts: conflicts.conflicts || []
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Perform git operations on a task
   */
  async gitOperation(req, res) {
    const { projectId, taskId } = req.params;
    const { operation, message, files } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      await this.models.projects.updateLastAccessed(projectId);
      
      let result;
      
      switch (operation) {
        case 'status':
          result = await this.gitService.getStatus(task.worktree_path);
          break;
          
        case 'diff':
          result = await this.gitService.getDiff(task.worktree_path);
          break;
          
        case 'add':
          const filesToAdd = files || '.';
          result = await this.gitService.add(task.worktree_path, filesToAdd);
          break;
          
        case 'commit':
          if (!message) {
            return res.status(400).json({ error: 'Commit message required' });
          }
          result = await this.gitService.commit(task.worktree_path, message);
          
          // If task was merged, mark that it has commits since merge
          if (result.success && task.merge_commit_sha) {
            await this.models.tasks.update(task.id, {
              has_commits_since_merge: true
            });
          }
          
          // Trigger git status update after commit
          if (result.success && req.app.locals.gitStatusMonitor) {
            req.app.locals.gitStatusMonitor.checkTask(taskId).catch(err => 
              console.error('Failed to update git status after commit:', err)
            );
          }
          break;
          
        case 'push':
          result = await this.gitService.push(task.worktree_path, task.branch);
          
          // Trigger git status update after push
          if (result.success && req.app.locals.gitStatusMonitor) {
            req.app.locals.gitStatusMonitor.checkTask(taskId).catch(err => 
              console.error('Failed to update git status after push:', err)
            );
          }
          break;
          
        case 'pr':
          const prTitle = message || `Updates from task: ${task.name}`;
          const project = await this.models.projects.findById(task.project_id);
          result = await this.gitService.createPullRequest(
            task.worktree_path,
            prTitle,
            `Created by Claude Code - Task: ${task.name}`,
            project.base_branch
          );
          break;
          
        case 'log':
          const logArgs = req.body.args || '--oneline -n 10';
          result = await this.gitService.log(task.worktree_path, logArgs);
          break;
          
        default:
          return res.status(400).json({ error: 'Invalid operation' });
      }
      
      res.json({ success: result.success, output: result.output, error: result.error });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}