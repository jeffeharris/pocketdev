const { createTestDatabase, clearDatabase } = require('../../helpers/database');
const ProjectModel = require('../../../db/models/project.cjs');
const TaskModel = require('../../../db/models/task.cjs');

describe('Task Model', () => {
  let db;
  let projectModel;
  let taskModel;
  let testProject;

  beforeEach(async () => {
    db = await createTestDatabase();
    projectModel = new ProjectModel(db);
    taskModel = new TaskModel(db);
    
    // Create a test project for tasks
    testProject = await projectModel.create({
      name: 'Test Project',
      repoUrl: 'https://github.com/test/repo'
    });
  });

  afterEach(async () => {
    await clearDatabase(db);
    await db.close();
  });

  describe('create', () => {
    test('should create a new task with auto-generated ID', async () => {
      const taskData = {
        name: 'Test Task',
        branch: 'feature/test-feature'
      };

      const task = await taskModel.create(testProject.id, taskData);

      expect(task).toBeDefined();
      expect(task.id).toMatch(/^[a-f0-9]{8}$/);
      expect(task.name).toBe('Test Task');
      expect(task.branch).toBe('feature/test-feature');
      expect(task.project_id).toBe(testProject.id);
      expect(task.status).toBe('active');
      expect(task.worktree_path).toBe(`projects/${testProject.id}-task-${task.id}`);
    });

    test('should create task with custom ID and worktree path', async () => {
      const taskData = {
        id: 'custom-task-id',
        name: 'Custom Task',
        branch: 'custom-branch',
        worktreePath: '/custom/worktree/path'
      };

      const task = await taskModel.create(testProject.id, taskData);

      expect(task.id).toBe('custom-task-id');
      expect(task.worktree_path).toBe('/custom/worktree/path');
    });

    test('should register worktree in registry', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task with Worktree',
        branch: 'feature-branch'
      });

      const worktree = await db.get(
        'SELECT * FROM worktree_registry WHERE path = ?',
        [task.worktree_path]
      );

      expect(worktree).toBeDefined();
      expect(worktree.task_id).toBe(task.id);
      expect(worktree.project_id).toBe(testProject.id);
      expect(worktree.is_orphaned).toBe(0);
    });
  });

  describe('findById', () => {
    test('should find task by ID with project info', async () => {
      const created = await taskModel.create(testProject.id, {
        name: 'Find Me Task',
        branch: 'find-me-branch'
      });

      const found = await taskModel.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Find Me Task');
      expect(found.project_name).toBe('Test Project');
      expect(found.project_repo_url).toBe('https://github.com/test/repo');
      expect(found.session_count).toBe(0);
      expect(found.active_session_count).toBe(0);
    });

    test('should include session counts', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task with Sessions',
        branch: 'session-branch'
      });

      // Add sessions
      await db.run(
        'INSERT INTO claude_sessions (id, task_id, session_id, is_active) VALUES (?, ?, ?, ?)',
        ['session1', task.id, 'claude-123', 1]
      );
      await db.run(
        'INSERT INTO claude_sessions (id, task_id, session_id, is_active) VALUES (?, ?, ?, ?)',
        ['session2', task.id, 'claude-456', 0]
      );

      const found = await taskModel.findById(task.id);
      expect(found.session_count).toBe(2);
      expect(found.active_session_count).toBe(1);
    });

    test('should parse metadata JSON', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task with Metadata',
        branch: 'metadata-branch'
      });

      const metadata = { key: 'value', count: 42 };
      await db.run(
        'UPDATE tasks SET metadata = ? WHERE id = ?',
        [JSON.stringify(metadata), task.id]
      );

      const found = await taskModel.findById(task.id);
      expect(found.metadata).toEqual(metadata);
    });
  });

  describe('findByProjectId', () => {
    test('should find all tasks for a project', async () => {
      await taskModel.create(testProject.id, { name: 'Task 1', branch: 'branch-1' });
      await taskModel.create(testProject.id, { name: 'Task 2', branch: 'branch-2' });
      await taskModel.create(testProject.id, { name: 'Task 3', branch: 'branch-3' });

      const tasks = await taskModel.findByProjectId(testProject.id);

      expect(tasks).toHaveLength(3);
      expect(tasks.map(t => t.name)).toEqual(
        expect.arrayContaining(['Task 1', 'Task 2', 'Task 3'])
      );
    });

    test('should exclude archived tasks by default', async () => {
      const t1 = await taskModel.create(testProject.id, { name: 'Active', branch: 'active' });
      const t2 = await taskModel.create(testProject.id, { name: 'Archived', branch: 'archived' });
      
      await taskModel.archive(t2.id);

      const tasks = await taskModel.findByProjectId(testProject.id);

      expect(tasks).toHaveLength(1);
      expect(tasks[0].name).toBe('Active');
    });

    test('should include archived tasks when requested', async () => {
      const t1 = await taskModel.create(testProject.id, { name: 'Active', branch: 'active' });
      const t2 = await taskModel.create(testProject.id, { name: 'Archived', branch: 'archived' });
      
      await taskModel.archive(t2.id);

      const tasks = await taskModel.findByProjectId(testProject.id, true);

      expect(tasks).toHaveLength(2);
      expect(tasks.find(t => t.is_archived === 1)).toBeDefined();
    });

    test('should order by created_at DESC', async () => {
      const t1 = await taskModel.create(testProject.id, { name: 'Old', branch: 'old' });
      await new Promise(resolve => setTimeout(resolve, 10));
      const t2 = await taskModel.create(testProject.id, { name: 'New', branch: 'new' });

      const tasks = await taskModel.findByProjectId(testProject.id);

      expect(tasks[0].name).toBe('New');
      expect(tasks[1].name).toBe('Old');
    });
  });

  describe('update', () => {
    test('should update task fields', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Original Task',
        branch: 'original-branch'
      });

      const updated = await taskModel.update(task.id, {
        name: 'Updated Task',
        status: 'completed'
      });

      expect(updated.name).toBe('Updated Task');
      expect(updated.status).toBe('completed');
      expect(updated.branch).toBe('original-branch');
    });

    test('should set completed_at when status is completed', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task to Complete',
        branch: 'complete-branch'
      });

      const updated = await taskModel.update(task.id, {
        status: 'completed'
      });

      expect(updated.status).toBe('completed');
      expect(updated.completed_at).toBeDefined();
    });

    test('should update uncommitted changes flag', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task with Changes',
        branch: 'changes-branch'
      });

      const updated = await taskModel.update(task.id, {
        hasUncommittedChanges: true,
        lastCommitSha: 'abc123'
      });

      expect(updated.has_uncommitted_changes).toBe(1);
      expect(updated.last_commit_sha).toBe('abc123');
    });
  });

  describe('archive', () => {
    test('should archive task and mark worktree as orphaned', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task to Archive',
        branch: 'archive-branch'
      });

      await taskModel.archive(task.id);

      // Check task is archived
      const taskRow = await db.get(
        'SELECT is_archived, status FROM tasks WHERE id = ?',
        [task.id]
      );
      expect(taskRow.is_archived).toBe(1);
      expect(taskRow.status).toBe('archived');

      // Check worktree is marked as orphaned
      const worktree = await db.get(
        'SELECT is_orphaned FROM worktree_registry WHERE task_id = ?',
        [task.id]
      );
      expect(worktree.is_orphaned).toBe(1);
    });
  });

  describe('delete', () => {
    test('should delete task and cascade to sessions', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task to Delete',
        branch: 'delete-branch'
      });

      // Add a session
      await db.run(
        'INSERT INTO claude_sessions (id, task_id, session_id) VALUES (?, ?, ?)',
        ['session1', task.id, 'claude-session-123']
      );

      await taskModel.delete(task.id);

      // Check task is deleted
      const taskExists = await db.get(
        'SELECT 1 FROM tasks WHERE id = ?',
        [task.id]
      );
      expect(taskExists).toBeUndefined();

      // Check session is deleted
      const sessionExists = await db.get(
        'SELECT 1 FROM claude_sessions WHERE task_id = ?',
        [task.id]
      );
      expect(sessionExists).toBeUndefined();
    });

    test('should mark worktree as orphaned on delete', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task with Worktree',
        branch: 'worktree-branch'
      });

      await taskModel.delete(task.id);

      const worktree = await db.get(
        'SELECT is_orphaned, task_id FROM worktree_registry WHERE path = ?',
        [task.worktree_path]
      );

      expect(worktree.is_orphaned).toBe(1);
      expect(worktree.task_id).toBeNull();
    });
  });

  describe('getActiveTaskCount', () => {
    test('should count only active non-archived tasks', async () => {
      await taskModel.create(testProject.id, { name: 'Active 1', branch: 'b1' });
      await taskModel.create(testProject.id, { name: 'Active 2', branch: 'b2' });
      const completed = await taskModel.create(testProject.id, { name: 'Completed', branch: 'b3' });
      const archived = await taskModel.create(testProject.id, { name: 'Archived', branch: 'b4' });

      await taskModel.update(completed.id, { status: 'completed' });
      await taskModel.archive(archived.id);

      const count = await taskModel.getActiveTaskCount(testProject.id);
      expect(count).toBe(2);
    });

    test('should return 0 for project with no tasks', async () => {
      const newProject = await projectModel.create({
        name: 'Empty Project',
        repoUrl: 'https://github.com/test/empty'
      });

      const count = await taskModel.getActiveTaskCount(newProject.id);
      expect(count).toBe(0);
    });
  });

  describe('checkForUncommittedChanges', () => {
    test('should return uncommitted changes status', async () => {
      const task = await taskModel.create(testProject.id, {
        name: 'Task with Status',
        branch: 'status-branch'
      });

      // Update the flag
      await taskModel.update(task.id, { has_uncommitted_changes: true });

      const hasChanges = await taskModel.checkForUncommittedChanges(task.id);
      expect(hasChanges).toBe(1);
    });

    test('should return null for non-existent task', async () => {
      const hasChanges = await taskModel.checkForUncommittedChanges('non-existent');
      expect(hasChanges).toBeNull();
    });
  });
});