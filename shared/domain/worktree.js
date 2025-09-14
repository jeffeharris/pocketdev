import { ValidationError } from './errors.js';
import path from 'path';

/**
 * Worktree domain object - represents a git worktree for a task
 * Encapsulates worktree path, branch, and validation rules
 */
export class Worktree {
  constructor(
    id,
    projectId,
    taskId,
    worktreePath,
    branch,
    baseBranch = 'main',
    isLocked = false,
    isOrphaned = false
  ) {
    this.id = id;
    this.projectId = projectId;
    this.taskId = taskId;
    this.worktreePath = worktreePath;
    this.branch = branch;
    this.baseBranch = baseBranch;
    this.isLocked = isLocked;
    this.isOrphaned = isOrphaned;
    
    this.validate();
  }
  
  validate() {
    if (!this.id?.trim()) {
      throw new ValidationError('id', 'Worktree ID required');
    }
    
    if (!this.projectId?.trim()) {
      throw new ValidationError('projectId', 'Project ID required');
    }
    
    if (!this.taskId?.trim()) {
      throw new ValidationError('taskId', 'Task ID required');
    }
    
    if (!this.worktreePath?.trim()) {
      throw new ValidationError('worktreePath', 'Worktree path required');
    }
    
    if (!this.isValidPath(this.worktreePath)) {
      throw new ValidationError('worktreePath', 'Invalid worktree path');
    }
    
    if (!this.branch?.trim()) {
      throw new ValidationError('branch', 'Branch name required');
    }
    
    if (!this.isValidBranchName(this.branch)) {
      throw new ValidationError('branch', 'Invalid branch name format');
    }
    
    if (!this.baseBranch?.trim()) {
      throw new ValidationError('baseBranch', 'Base branch required');
    }
  }
  
  isValidPath(pathStr) {
    // Basic path validation
    // Should be absolute path
    if (!path.isAbsolute(pathStr)) return false;
    
    // Should not contain dangerous patterns
    const dangerous = ['..', '~', '$', '`', '|', '&', ';', '>', '<'];
    for (const pattern of dangerous) {
      if (pathStr.includes(pattern)) return false;
    }
    
    return true;
  }
  
  isValidBranchName(branch) {
    // Git branch naming rules (simplified)
    const invalidChars = /[\s~^:?*\[\]\\]/;
    return !invalidChars.test(branch) && 
           !branch.startsWith('.') && 
           !branch.endsWith('.') &&
           !branch.endsWith('.lock');
  }
  
  // Business rules
  canDelete() {
    return !this.isLocked && !this.isOrphaned;
  }
  
  canModify() {
    return !this.isLocked;
  }
  
  canCheckout() {
    return !this.isOrphaned && !this.isLocked;
  }
  
  isActive() {
    return !this.isOrphaned && !this.isLocked;
  }
  
  needsRepair() {
    return this.isOrphaned;
  }
  
  // Operations
  lock() {
    if (this.isLocked) {
      throw new ValidationError('state', 'Worktree is already locked');
    }
    this.isLocked = true;
  }
  
  unlock() {
    if (!this.isLocked) {
      throw new ValidationError('state', 'Worktree is not locked');
    }
    this.isLocked = false;
  }
  
  markOrphaned() {
    this.isOrphaned = true;
    this.isLocked = true; // Orphaned worktrees should be locked
  }
  
  repair() {
    if (!this.isOrphaned) {
      throw new ValidationError('state', 'Worktree is not orphaned');
    }
    this.isOrphaned = false;
    this.isLocked = false;
  }
  
  // Path utilities
  getRelativePath(fromPath = process.cwd()) {
    return path.relative(fromPath, this.worktreePath);
  }
  
  getDirectoryName() {
    return path.basename(this.worktreePath);
  }
  
  getParentDirectory() {
    return path.dirname(this.worktreePath);
  }
  
  // Generate expected worktree path for a task
  static generatePath(projectsDir, projectId, taskId) {
    return path.join(projectsDir, `${projectId}-task-${taskId}`);
  }
  
  // Check if a path looks like a worktree path
  static isWorktreePath(pathStr) {
    // Check if path matches expected pattern
    const pattern = /[a-f0-9]{8}-task-[a-f0-9]{8}$/;
    return pattern.test(pathStr);
  }
  
  // Factory method from database row
  static fromDatabase(row) {
    return new Worktree(
      row.path || row.id, // Some tables use 'path' as primary key
      row.project_id,
      row.task_id,
      row.path || row.worktree_path,
      row.branch,
      row.base_branch || 'main',
      row.is_locked || false,
      row.is_orphaned || false
    );
  }
  
  // Convert to database format
  toDatabaseFormat() {
    return {
      path: this.worktreePath, // Primary key in worktree_registry
      project_id: this.projectId,
      task_id: this.taskId,
      branch: this.branch,
      base_branch: this.baseBranch,
      is_locked: this.isLocked,
      is_orphaned: this.isOrphaned,
      last_seen: new Date().toISOString()
    };
  }
  
  // Convert to API format
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      taskId: this.taskId,
      path: this.worktreePath,
      branch: this.branch,
      baseBranch: this.baseBranch,
      isLocked: this.isLocked,
      isOrphaned: this.isOrphaned,
      canDelete: this.canDelete(),
      canModify: this.canModify(),
      needsRepair: this.needsRepair()
    };
  }
}