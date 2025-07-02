# Task Lifecycle Implementation Plan

## Overview
This document outlines the implementation plan for improving task lifecycle management in PocketDev, including graduated deletion, task continuation, and proper branch cleanup.

## Current State Analysis

### Problems Identified
1. Remote branches are never deleted, causing accumulation
2. No tracking of PR status or remote branch state
3. Limited recovery options after task deletion
4. No connection between related tasks
5. Incomplete cleanup of resources

### Current Deletion Behavior
- **Soft Delete**: Archives task, moves worktree to `.archived`
- **Hard Delete**: Removes worktree and database records
- **Issue**: Remote branches persist indefinitely

## Proposed Task Lifecycle Design

### 1. Graduated Deletion Process

```
Active Task
    ↓
Completed (branch kept, worktree active)
    ↓ (7 days)
Archived (local branch deleted, remote kept, worktree archived)
    ↓ (30 days)  
Backed Up (remote deleted, patch stored, metadata preserved)
    ↓ (90 days)
Purged (only core metadata remains)
```

### 2. Database Schema Changes

```sql
-- New fields for tasks table
ALTER TABLE tasks ADD COLUMN parent_task_id TEXT;
ALTER TABLE tasks ADD COLUMN continuation_of TEXT;
ALTER TABLE tasks ADD COLUMN task_chain_id TEXT;
ALTER TABLE tasks ADD COLUMN sequence_number INTEGER DEFAULT 1;

-- Track PR and branch status
ALTER TABLE tasks ADD COLUMN pr_url TEXT;
ALTER TABLE tasks ADD COLUMN pr_status TEXT; -- 'open', 'merged', 'closed'
ALTER TABLE tasks ADD COLUMN pr_number INTEGER;
ALTER TABLE tasks ADD COLUMN remote_branch_deleted BOOLEAN DEFAULT 0;
ALTER TABLE tasks ADD COLUMN remote_branch_exists BOOLEAN DEFAULT 1;

-- Deletion tracking
ALTER TABLE tasks ADD COLUMN deletion_type TEXT; -- 'merged', 'abandoned', 'completed'
ALTER TABLE tasks ADD COLUMN deletion_reason TEXT;
ALTER TABLE tasks ADD COLUMN deleted_by TEXT;
ALTER TABLE tasks ADD COLUMN deleted_at TIMESTAMP;

-- Backup and recovery
ALTER TABLE tasks ADD COLUMN final_diff_patch TEXT;
ALTER TABLE tasks ADD COLUMN branch_backup_ref TEXT;
ALTER TABLE tasks ADD COLUMN can_restore BOOLEAN DEFAULT 1;
ALTER TABLE tasks ADD COLUMN restore_deadline TIMESTAMP;

-- Work metrics
ALTER TABLE tasks ADD COLUMN commit_count INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN lines_added INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN lines_removed INTEGER DEFAULT 0;
ALTER TABLE tasks ADD COLUMN files_changed INTEGER DEFAULT 0;

-- Foreign key constraints
ALTER TABLE tasks ADD FOREIGN KEY (parent_task_id) REFERENCES tasks(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD FOREIGN KEY (continuation_of) REFERENCES tasks(id) ON DELETE SET NULL;

-- New audit table
CREATE TABLE IF NOT EXISTS task_lifecycle_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'created', 'started', 'paused', 'completed', 'archived', 'deleted', 'continued'
    event_data JSON,
    user_id TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_tasks_chain ON tasks(task_chain_id);
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_lifecycle_task ON task_lifecycle_events(task_id);
```

### 3. Task Continuation Flow

#### Creating a Continuation Task

```javascript
async continueTask(originalTaskId, options = {}) {
  const original = await getTask(originalTaskId);
  
  // Determine chain information
  const chainId = original.task_chain_id || original.id;
  const sequenceNumber = await getNextSequenceNumber(chainId);
  
  // Create the continuation task
  const newTask = await createTask({
    // Basic info
    project_id: original.project_id,
    name: options.name || `${original.name} (Part ${sequenceNumber})`,
    
    // Chain relationships
    parent_task_id: originalTaskId,
    continuation_of: original.continuation_of || originalTaskId,
    task_chain_id: chainId,
    sequence_number: sequenceNumber,
    
    // Context preservation
    description: options.description || `Continuing work from: ${original.name}`,
    metadata: {
      ...original.metadata,
      continued_from: {
        task_id: originalTaskId,
        branch: original.branch,
        last_commit: original.last_commit_sha,
        completed_at: original.completed_at,
        pr_status: original.pr_status
      }
    }
  });
  
  // Determine base branch
  const baseBranch = await determineBaseBranch(original);
  
  // Create worktree
  await createWorktree(newTask.branch, baseBranch);
  
  // Log the event
  await logLifecycleEvent(newTask.id, 'continued', {
    from_task: originalTaskId,
    base_branch: baseBranch
  });
  
  return newTask;
}

async determineBaseBranch(task) {
  // If merged, start from merge commit
  if (task.pr_status === 'merged' && task.merge_commit_sha) {
    return task.merge_commit_sha;
  }
  
  // If has commits, start from last commit
  if (task.last_commit_sha) {
    return task.last_commit_sha;
  }
  
  // Otherwise, fresh start from base branch
  const project = await getProject(task.project_id);
  return project.base_branch;
}
```

### 4. Branch Cleanup Strategy

#### Pre-Deletion Checks

```javascript
async checkRemoteDeletionSafety(task) {
  const checks = [];
  
  // Check for open PR
  if (task.pr_status === 'open') {
    checks.push({
      safe: false,
      reason: 'Task has an open pull request'
    });
  }
  
  // Check if recently merged
  if (task.merged_at) {
    const daysSinceMerge = daysSince(task.merged_at);
    if (daysSinceMerge < 7) {
      checks.push({
        safe: false,
        reason: `Branch was merged ${daysSinceMerge} days ago (keep for 7 days)`
      });
    }
  }
  
  // Check for unique commits
  const hasUniqueCommits = await checkForUniqueCommits(task.branch);
  if (hasUniqueCommits) {
    checks.push({
      safe: false,
      reason: 'Branch contains commits not found elsewhere'
    });
  }
  
  // Check for tags
  const hasTags = await checkForTags(task.branch);
  if (hasTags) {
    checks.push({
      safe: false,
      reason: 'Branch has associated tags'
    });
  }
  
  const failures = checks.filter(c => !c.safe);
  return {
    isSafe: failures.length === 0,
    reasons: failures.map(f => f.reason)
  };
}
```

#### Cleanup Implementation

```javascript
class TaskCleanupManager {
  async performGraduatedCleanup() {
    // Stage 1: Complete -> Archive (7 days)
    const tasksToArchive = await getTasksForArchival();
    for (const task of tasksToArchive) {
      await this.archiveTask(task);
    }
    
    // Stage 2: Archive -> Backup (30 days)
    const tasksToBackup = await getTasksForBackup();
    for (const task of tasksToBackup) {
      await this.backupAndCleanRemote(task);
    }
    
    // Stage 3: Backup -> Purge (90 days)
    const tasksToPurge = await getTasksForPurge();
    for (const task of tasksToPurge) {
      await this.purgeTask(task);
    }
  }
  
  async backupAndCleanRemote(task) {
    // Create backup before deletion
    const backup = await this.createBackup(task);
    
    // Store the backup
    await updateTask(task.id, {
      final_diff_patch: backup.patch,
      branch_backup_ref: backup.lastCommit
    });
    
    // Check if safe to delete remote
    const safety = await checkRemoteDeletionSafety(task);
    if (safety.isSafe) {
      await deleteRemoteBranch(task.branch);
      await updateTask(task.id, {
        remote_branch_deleted: true,
        remote_branch_exists: false
      });
    }
    
    // Log the event
    await logLifecycleEvent(task.id, 'backed_up', {
      backup_size: backup.size,
      remote_deleted: safety.isSafe
    });
  }
  
  async createBackup(task) {
    // Get final diff
    const diff = await git.diff(task.base_branch, task.branch);
    
    // Get commit history
    const commits = await git.log(task.branch);
    
    return {
      patch: diff,
      lastCommit: task.last_commit_sha,
      commits: commits,
      size: diff.length
    };
  }
}
```

## Implementation Phases

### Phase 1: Database Schema Update (Week 1)
1. Create migration scripts for new fields
2. Update SQLite schema
3. Update ORM models
4. Add indexes for performance

### Phase 2: Task Continuation (Week 2)
1. Implement `continueTask` API endpoint
2. Add UI for continuing completed tasks
3. Create task chain visualization
4. Update task queries to include chain info

### Phase 3: Lifecycle Management (Week 3-4)
1. Implement graduated deletion stages
2. Create backup/restore functionality
3. Add lifecycle event tracking
4. Build cleanup automation job

### Phase 4: Branch Management (Week 5)
1. Implement remote branch safety checks
2. Add PR status tracking
3. Create branch deletion API
4. Update cleanup processes

### Phase 5: UI/UX Updates (Week 6)
1. Add task chain navigation
2. Show lifecycle status badges
3. Create recovery/continuation workflows
4. Add cleanup management interface

## Testing Strategy

### Test-Driven Development Approach
We will write tests BEFORE implementing features to ensure clarity of requirements and expected behavior.

### Unit Tests

#### Task Continuation (`/tests/task-continuation.test.js`)
```javascript
describe('Task Continuation', () => {
  describe('continueTask', () => {
    it('should create a new task linked to the original', async () => {
      const original = await createTask({ name: 'Original Task' });
      const continued = await continueTask(original.id);
      
      expect(continued.parent_task_id).toBe(original.id);
      expect(continued.task_chain_id).toBe(original.id);
      expect(continued.sequence_number).toBe(2);
    });

    it('should inherit metadata from original task', async () => {
      const original = await createTask({ 
        name: 'Original', 
        metadata: { priority: 'high' } 
      });
      const continued = await continueTask(original.id);
      
      expect(continued.metadata.priority).toBe('high');
      expect(continued.metadata.continued_from.task_id).toBe(original.id);
    });

    it('should use merge commit as base when original was merged', async () => {
      const original = await createTask({ 
        pr_status: 'merged',
        merge_commit_sha: 'abc123'
      });
      const continued = await continueTask(original.id);
      
      const worktree = await getWorktree(continued.worktree_path);
      expect(worktree.base_commit).toBe('abc123');
    });

    it('should increment sequence number for multi-part chains', async () => {
      const task1 = await createTask({ name: 'Part 1' });
      const task2 = await continueTask(task1.id);
      const task3 = await continueTask(task2.id);
      
      expect(task3.sequence_number).toBe(3);
      expect(task3.task_chain_id).toBe(task1.id);
      expect(task3.continuation_of).toBe(task1.id);
    });
  });
});
```

#### Branch Safety Checks (`/tests/branch-safety.test.js`)
```javascript
describe('Branch Safety Checks', () => {
  describe('checkRemoteDeletionSafety', () => {
    it('should prevent deletion of branches with open PRs', async () => {
      const task = await createTask({ pr_status: 'open' });
      const safety = await checkRemoteDeletionSafety(task);
      
      expect(safety.isSafe).toBe(false);
      expect(safety.reasons).toContain('Task has an open pull request');
    });

    it('should prevent deletion of recently merged branches', async () => {
      const task = await createTask({ 
        pr_status: 'merged',
        merged_at: new Date() // Today
      });
      const safety = await checkRemoteDeletionSafety(task);
      
      expect(safety.isSafe).toBe(false);
      expect(safety.reasons[0]).toMatch(/merged \d+ days ago/);
    });

    it('should allow deletion of old merged branches', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 30);
      
      const task = await createTask({ 
        pr_status: 'merged',
        merged_at: oldDate
      });
      const safety = await checkRemoteDeletionSafety(task);
      
      expect(safety.isSafe).toBe(true);
    });

    it('should prevent deletion if branch has unique commits', async () => {
      const task = await createTask();
      mockGit.hasUniqueCommits.mockResolvedValue(true);
      
      const safety = await checkRemoteDeletionSafety(task);
      
      expect(safety.isSafe).toBe(false);
      expect(safety.reasons).toContain('Branch contains commits not found elsewhere');
    });
  });
});
```

#### Lifecycle State Transitions (`/tests/task-lifecycle-states.test.js`)
```javascript
describe('Task Lifecycle State Transitions', () => {
  describe('Graduated Deletion', () => {
    it('should archive tasks 7 days after completion', async () => {
      const task = await createTask({ 
        status: 'completed',
        completed_at: daysAgo(8)
      });
      
      await performGraduatedCleanup();
      
      const updated = await getTask(task.id);
      expect(updated.is_archived).toBe(true);
      expect(updated.worktree_path).toMatch(/\.archived/);
    });

    it('should backup and delete remote 30 days after archival', async () => {
      const task = await createTask({ 
        is_archived: true,
        archived_at: daysAgo(31)
      });
      
      await performGraduatedCleanup();
      
      const updated = await getTask(task.id);
      expect(updated.final_diff_patch).toBeTruthy();
      expect(updated.remote_branch_deleted).toBe(true);
    });

    it('should not delete remote if safety check fails', async () => {
      const task = await createTask({ 
        is_archived: true,
        archived_at: daysAgo(31),
        pr_status: 'open'
      });
      
      await performGraduatedCleanup();
      
      const updated = await getTask(task.id);
      expect(updated.final_diff_patch).toBeTruthy();
      expect(updated.remote_branch_deleted).toBe(false);
    });
  });

  describe('Lifecycle Event Tracking', () => {
    it('should log all state transitions', async () => {
      const task = await createTask();
      
      await completeTask(task.id);
      await archiveTask(task.id);
      
      const events = await getLifecycleEvents(task.id);
      
      expect(events).toHaveLength(3);
      expect(events.map(e => e.event_type)).toEqual([
        'created', 'completed', 'archived'
      ]);
    });
  });
});
```

#### Backup and Restore (`/tests/task-backup-restore.test.js`)
```javascript
describe('Task Backup and Restore', () => {
  describe('createBackup', () => {
    it('should capture final diff patch', async () => {
      const task = await createTask();
      await makeChanges(task.worktree_path);
      
      const backup = await createBackup(task);
      
      expect(backup.patch).toContain('diff --git');
      expect(backup.lastCommit).toBe(task.last_commit_sha);
    });

    it('should store commit history', async () => {
      const task = await createTask();
      await makeCommits(task, 3);
      
      const backup = await createBackup(task);
      
      expect(backup.commits).toHaveLength(3);
    });
  });

  describe('restoreFromBackup', () => {
    it('should apply patch to new branch', async () => {
      const original = await createTask();
      const backup = await createBackup(original);
      await deleteTask(original.id, { force: true });
      
      const restored = await restoreFromBackup(backup);
      
      expect(restored.parent_task_id).toBe(original.id);
      const diff = await getDiff(restored.branch);
      expect(diff).toBe(backup.patch);
    });
  });
});
```

### Integration Tests

#### Full Task Lifecycle Flow (`/tests/task-lifecycle-integration.test.js`)
```javascript
describe('Task Lifecycle Integration', () => {
  it('should handle complete lifecycle from creation to purge', async () => {
    // Create and complete task
    const task = await createTask({ name: 'Feature X' });
    await makeCommits(task, 2);
    await createPR(task);
    await mergePR(task);
    await completeTask(task.id);
    
    // Verify initial state
    expect(task.pr_status).toBe('merged');
    
    // Simulate time passing and cleanup stages
    mockDate.set(daysFromNow(8));
    await performGraduatedCleanup();
    
    let updated = await getTask(task.id);
    expect(updated.is_archived).toBe(true);
    
    // 30 days later - backup stage
    mockDate.set(daysFromNow(38));
    await performGraduatedCleanup();
    
    updated = await getTask(task.id);
    expect(updated.final_diff_patch).toBeTruthy();
    expect(updated.remote_branch_deleted).toBe(true);
    
    // Continue the task
    const continued = await continueTask(task.id);
    expect(continued.parent_task_id).toBe(task.id);
    expect(continued.sequence_number).toBe(2);
  });
});
```

#### Task Chain Operations (`/tests/task-chain-integration.test.js`)
```javascript
describe('Task Chain Integration', () => {
  it('should maintain chain integrity across multiple continuations', async () => {
    const task1 = await createTask({ name: 'Initial Implementation' });
    await completeTask(task1.id);
    
    const task2 = await continueTask(task1.id, { 
      name: 'Bug Fixes' 
    });
    await completeTask(task2.id);
    
    const task3 = await continueTask(task2.id, { 
      name: 'Performance Improvements' 
    });
    
    // Verify chain
    const chain = await getTaskChain(task3.id);
    expect(chain).toHaveLength(3);
    expect(chain[0].id).toBe(task1.id);
    expect(chain[2].sequence_number).toBe(3);
    
    // Verify latest in chain
    const latest = await getLatestInChain(task1.id);
    expect(latest.id).toBe(task3.id);
  });
});
```

### E2E Tests

#### Continue Task Flow (`/tests/e2e/continue-task.e2e.test.js`)
```javascript
describe('E2E: Continue Task', () => {
  it('should allow continuing completed task from UI', async () => {
    // Setup
    await createAndCompleteTask('Original Feature');
    
    // Navigate to completed tasks
    await page.goto('/tasks?status=completed');
    await page.waitForSelector('[data-task-name="Original Feature"]');
    
    // Click continue button
    await page.click('[data-task-name="Original Feature"] [data-action="continue"]');
    
    // Fill continuation form
    await page.waitForSelector('#continue-task-dialog');
    await page.fill('#task-name', 'Original Feature - Improvements');
    await page.click('#continue-submit');
    
    // Verify new task created
    await page.waitForNavigation();
    expect(page.url()).toContain('/tasks/');
    
    const taskName = await page.textContent('h1');
    expect(taskName).toBe('Original Feature - Improvements');
    
    // Verify chain indicator
    const chainInfo = await page.textContent('[data-chain-info]');
    expect(chainInfo).toContain('Part 2');
  });
});
```

#### Branch Cleanup Management (`/tests/e2e/branch-cleanup.e2e.test.js`)
```javascript
describe('E2E: Branch Cleanup', () => {
  it('should show safety warnings before deleting branches', async () => {
    // Create task with open PR
    const task = await createTask({ pr_status: 'open' });
    
    // Navigate to cleanup manager
    await page.goto('/cleanup-manager');
    
    // Try to delete remote branch
    await page.click(`[data-task-id="${task.id}"] [data-action="delete-remote"]`);
    
    // Verify warning dialog
    await page.waitForSelector('.warning-dialog');
    const warning = await page.textContent('.warning-message');
    expect(warning).toContain('open pull request');
    
    // Cancel deletion
    await page.click('[data-action="cancel"]');
    
    // Verify branch not deleted
    const status = await page.textContent(`[data-task-id="${task.id}"] .remote-status`);
    expect(status).toBe('Active');
  });
});
```

### Performance Tests

#### Cleanup Job Performance (`/tests/performance/cleanup-performance.test.js`)
```javascript
describe('Cleanup Performance', () => {
  it('should handle large number of tasks efficiently', async () => {
    // Create 1000 tasks in various states
    await createBulkTasks(1000, {
      completed: 400,
      archived: 300,
      active: 300
    });
    
    const startTime = Date.now();
    await performGraduatedCleanup();
    const duration = Date.now() - startTime;
    
    // Should complete within 30 seconds
    expect(duration).toBeLessThan(30000);
    
    // Verify correct tasks were processed
    const stats = await getCleanupStats();
    expect(stats.archived).toBeGreaterThan(0);
    expect(stats.backedUp).toBeGreaterThan(0);
  });
});
```

### Test Data Helpers

Create `/tests/helpers/test-data.js`:
```javascript
export function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

export function daysFromNow(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

export async function createAndCompleteTask(name) {
  const task = await createTask({ name });
  await makeCommits(task, 2);
  await completeTask(task.id);
  return task;
}

export async function makeCommits(task, count) {
  for (let i = 0; i < count; i++) {
    await git.commit(`Commit ${i + 1}`, { cwd: task.worktree_path });
  }
}
```

## Rollback Plan

1. Schema changes are additive (no breaking changes)
2. Feature flags for new functionality
3. Gradual rollout to test with subset of users
4. Backup all tasks before enabling auto-cleanup

## Success Metrics

1. **Branch Hygiene**: <50 stale remote branches after 90 days
2. **Recovery Success**: >95% successful task continuations
3. **Data Preservation**: 0 accidental data loss incidents
4. **User Satisfaction**: Positive feedback on task management

## Next Steps

1. Review and approve implementation plan
2. Create detailed technical design for each phase
3. Set up development environment with test data
4. Begin Phase 1 implementation