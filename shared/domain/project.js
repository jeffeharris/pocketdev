import { ValidationError } from './errors.js';

/**
 * Project domain object - lightweight with validation
 * Represents a git repository being managed by PocketDev
 */
export class Project {
  constructor(id, name, repoUrl, baseBranch = 'main') {
    this.id = id;
    this.name = name;
    this.repoUrl = repoUrl;
    this.baseBranch = baseBranch;
    
    this.validate();
  }
  
  validate() {
    if (!this.id?.trim()) {
      throw new ValidationError('id', 'Project ID required');
    }
    
    if (!this.name?.trim()) {
      throw new ValidationError('name', 'Project name required');
    }
    
    if (!this.repoUrl?.trim()) {
      throw new ValidationError('repoUrl', 'Repository URL required');
    }
    
    if (!this.isValidGitUrl(this.repoUrl)) {
      throw new ValidationError('repoUrl', 'Invalid git URL format');
    }
    
    if (!this.baseBranch?.trim()) {
      throw new ValidationError('baseBranch', 'Base branch required');
    }
  }
  
  isValidGitUrl(url) {
    // Basic validation for git URLs
    return url.startsWith('https://') || 
           url.startsWith('http://') || 
           url.startsWith('git@') ||
           url.startsWith('git://');
  }
  
  // Business rules
  canCreateTask() {
    // For now, can always create tasks
    // Future: might check for max tasks, permissions, etc.
    return true;
  }
  
  canDelete() {
    // Can delete if no active tasks (would need task list to check properly)
    // For now, simplified rule
    return true;
  }
  
  // Factory method to create from database row
  static fromDatabase(row) {
    return new Project(
      row.id,
      row.name,
      row.repo_url,
      row.base_branch || 'main'
    );
  }
  
  // Convert to database format
  toDatabaseFormat() {
    return {
      id: this.id,
      name: this.name,
      repo_url: this.repoUrl,
      base_branch: this.baseBranch
    };
  }
}