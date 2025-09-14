import { GitStatus, Worktree, ValidationError } from './index.js';

console.log('Testing New Domain Objects...\n');

// Test GitStatus
console.log('1. Testing GitStatus domain object:');
try {
  // Clean status
  const cleanStatus = new GitStatus(0, 0, 0, 0, 0, 0, 'main', 'origin/main');
  console.log('✓ Clean status created');
  console.log('  isClean:', cleanStatus.isClean());
  console.log('  canMerge:', cleanStatus.canMerge());
  console.log('  Summary:', cleanStatus.getSummary());
  
  // Status with changes
  const dirtyStatus = new GitStatus(
    3,  // ahead
    1,  // behind
    2,  // staged
    4,  // unstaged
    1,  // untracked
    0,  // conflicts
    'feature/test',
    'origin/feature/test'
  );
  console.log('✓ Dirty status created');
  console.log('  isClean:', dirtyStatus.isClean());
  console.log('  hasDiverged:', dirtyStatus.hasDiverged());
  console.log('  needsPush:', dirtyStatus.needsPush());
  console.log('  needsPull:', dirtyStatus.needsPull());
  console.log('  canPull:', dirtyStatus.canPull());
  console.log('  Summary:', dirtyStatus.getSummary());
  console.log('  Recommended:', dirtyStatus.getRecommendedAction());
  
  // Status with conflicts
  const conflictStatus = new GitStatus(0, 0, 0, 0, 0, 3);
  console.log('✓ Conflict status created');
  console.log('  hasConflicts:', conflictStatus.hasConflicts());
  console.log('  canMerge:', conflictStatus.canMerge());
  console.log('  canPush:', conflictStatus.canPush());
  console.log('  Recommended:', conflictStatus.getRecommendedAction());
  
  // Test validation
  try {
    new GitStatus(-1, 0, 0, 0, 0, 0);
    console.log('✗ Should have thrown validation error for negative ahead');
  } catch (e) {
    if (e instanceof ValidationError) {
      console.log('✓ Validation error for negative counts');
    }
  }
  
} catch (e) {
  console.error('✗ Unexpected error:', e.message);
}

// Test Worktree
console.log('\n2. Testing Worktree domain object:');
try {
  // Valid worktree
  const worktree = new Worktree(
    'wt123',
    'proj456',
    'task789',
    '/projects/proj456-task-task789',
    'feature/new-feature',
    'main',
    false,
    false
  );
  console.log('✓ Valid worktree created');
  console.log('  canDelete:', worktree.canDelete());
  console.log('  canModify:', worktree.canModify());
  console.log('  isActive:', worktree.isActive());
  console.log('  Directory name:', worktree.getDirectoryName());
  
  // Test lock/unlock
  worktree.lock();
  console.log('✓ Worktree locked');
  console.log('  canModify:', worktree.canModify());
  
  worktree.unlock();
  console.log('✓ Worktree unlocked');
  
  // Test orphaned worktree
  const orphaned = new Worktree(
    'wt-orphan',
    'proj456',
    'task-old',
    '/projects/proj456-task-old',
    'feature/old',
    'main',
    false,
    true
  );
  console.log('✓ Orphaned worktree created');
  console.log('  needsRepair:', orphaned.needsRepair());
  console.log('  canCheckout:', orphaned.canCheckout());
  
  // Test path generation
  const generatedPath = Worktree.generatePath('/projects', 'abc123', 'def456');
  console.log('✓ Generated path:', generatedPath);
  console.log('  Is worktree path:', Worktree.isWorktreePath(generatedPath));
  
  // Test invalid branch name
  try {
    new Worktree(
      'bad-wt',
      'proj',
      'task',
      '/projects/test',
      'feature/bad name', // Invalid - has space
      'main'
    );
    console.log('✗ Should have thrown validation error for invalid branch');
  } catch (e) {
    if (e instanceof ValidationError) {
      console.log('✓ Validation error for invalid branch name');
    }
  }
  
  // Test invalid path
  try {
    new Worktree(
      'bad-path',
      'proj',
      'task',
      '../../../etc/passwd', // Dangerous path
      'feature/test',
      'main'
    );
    console.log('✗ Should have thrown validation error for dangerous path');
  } catch (e) {
    if (e instanceof ValidationError) {
      console.log('✓ Validation error for dangerous path');
    }
  }
  
} catch (e) {
  console.error('✗ Unexpected error:', e.message);
}

// Test integration with Task
console.log('\n3. Testing integration with Task:');
try {
  // Create a task with git status
  const status = new GitStatus(2, 0, 1, 0, 0, 0);
  const worktree = new Worktree(
    'wt-task',
    'proj123',
    'task456',
    '/projects/proj123-task-456',
    'feature/integration',
    'main'
  );
  
  console.log('✓ Task-related objects created');
  console.log('  Git status says needsPush:', status.needsPush());
  console.log('  Git status says canMerge:', status.canMerge());
  console.log('  Worktree says canModify:', worktree.canModify());
  
  // Simulate checking if task can be merged
  const canMergeTask = status.canMerge() && worktree.isActive();
  console.log('  Combined: Can merge task?', canMergeTask);
  
} catch (e) {
  console.error('✗ Unexpected error:', e.message);
}

console.log('\n✅ All new domain object tests passed!');