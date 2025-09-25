/**
 * Usage examples for the new GitStatus and Worktree domain objects
 * These show how they can be integrated into existing services
 */

import { GitStatus, Worktree, Task } from './index.js';

// Example 1: Using GitStatus in TaskService
function exampleTaskServiceUsage() {
  console.log('Example: Using GitStatus in TaskService\n');
  
  // When getting task status from git
  async function getTaskStatus(taskId) {
    // Get raw git status (from git command)
    const rawStatus = await runGitStatus(worktreePath);
    
    // Create domain object
    const gitStatus = new GitStatus(
      rawStatus.ahead,
      rawStatus.behind,
      rawStatus.staged,
      rawStatus.modified,
      rawStatus.untracked,
      rawStatus.conflicts
    );
    
    // Use domain logic
    return {
      taskId,
      status: gitStatus.getSummary(),
      canMerge: gitStatus.canMerge(),
      recommendedAction: gitStatus.getRecommendedAction(),
      details: gitStatus.toJSON()
    };
  }
  
  // When checking if task can be merged
  async function canMergeTask(taskId) {
    const task = await getTask(taskId);
    const gitStatus = await getGitStatus(task.worktreePath);
    
    // Domain objects make business rules clear
    const canMerge = 
      task.canMerge() &&           // Task state allows merging
      gitStatus.canMerge() &&       // Git state allows merging
      !gitStatus.needsPull();       // Not behind upstream
    
    return {
      canMerge,
      blockers: [
        !task.canMerge() && 'Task state prevents merge',
        !gitStatus.canMerge() && gitStatus.getSummary(),
        gitStatus.needsPull() && 'Need to pull latest changes'
      ].filter(Boolean)
    };
  }
}

// Example 2: Using Worktree in WorktreeService
function exampleWorktreeServiceUsage() {
  console.log('Example: Using Worktree in WorktreeService\n');
  
  // When creating a worktree
  async function createWorktree(projectId, taskId, branch) {
    // Generate path
    const worktreePath = Worktree.generatePath('/projects', projectId, taskId);
    
    // Create domain object
    const worktree = new Worktree(
      `wt-${taskId}`,
      projectId,
      taskId,
      worktreePath,
      branch,
      'main'
    );
    
    // Check if we can create it
    if (!worktree.canModify()) {
      throw new Error('Cannot create locked worktree');
    }
    
    // Actually create the git worktree
    await runGitWorktreeAdd(worktreePath, branch);
    
    // Save to database
    await saveWorktree(worktree.toDatabaseFormat());
    
    return worktree;
  }
  
  // When cleaning up orphaned worktrees
  async function cleanupOrphaned() {
    const allWorktrees = await getAllWorktrees();
    const orphaned = [];
    
    for (const row of allWorktrees) {
      const worktree = Worktree.fromDatabase(row);
      
      if (worktree.needsRepair()) {
        // Try to repair
        try {
          await runGitWorktreeRepair(worktree.worktreePath);
          worktree.repair();
          await saveWorktree(worktree.toDatabaseFormat());
        } catch (error) {
          // If repair fails, mark for deletion
          orphaned.push(worktree);
        }
      }
    }
    
    // Delete unrepairable worktrees
    for (const wt of orphaned) {
      if (wt.canDelete()) {
        await deleteWorktree(wt.id);
      }
    }
    
    return { repaired: allWorktrees.length - orphaned.length, deleted: orphaned.length };
  }
}

// Example 3: Combined usage in a merge flow
function exampleMergeFlow() {
  console.log('Example: Complete merge flow with domain objects\n');
  
  async function prepareTaskForMerge(taskId) {
    // Get all domain objects
    const task = await getTaskDomain(taskId);
    const worktree = await getWorktreeDomain(taskId);
    const gitStatus = await getGitStatusDomain(task.worktreePath);
    
    // Check all preconditions using domain logic
    const checks = {
      taskReady: task.canMerge(),
      worktreeActive: worktree.isActive(),
      gitClean: gitStatus.canMerge(),
      notBehind: !gitStatus.needsPull(),
      hasChanges: gitStatus.needsPush()
    };
    
    // Determine what needs to be done
    const actions = [];
    
    if (!checks.gitClean) {
      if (gitStatus.hasConflicts()) {
        actions.push({ action: 'resolve-conflicts', priority: 1 });
      } else if (gitStatus.hasUncommittedChanges()) {
        actions.push({ action: 'commit-changes', priority: 2 });
      }
    }
    
    if (checks.notBehind === false) {
      actions.push({ action: 'pull-latest', priority: 3 });
    }
    
    if (!checks.hasChanges) {
      actions.push({ action: 'no-changes-to-merge', priority: 4 });
    }
    
    return {
      canMerge: Object.values(checks).every(v => v),
      checks,
      requiredActions: actions.sort((a, b) => a.priority - b.priority),
      status: gitStatus.getSummary()
    };
  }
}

// Stub functions to represent actual git operations
async function runGitStatus(path) { return {}; }
async function getTask(id) { return {}; }
async function getGitStatus(path) { return new GitStatus(); }
async function runGitWorktreeAdd(path, branch) { }
async function saveWorktree(data) { }
async function getAllWorktrees() { return []; }
async function runGitWorktreeRepair(path) { }
async function deleteWorktree(id) { }
async function getTaskDomain(id) { return new Task('1', '2', 'test', 'branch', '/path'); }
async function getWorktreeDomain(id) { return new Worktree('1', '2', '3', '/path', 'branch'); }
async function getGitStatusDomain(path) { return new GitStatus(); }

console.log('These examples show how GitStatus and Worktree domain objects can:');
console.log('1. Encapsulate complex git state logic');
console.log('2. Provide clear business rules (canMerge, needsRepair, etc.)');
console.log('3. Make code more readable and maintainable');
console.log('4. Reduce scattered validation and state checks');