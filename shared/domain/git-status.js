import { ValidationError } from './errors.js';

/**
 * GitStatus domain object - represents the state of a git repository/worktree
 * Encapsulates git status information and provides business logic about the state
 */
export class GitStatus {
  constructor(
    ahead = 0,
    behind = 0,
    staged = 0,
    unstaged = 0,
    untracked = 0,
    conflicts = 0,
    branch = null,
    upstream = null
  ) {
    this.ahead = ahead;
    this.behind = behind;
    this.staged = staged;
    this.unstaged = unstaged;
    this.untracked = untracked;
    this.conflicts = conflicts;
    this.branch = branch;
    this.upstream = upstream;
    
    this.validate();
  }
  
  validate() {
    if (typeof this.ahead !== 'number' || this.ahead < 0) {
      throw new ValidationError('ahead', 'Ahead count must be a non-negative number');
    }
    
    if (typeof this.behind !== 'number' || this.behind < 0) {
      throw new ValidationError('behind', 'Behind count must be a non-negative number');
    }
    
    if (typeof this.staged !== 'number' || this.staged < 0) {
      throw new ValidationError('staged', 'Staged count must be a non-negative number');
    }
    
    if (typeof this.unstaged !== 'number' || this.unstaged < 0) {
      throw new ValidationError('unstaged', 'Unstaged count must be a non-negative number');
    }
    
    if (typeof this.untracked !== 'number' || this.untracked < 0) {
      throw new ValidationError('untracked', 'Untracked count must be a non-negative number');
    }
    
    if (typeof this.conflicts !== 'number' || this.conflicts < 0) {
      throw new ValidationError('conflicts', 'Conflicts count must be a non-negative number');
    }
  }
  
  // Query methods
  isClean() {
    return this.staged === 0 && 
           this.unstaged === 0 && 
           this.untracked === 0 && 
           this.conflicts === 0;
  }
  
  hasUncommittedChanges() {
    return this.staged > 0 || this.unstaged > 0 || this.untracked > 0;
  }
  
  hasConflicts() {
    return this.conflicts > 0;
  }
  
  needsPush() {
    return this.ahead > 0;
  }
  
  needsPull() {
    return this.behind > 0;
  }
  
  hasDiverged() {
    return this.ahead > 0 && this.behind > 0;
  }
  
  isUpToDate() {
    return this.ahead === 0 && this.behind === 0 && this.isClean();
  }
  
  canPush() {
    return this.ahead > 0 && !this.hasConflicts();
  }
  
  canPull() {
    // Can pull if no uncommitted changes (to avoid conflicts)
    // or if only staged changes (git stash can handle)
    return !this.hasConflicts() && (this.isClean() || this.unstaged === 0);
  }
  
  canMerge() {
    return !this.hasConflicts() && !this.hasUncommittedChanges();
  }
  
  // Get status summary for display
  getSummary() {
    const parts = [];
    
    if (this.ahead > 0) parts.push(`${this.ahead} ahead`);
    if (this.behind > 0) parts.push(`${this.behind} behind`);
    if (this.staged > 0) parts.push(`${this.staged} staged`);
    if (this.unstaged > 0) parts.push(`${this.unstaged} modified`);
    if (this.untracked > 0) parts.push(`${this.untracked} untracked`);
    if (this.conflicts > 0) parts.push(`${this.conflicts} conflicts`);
    
    if (parts.length === 0) return 'Clean';
    return parts.join(', ');
  }
  
  // Get recommended action
  getRecommendedAction() {
    if (this.hasConflicts()) return 'resolve-conflicts';
    if (this.unstaged > 0 || this.untracked > 0) return 'stage-changes';
    if (this.staged > 0) return 'commit';
    if (this.needsPush()) return 'push';
    if (this.needsPull()) return 'pull';
    return null;
  }
  
  // Factory method from git status output (simplified)
  static fromGitOutput(statusOutput) {
    // This would parse actual git status output
    // For now, a simplified version
    const status = new GitStatus();
    
    // Parse ahead/behind from: "Your branch is ahead of 'origin/main' by 2 commits"
    const aheadMatch = statusOutput.match(/ahead.*by (\d+) commit/);
    if (aheadMatch) status.ahead = parseInt(aheadMatch[1]);
    
    const behindMatch = statusOutput.match(/behind.*by (\d+) commit/);
    if (behindMatch) status.behind = parseInt(behindMatch[1]);
    
    // Count file states
    const lines = statusOutput.split('\n');
    for (const line of lines) {
      if (line.startsWith('M  ') || line.startsWith('A  ') || line.startsWith('D  ')) {
        status.staged++;
      } else if (line.startsWith(' M ') || line.startsWith(' D ')) {
        status.unstaged++;
      } else if (line.startsWith('?? ')) {
        status.untracked++;
      } else if (line.startsWith('UU ') || line.startsWith('AA ')) {
        status.conflicts++;
      }
    }
    
    return status;
  }
  
  // Convert to database/API format
  toJSON() {
    return {
      ahead: this.ahead,
      behind: this.behind,
      staged: this.staged,
      unstaged: this.unstaged,
      untracked: this.untracked,
      conflicts: this.conflicts,
      branch: this.branch,
      upstream: this.upstream,
      isClean: this.isClean(),
      hasConflicts: this.hasConflicts(),
      needsPush: this.needsPush(),
      needsPull: this.needsPull()
    };
  }
}