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
      
      // Debug logging for merged tasks with changes
      if (task.status === 'merged' || task.merged_at) {
        console.log(`[GitStatus] Checking merged task ${taskId} on branch ${task.branch}`);
        const statusResult = await this.gitService.command(task.worktree_path, 'git status --porcelain');
        if (statusResult.output.trim()) {
          console.log(`[GitStatus] Merged task has changes:`, statusResult.output);
          const branchResult = await this.gitService.command(task.worktree_path, 'git branch --show-current');
          console.log(`[GitStatus] Task worktree is on branch:`, branchResult.output.trim());
        }
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

      // Check if branch has remote tracking
      let hasRemoteTracking = false;
      try {
        const remoteCheckResult = await this.gitService.command(
          task.worktree_path,
          `git rev-parse --verify origin/${task.branch} 2>/dev/null`
        );
        hasRemoteTracking = remoteCheckResult.success;
      } catch (error) {
        // No remote tracking branch
        hasRemoteTracking = false;
      }

      res.json({
        clean: cleanStatus,
        ahead: aheadBehind.ahead,
        behind: aheadBehind.behind,
        filesChanged,
        staged: detailedStatus.staged,
        unstaged: detailedStatus.unstaged,
        untracked: detailedStatus.untracked,
        hasRemoteTracking,
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
    const { compareWith = 'working' } = req.query;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(projectId);
      
      // Use comprehensive diff method to get proper line counts
      const compareTarget = compareWith === 'base' ? `origin/${project.base_branch}` : 'working';
      const diffResult = await this.gitService.getComprehensiveDiff(task.worktree_path, compareTarget);
      
      // Convert Map to array
      const changedFiles = [];
      for (const [path, fileInfo] of diffResult.files) {
        changedFiles.push({
          path: fileInfo.path,
          type: fileInfo.type,
          additions: fileInfo.additions,
          deletions: fileInfo.deletions,
          staged: fileInfo.staged || false,
          unstaged: fileInfo.unstaged || false,
          untracked: fileInfo.untracked || false,
          committed: fileInfo.diffType === 'committed'
        });
      }
      
      res.json(changedFiles);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get all changes including working tree and committed changes not in base branch
   */
  async getAllChanges(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }
      
      const project = await this.models.projects.findById(projectId);
      
      // Get all changes using the new git service method
      const allChanges = await this.gitService.getAllChanges(
        task.worktree_path,
        `origin/${project.base_branch}`
      );
      
      // Get unpushed commits info
      const unpushedInfo = await this.gitService.getUnpushedCommitsInfo(
        task.worktree_path,
        task.branch
      );
      
      // Format response with categorized files
      const response = {
        files: allChanges.files.map(file => ({
          path: file.path,
          type: file.type,
          additions: file.additions,
          deletions: file.deletions,
          category: file.category,
          status: file.status,
          staged: file.staged || false,
          unstaged: file.unstaged || false,
          untracked: file.untracked || false,
          committed: file.category === 'committed'
        })),
        summary: {
          ...allChanges.summary,
          unpushedCommits: unpushedInfo.count
        },
        unpushedCommits: unpushedInfo.commits
      };
      
      res.json(response);
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
      
      // Use unified diff method
      const compareTarget = compareWith === 'base' ? `origin/${project.base_branch}` : 'working';
      const diffResult = await this.gitService.getComprehensiveDiff(task.worktree_path, compareTarget);
      
      // Convert Map to array and include diffs for working directory comparisons
      const files = [];
      for (const [path, fileInfo] of diffResult.files) {
        const file = {
          path: fileInfo.path,
          type: fileInfo.type,
          additions: fileInfo.additions,
          deletions: fileInfo.deletions
        };
        
        // For working directory comparisons, include diff content
        // For base comparisons, let frontend load on demand for performance
        if (compareWith === 'working') {
          file.diff = await this.gitService.getFileDiffContent(
            task.worktree_path, 
            fileInfo.path, 
            compareTarget, 
            fileInfo
          );
        }
        
        files.push(file);
      }
      
      // Check if working directory is clean
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

      const project = await this.models.projects.findById(projectId);
      
      // Use unified diff method
      const compareTarget = compareWith === 'base' ? `origin/${project.base_branch}` : 'working';
      
      console.log(`[getFileDiff] Getting diff for file: ${file}, compareWith: ${compareWith}, compareTarget: ${compareTarget}`);
      
      // Get file info first to know its state
      const diffResult = await this.gitService.getComprehensiveDiff(task.worktree_path, compareTarget);
      const fileInfo = diffResult.files.get(file);
      
      console.log(`[getFileDiff] File info:`, fileInfo);
      
      // Get the diff content
      const diff = await this.gitService.getFileDiffContent(
        task.worktree_path, 
        file, 
        compareTarget, 
        fileInfo
      );
      
      console.log(`[getFileDiff] Got diff length: ${diff?.length || 0}`);
      
      res.json({
        path: file,
        diff: diff,
        hasDiff: diff.trim().length > 0
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
      const statusUpdateOperations = ['add', 'unstage', 'commit', 'push', 'pull', 'merge', 'rebase', 'reset', 'checkout'];
      
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
          
        case 'unstage':
          if (!files) {
            return res.status(400).json({ error: 'File path required for unstage operation' });
          }
          result = await gitService.unstageFile(task.worktree_path, files);
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
          console.log(`[gitOperation] Push operation for task ${taskId} on branch ${task.branch}`);
          
          // First, let's check the actual branch status
          const statusCheck = await gitService.command(
            task.worktree_path,
            `git status -sb`
          );
          console.log(`[gitOperation] Current branch status: ${statusCheck.output}`);
          
          // Check what commits are ahead
          const aheadCheck = await gitService.command(
            task.worktree_path,
            `git log origin/${task.branch}..HEAD --oneline`
          );
          console.log(`[gitOperation] Commits ahead of origin: ${aheadCheck.output || 'none'}`);
          
          // Check if branch has remote tracking
          let hasRemoteTracking = false;
          try {
            const remoteCheckResult = await gitService.command(
              task.worktree_path,
              `git rev-parse --verify origin/${task.branch} 2>/dev/null`
            );
            hasRemoteTracking = remoteCheckResult.success;
            console.log(`[gitOperation] Remote tracking check: ${hasRemoteTracking}`);
          } catch (error) {
            hasRemoteTracking = false;
            console.log(`[gitOperation] Remote tracking check error:`, error.message);
          }
          
          // Use -u flag if no remote tracking exists
          console.log(`[gitOperation] Pushing branch '${task.branch}' with setUpstream: ${!hasRemoteTracking}`);
          console.log(`[gitOperation] Task worktree path: ${task.worktree_path}`);
          result = await gitService.push(task.worktree_path, task.branch, {
            setUpstream: !hasRemoteTracking
          });
          console.log(`[gitOperation] Push result:`, result);
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