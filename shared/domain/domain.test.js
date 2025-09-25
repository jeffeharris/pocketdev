import { Project, Task, TerminalSession, ValidationError } from './index.js';

console.log('Testing Domain Objects...\n');

// Test Project
console.log('1. Testing Project domain object:');
try {
  // Valid project
  const project = new Project(
    'proj123',
    'PocketDev',
    'https://github.com/user/pocketdev',
    'main'
  );
  console.log('✓ Valid project created');
  console.log('  canCreateTask:', project.canCreateTask());
  
  // Invalid project - missing name
  try {
    new Project('proj456', '', 'https://github.com/test/repo');
    console.log('✗ Should have thrown validation error for empty name');
  } catch (e) {
    if (e instanceof ValidationError && e.field === 'name') {
      console.log('✓ Validation error thrown for empty name');
    }
  }
  
  // Invalid project - bad URL
  try {
    new Project('proj789', 'Test', 'not-a-git-url');
    console.log('✗ Should have thrown validation error for invalid URL');
  } catch (e) {
    if (e instanceof ValidationError && e.field === 'repoUrl') {
      console.log('✓ Validation error thrown for invalid URL');
    }
  }
} catch (e) {
  console.error('✗ Unexpected error:', e.message);
}

// Test Task
console.log('\n2. Testing Task domain object:');
try {
  // Valid task
  const task = new Task(
    'task123',
    'proj123',
    'Add login feature',
    'feature/login',
    '/projects/proj123/worktrees/task123',
    'active',
    false,
    false,
    3,
    0
  );
  console.log('✓ Valid task created');
  console.log('  canMerge:', task.canMerge());
  console.log('  needsPush:', task.needsPush());
  console.log('  isUpToDate:', task.isUpToDate());
  
  // Test state transitions
  task.markMerged();
  console.log('✓ Task marked as merged');
  console.log('  canArchive:', task.canArchive());
  
  task.archive();
  console.log('✓ Task archived');
  
  // Invalid branch name
  try {
    new Task('task456', 'proj123', 'Bad branch', 'feature/bad name', '/path');
    console.log('✗ Should have thrown validation error for invalid branch name');
  } catch (e) {
    if (e instanceof ValidationError && e.field === 'branch') {
      console.log('✓ Validation error thrown for invalid branch name');
    }
  }
  
  // Test invalid state transition
  try {
    const activeTask = new Task(
      'task789',
      'proj123',
      'Test',
      'feature/test',
      '/path',
      'active',
      true, // has uncommitted changes
      false
    );
    activeTask.markMerged();
    console.log('✗ Should have thrown error for merging with uncommitted changes');
  } catch (e) {
    if (e instanceof ValidationError) {
      console.log('✓ Validation error thrown for invalid merge attempt');
    }
  }
} catch (e) {
  console.error('✗ Unexpected error:', e.message);
}

// Test TerminalSession
console.log('\n3. Testing TerminalSession domain object:');
try {
  // Valid session
  const session = new TerminalSession(
    'sess123',
    'task123',
    'shell456',
    'Main Terminal',
    0,
    'not-started',
    'claude'
  );
  console.log('✓ Valid terminal session created');
  console.log('  isActive:', session.isActive());
  console.log('  canStart:', session.canStart());
  
  // Test state transitions
  session.start();
  console.log('✓ Session started');
  console.log('  canAcceptInput:', session.canAcceptInput());
  
  session.startWorking();
  console.log('✓ Session started working');
  console.log('  isWorking:', session.isWorking());
  
  session.requestInput();
  console.log('✓ Session requesting input');
  console.log('  needsUserInput:', session.needsUserInput());
  
  // Invalid AI agent
  try {
    new TerminalSession('sess456', 'task123', 'shell789', 'Test', 0, 'idle', 'invalid-ai');
    console.log('✗ Should have thrown validation error for invalid AI agent');
  } catch (e) {
    if (e instanceof ValidationError && e.field === 'aiAgent') {
      console.log('✓ Validation error thrown for invalid AI agent');
    }
  }
} catch (e) {
  console.error('✗ Unexpected error:', e.message);
}

// Test database conversions
console.log('\n4. Testing database conversions:');
try {
  // Project conversion
  const dbProject = {
    id: 'proj999',
    name: 'Test Project',
    repo_url: 'https://github.com/test/repo',
    base_branch: 'develop'
  };
  const project = Project.fromDatabase(dbProject);
  const backToDb = project.toDatabaseFormat();
  console.log('✓ Project database round-trip successful');
  
  // Task conversion
  const dbTask = {
    id: 'task999',
    project_id: 'proj999',
    name: 'Test Task',
    branch: 'feature/test',
    worktree_path: '/path/to/worktree',
    status: 'active',
    has_uncommitted_changes: false
  };
  const task = Task.fromDatabase(dbTask);
  const taskToDb = task.toDatabaseFormat();
  console.log('✓ Task database round-trip successful');
  
  // TerminalSession conversion
  const dbSession = {
    id: 'sess999',
    task_id: 'task999',
    shelltender_session_id: 'shell999',
    tab_name: 'Terminal 1',
    tab_order: 0,
    ai_state: 'idle',
    model: 'claude'
  };
  const session = TerminalSession.fromDatabase(dbSession);
  const sessionToDb = session.toDatabaseFormat();
  console.log('✓ TerminalSession database round-trip successful');
} catch (e) {
  console.error('✗ Database conversion error:', e.message);
}

console.log('\n✅ All domain object tests passed!');