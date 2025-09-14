import { ValidationError } from './errors.js';

/**
 * Task domain object - lightweight with validation
 * Represents a feature branch with its own worktree
 */
export class Task {
  constructor(
    id,
    projectId,
    name,
    branch,
    worktreePath,
    state = 'active',
    hasUncommittedChanges = false,
    hasConflicts = false,
    aheadCount = 0,
    behindCount = 0
  ) {
    this.id = id;
    this.projectId = projectId;
    this.name = name;
    this.branch = branch;
    this.worktreePath = worktreePath;
    this.state = state; // 'active' | 'merged' | 'archived'
    this.hasUncommittedChanges = hasUncommittedChanges;
    this.hasConflicts = hasConflicts;
    this.aheadCount = aheadCount;
    this.behindCount = behindCount;
    
    this.validate();
  }
  
  validate() {
    if (!this.id?.trim()) {
      throw new ValidationError('id', 'Task ID required');
    }
    
    if (!this.projectId?.trim()) {
      throw new ValidationError('projectId', 'Project ID required');
    }
    
    if (!this.name?.trim()) {
      throw new ValidationError('name', 'Task name required');
    }
    
    if (!this.branch?.trim()) {
      throw new ValidationError('branch', 'Branch name required');
    }
    
    if (!this.isValidBranchName(this.branch)) {
      throw new ValidationError('branch', 'Invalid branch name format');
    }
    
    if (!this.worktreePath) {
      throw new ValidationError('worktreePath', 'Worktree path required');
    }
    
    const validStates = ['active', 'merged', 'archived'];
    if (!validStates.includes(this.state)) {
      throw new ValidationError('state', `State must be one of: ${validStates.join(', ')}`);
    }
  }
  
  isValidBranchName(branch) {
    // Git branch naming rules (simplified)
    const invalidChars = /[\s~^:?*\[\]\\]/;
    return !invalidChars.test(branch) && !branch.startsWith('.') && !branch.endsWith('.');
  }
  
  // Business rules
  canMerge() {
    return this.state === 'active' && 
           !this.hasConflicts && 
           !this.hasUncommittedChanges;
  }
  
  canArchive() {
    return this.state === 'merged';
  }
  
  canDelete() {
    // Can delete if archived or if no uncommitted changes
    return this.state === 'archived' || !this.hasUncommittedChanges;
  }
  
  needsPull() {
    return this.behindCount > 0;
  }
  
  needsPush() {
    return this.aheadCount > 0;
  }
  
  isUpToDate() {
    return this.aheadCount === 0 && this.behindCount === 0;
  }
  
  // State transitions
  markMerged() {
    if (!this.canMerge()) {
      throw new ValidationError('state', 'Cannot merge task in current state');
    }
    this.state = 'merged';
  }
  
  archive() {
    if (!this.canArchive()) {
      throw new ValidationError('state', 'Can only archive merged tasks');
    }
    this.state = 'archived';
  }
  
  reactivate() {
    if (this.state !== 'archived') {
      throw new ValidationError('state', 'Can only reactivate archived tasks');
    }
    this.state = 'active';
  }
  
  // Factory method to create from database row
  static fromDatabase(row) {
    return new Task(
      row.id,
      row.project_id,
      row.name,
      row.branch,
      row.worktree_path,
      row.status || 'active',
      row.has_uncommitted_changes || false,
      false, // hasConflicts - would need to be determined from git status
      0,     // aheadCount - would need to be determined from git status
      0      // behindCount - would need to be determined from git status
    );
  }
  
  // Convert to database format
  toDatabaseFormat() {
    return {
      id: this.id,
      project_id: this.projectId,
      name: this.name,
      branch: this.branch,
      worktree_path: this.worktreePath,
      status: this.state,
      has_uncommitted_changes: this.hasUncommittedChanges
    };
  }
}