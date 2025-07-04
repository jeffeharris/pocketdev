import { GitService } from '../services/git.service.js';

/**
 * Controller for git-related task operations
 */
export class TaskGitController {
  constructor(models) {
    this.models = models;
    this.gitService = new GitService();
  }

  async getGitConfig() {
    // Get git config from settings
    const gitUserName = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    return {
      name: gitUserName?.value || 'PocketDev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
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

      // Get detailed status including staged/unstaged counts
      const detailedStatus = await this.gitService.getDetailedStatus(task.worktree_path);

      res.json({
        clean: cleanStatus,
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
        filesChanged,
        staged: detailedStatus.staged,
        unstaged: detailedStatus.unstaged,
        untracked: detailedStatus.untracked,
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
   * Get full diff for all changes in a task
   */
  async getTaskDiff(req, res) {
    const { projectId, taskId } = req.params;
    const { compareWith = 'working' } = req.query; // 'working' or 'base'
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      const project = await this.models.projects.findById(projectId);
      const files = [];

      if (compareWith === 'base') {
        // Compare task branch with base branch
        // First get all file stats in one command for performance
        const diffStatsResult = await this.gitService.command(task.worktree_path, 
          `git diff --numstat origin/${project.base_branch}...HEAD`);
        
        const diffStatusResult = await this.gitService.command(task.worktree_path, 
          `git diff --name-status origin/${project.base_branch}...HEAD`);
        
        // Parse stats into a map
        const statsMap = new Map();
        const statsLines = diffStatsResult.output.split('\n').filter(line => line.trim());
        for (const line of statsLines) {
          const [additions, deletions, ...pathParts] = line.split('\t');
          const filePath = pathParts.join('\t');
          if (filePath) {
            statsMap.set(filePath, {
              additions: parseInt(additions) || 0,
              deletions: parseInt(deletions) || 0
            });
          }
        }
        
        // Parse status
        const statusLines = diffStatusResult.output.split('\n').filter(line => line.trim());
        
        for (const line of statusLines) {
          const [status, ...pathParts] = line.trim().split(/\s+/);
          const filePath = pathParts.join(' ');
          
          if (!filePath) continue;
          
          let type = 'modified';
          if (status.includes('A')) type = 'added';
          else if (status.includes('D')) type = 'deleted';
          else if (status.includes('M')) type = 'modified';
          else if (status.includes('R')) type = 'renamed';
          
          const stats = statsMap.get(filePath) || { additions: 0, deletions: 0 };
          
          // DON'T load the full diff here - let frontend load it on demand
          files.push({
            path: filePath,
            type,
            additions: stats.additions,
            deletions: stats.deletions
            // No diff property - will be loaded on demand
          });
        }
      } else {
        // Compare working directory (default behavior)
        const statusResult = await this.gitService.getStatus(task.worktree_path);
        const lines = statusResult.output.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
          const [status, ...pathParts] = line.trim().split(/\s+/);
          const filePath = pathParts.join(' ');
          
          if (!filePath) continue;
          
          let type = 'modified';
          if (status.includes('A') || status === '??') type = 'added';
          else if (status.includes('D')) type = 'deleted';
          else if (status.includes('M')) type = 'modified';
          else if (status.includes('R')) type = 'renamed';
          
          // Get diff for this file
          let diff = '';
          let additions = 0;
          let deletions = 0;
          
          try {
            // For untracked files, show as new file
            if (status === '??') {
              const content = await this.gitService.command(task.worktree_path, `cat "${filePath}"`);
              const lines = content.output.split('\n');
              diff = `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
              lines.forEach(line => {
                diff += `+${line}\n`;
              });
              additions = lines.length;
            } else {
              // Get standard diff
              const diffResult = await this.gitService.getDiff(task.worktree_path, `-- "${filePath}"`);
              diff = diffResult.output;
              
              // Count additions/deletions
              const diffLines = diff.split('\n');
              diffLines.forEach(line => {
                if (line.startsWith('+') && !line.startsWith('+++')) additions++;
                else if (line.startsWith('-') && !line.startsWith('---')) deletions++;
              });
            }
          } catch (error) {
            console.warn('Could not get diff for:', filePath, error);
          }
          
          files.push({
            path: filePath,
            type,
            additions,
            deletions,
            diff
          });
        }
      }
      
      // Check if working directory is clean to inform default comparison mode
      const statusResult = await this.gitService.getStatus(task.worktree_path);
      const hasWorkingChanges = statusResult.output.trim().length > 0;
      
      res.json({ 
        files,
        compareWith,
        hasWorkingChanges
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get diff for a specific file
   */
  async getFileDiff(req, res) {
    const { projectId, taskId, file } = req.params;
    const { compareWith = 'working' } = req.query; // 'working' or 'base'
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      let diffResult;
      
      if (compareWith === 'base') {
        const project = await this.models.projects.findById(projectId);
        diffResult = await this.gitService.command(task.worktree_path,
          `git diff origin/${project.base_branch}...HEAD -- "${file}"`);
      } else {
        diffResult = await this.gitService.getDiff(task.worktree_path, `-- "${file}"`);
      }
      
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
   * Get commit history for a task
   */
  async getCommitHistory(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get commit history
      const logResult = await this.gitService.log(
        task.worktree_path, 
        '--pretty=format:%H|%s|%an|%ar|%P --max-count=50'
      );
      
      const commits = logResult.output.trim().split('\n').map(line => {
        const [hash, message, author, date, parents] = line.split('|');
        // Check if this is a merge commit (has more than one parent)
        const isMerge = parents && parents.trim().split(' ').length > 1;
        
        return {
          hash,
          message,
          author,
          date,
          isMerge
        };
      });
      
      res.json(commits);
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

  async gitOperation(req, res) {
    const { projectId, taskId } = req.params;
    const { operation, message, files } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      await this.models.projects.updateLastAccessed(projectId);
      
      // Get git config for this operation
      const gitConfig = await this.getGitConfig();
      const gitService = new GitService(this.gitService.githubToken, gitConfig);
      
      let result;
      
      // Operations that should trigger status update
      const statusUpdateOperations = ['add', 'commit', 'push', 'pull', 'merge', 'rebase', 'reset', 'checkout'];
      
      switch (operation) {
        case 'status':
          result = await gitService.getStatus(task.worktree_path);
          break;
          
        case 'diff':
          result = await gitService.getDiff(task.worktree_path);
          break;
          
        case 'add':
          const filesToAdd = files || '.';
          result = await gitService.add(task.worktree_path, filesToAdd);
          break;
          
        case 'commit':
          if (!message) {
            return res.status(400).json({ error: 'Commit message required' });
          }
          result = await gitService.commit(task.worktree_path, message);
          
          // If task was merged, mark that it has commits since merge
          if (result.success && task.merge_commit_sha) {
            await this.models.tasks.update(task.id, {
              has_commits_since_merge: true
            });
          }
          break;
          
        case 'push':
          result = await gitService.push(task.worktree_path, task.branch);
          break;
          
        case 'pr':
          const prTitle = message || `Updates from task: ${task.name}`;
          const project = await this.models.projects.findById(task.project_id);
          result = await gitService.createPullRequest(
            task.worktree_path,
            prTitle,
            `Created by Claude Code - Task: ${task.name}`,
            project.base_branch
          );
          break;
          
        case 'log':
          const logArgs = req.body.args || '--oneline -n 10';
          result = await gitService.log(task.worktree_path, logArgs);
          break;
          
        case 'reset-uncommitted':
          // Reset all uncommitted changes
          result = await gitService.reset(task.worktree_path, '--hard HEAD');
          break;
          
        case 'reset-to-commit':
          const commitHash = req.body.commit;
          if (!commitHash) {
            return res.status(400).json({ error: 'Commit hash required for reset' });
          }
          // Reset to specific commit
          result = await gitService.reset(task.worktree_path, `--hard ${commitHash}`);
          break;
          
        default:
          return res.status(400).json({ error: 'Invalid operation' });
      }
      
      // Trigger status update for operations that change git state
      if (result.success && statusUpdateOperations.includes(operation)) {
        await this.triggerStatusUpdate(taskId, req);
      }
      
      res.json({ success: result.success, output: result.output, error: result.error });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
}