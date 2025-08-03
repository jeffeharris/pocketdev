import { GitService } from './services/git.service.js';
import fsSync from 'fs';

/**
 * GitStatusMonitor - Periodically checks git status for active tasks
 * and broadcasts updates via WebSocket
 */
export class GitStatusMonitor {
  constructor(models, eventEmitterService, githubTokenService, checkInterval = 30000) { // Check every 30 seconds
    this.models = models;
    this.eventEmitterService = eventEmitterService;
    this.githubTokenService = githubTokenService;
    this.checkInterval = checkInterval;
    this.isRunning = false;
    this.intervalId = null;
    this.lastStatus = new Map(); // Cache last status per task
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[GitStatusMonitor] Starting git status monitoring');
    
    // Run immediately, then on interval
    this.checkAllTasks();
    this.intervalId = setInterval(() => this.checkAllTasks(), this.checkInterval);
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('[GitStatusMonitor] Stopped git status monitoring');
  }

  async checkAllTasks() {
    try {
      // Get all projects
      const projects = await this.models.projects.findAll();
      
      for (const project of projects) {
        // Get active tasks for this project
        const tasks = await this.models.tasks.findByProjectId(project.id);
        const activeTasks = tasks.filter(task => 
          task.worktree_path && 
          fsSync.existsSync(task.worktree_path)
        );
        
        for (const task of activeTasks) {
          await this.checkTaskGitStatus(task, project);
        }
      }
    } catch (error) {
      console.error('[GitStatusMonitor] Error checking tasks:', error);
    }
  }

  async checkTaskGitStatus(task, project) {
    try {
      const baseBranch = `origin/${project.base_branch || 'main'}`;
      
      // Debug logging for merged tasks
      if (task.status === 'merged' || task.merged_at) {
        console.log(`[GitStatusMonitor] Checking merged task ${task.id}, branch: ${task.branch}, base: ${baseBranch}`);
      }
      
      // Check if githubTokenService exists
      if (!this.githubTokenService) {
        console.error('[GitStatusMonitor] githubTokenService is not initialized');
        return;
      }
      
      // Get token and create GitService instance
      const token = await this.githubTokenService.getToken();
      const gitService = new GitService(token);
      
      if (!gitService || !gitService.getBranchStatus) {
        console.error('[GitStatusMonitor] GitService not properly initialized or missing getBranchStatus method');
        return;
      }
      
      const status = await gitService.getBranchStatus(
        task.worktree_path,
        task.branch,
        baseBranch
      );
      
      // Create status key for comparison (including staged/unstaged/untracked)
      const statusKey = `${status.ahead}-${status.behind}-${status.hasConflicts}-${status.staged}-${status.unstaged}-${status.untracked}`;
      const lastStatusKey = this.lastStatus.get(task.id);
      
      // Only broadcast if status changed
      if (statusKey !== lastStatusKey) {
        this.lastStatus.set(task.id, statusKey);
        
        // Emit git status changed event
        if (this.eventEmitterService) {
          this.eventEmitterService.emitGitStatusChanged(task.id, status);
        }
        
        console.log(`[GitStatusMonitor] Git status changed for task ${task.id}:`, status);
      }
    } catch (error) {
      console.error(`[GitStatusMonitor] Error checking git status for task ${task.id}:`, error);
    }
  }

  // Method to force check a specific task (useful after git operations)
  async checkTask(taskId) {
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || !task.worktree_path || !fsSync.existsSync(task.worktree_path)) {
        return;
      }
      
      const project = await this.models.projects.findById(task.project_id);
      if (project) {
        await this.checkTaskGitStatus(task, project);
      }
    } catch (error) {
      console.error(`[GitStatusMonitor] Error checking specific task ${taskId}:`, error);
    }
  }
}

/**
 * Initialize the Git Status Monitor
 */
export function initializeGitStatusMonitor(models, eventEmitterService, githubTokenService) {
  const monitor = new GitStatusMonitor(models, eventEmitterService, githubTokenService);
  monitor.start();
  
  // Graceful shutdown
  process.on('SIGTERM', () => monitor.stop());
  process.on('SIGINT', () => monitor.stop());
  
  return monitor;
}