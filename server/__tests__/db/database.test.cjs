const { createTestDatabase, clearDatabase } = require('../helpers/database');

describe('Database Initialization', () => {
  let db;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  test('should create database successfully', async () => {
    expect(db).toBeDefined();
    
    // Check if we can run a simple query
    const result = await db.get('SELECT 1 as test');
    expect(result.test).toBe(1);
  });

  test('should create all required tables', async () => {
    const tables = [
      'projects',
      'tasks',
      'claude_sessions',
      'git_credentials',
      'worktree_registry',
      'settings'
    ];

    for (const table of tables) {
      const result = await db.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [table]
      );
      expect(result).toBeDefined();
      expect(result.name).toBe(table);
    }
  });

  test('should have foreign keys enabled', async () => {
    const result = await db.get('PRAGMA foreign_keys');
    expect(result.foreign_keys).toBe(1);
  });

  test('should enforce foreign key constraints', async () => {
    // Try to insert a task with non-existent project_id
    await expect(
      db.run(
        'INSERT INTO tasks (id, project_id, name, branch, worktree_path) VALUES (?, ?, ?, ?, ?)',
        ['test-task', 'non-existent', 'Test Task', 'test-branch', '/test/path']
      )
    ).rejects.toThrow('FOREIGN KEY constraint failed');
  });

  test('should have all required indexes', async () => {
    const expectedIndexes = [
      'idx_tasks_project_id',
      'idx_tasks_status',
      'idx_sessions_task_id',
      'idx_sessions_active',
      'idx_worktree_orphaned',
      'idx_projects_archived'
    ];

    for (const indexName of expectedIndexes) {
      const result = await db.get(
        `SELECT name FROM sqlite_master WHERE type='index' AND name=?`,
        [indexName]
      );
      expect(result).toBeDefined();
      expect(result.name).toBe(indexName);
    }
  });

  test('should handle concurrent connections', async () => {
    const db2 = await createTestDatabase();
    
    // Both connections should work
    const result1 = await db.get('SELECT 1 as test');
    const result2 = await db2.get('SELECT 2 as test');
    
    expect(result1.test).toBe(1);
    expect(result2.test).toBe(2);
    
    await db2.close();
  });

  test('should rollback transactions on error', async () => {
    await db.run('BEGIN TRANSACTION');
    
    try {
      await db.run(
        'INSERT INTO projects (id, name, repo_url) VALUES (?, ?, ?)',
        ['test-project', 'Test Project', 'https://github.com/test/repo']
      );
      
      // This should fail due to foreign key constraint
      await db.run(
        'INSERT INTO tasks (id, project_id, name, branch, worktree_path) VALUES (?, ?, ?, ?, ?)',
        ['test-task', 'wrong-project', 'Test Task', 'test-branch', '/test/path']
      );
      
      await db.run('COMMIT');
    } catch (error) {
      await db.run('ROLLBACK');
    }
    
    // Project should not exist due to rollback
    const project = await db.get('SELECT * FROM projects WHERE id = ?', ['test-project']);
    expect(project).toBeUndefined();
  });
});