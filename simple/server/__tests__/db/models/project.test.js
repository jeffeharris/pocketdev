const { createTestDatabase, clearDatabase } = require('../../helpers/database');
const ProjectModel = require('../../../db/models/project.cjs');

describe('Project Model', () => {
  let db;
  let projectModel;

  beforeEach(async () => {
    db = await createTestDatabase();
    projectModel = new ProjectModel(db);
  });

  afterEach(async () => {
    await clearDatabase(db);
    await db.close();
  });

  describe('create', () => {
    test('should create a new project with auto-generated ID', async () => {
      const projectData = {
        name: 'Test Project',
        repoUrl: 'https://github.com/test/repo',
        baseBranch: 'main'
      };

      const project = await projectModel.create(projectData);

      expect(project).toBeDefined();
      expect(project.id).toMatch(/^[a-f0-9]{8}$/);
      expect(project.name).toBe('Test Project');
      expect(project.repo_url).toBe('https://github.com/test/repo');
      expect(project.base_branch).toBe('main');
      expect(project.is_archived).toBe(0);
      expect(project.created_at).toBeDefined();
    });

    test('should create a project with custom ID', async () => {
      const projectData = {
        id: 'custom-id-123',
        name: 'Custom ID Project',
        repoUrl: 'https://github.com/test/repo2'
      };

      const project = await projectModel.create(projectData);

      expect(project.id).toBe('custom-id-123');
      expect(project.name).toBe('Custom ID Project');
    });

    test('should handle camelCase and snake_case properties', async () => {
      const projectData = {
        name: 'Test Project',
        repo_url: 'https://github.com/test/repo',
        base_branch: 'develop',
        local_path: '/test/path'
      };

      const project = await projectModel.create(projectData);

      expect(project.repo_url).toBe('https://github.com/test/repo');
      expect(project.base_branch).toBe('develop');
      expect(project.local_path).toBe('/test/path');
    });
  });

  describe('findById', () => {
    test('should find project by ID', async () => {
      const created = await projectModel.create({
        name: 'Find Me',
        repoUrl: 'https://github.com/test/findme'
      });

      const found = await projectModel.findById(created.id);

      expect(found).toBeDefined();
      expect(found.id).toBe(created.id);
      expect(found.name).toBe('Find Me');
      expect(found.task_count).toBe(0);
      expect(found.active_task_count).toBe(0);
    });

    test('should return undefined for non-existent project', async () => {
      const project = await projectModel.findById('non-existent');
      expect(project).toBeUndefined();
    });

    test('should not return archived projects', async () => {
      const project = await projectModel.create({
        name: 'Archived Project',
        repoUrl: 'https://github.com/test/archived'
      });

      await projectModel.archive(project.id);

      const found = await projectModel.findById(project.id);
      expect(found).toBeUndefined();
    });

    test('should include task counts', async () => {
      const project = await projectModel.create({
        name: 'Project with Tasks',
        repoUrl: 'https://github.com/test/tasks'
      });

      // Add some tasks
      await db.run(
        'INSERT INTO tasks (id, project_id, name, branch, worktree_path, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['task1', project.id, 'Task 1', 'feature-1', '/path1', 'active']
      );
      await db.run(
        'INSERT INTO tasks (id, project_id, name, branch, worktree_path, status) VALUES (?, ?, ?, ?, ?, ?)',
        ['task2', project.id, 'Task 2', 'feature-2', '/path2', 'completed']
      );

      const found = await projectModel.findById(project.id);
      expect(found.task_count).toBe(2);
      expect(found.active_task_count).toBe(1);
    });
  });

  describe('findAll', () => {
    test('should return all active projects', async () => {
      await projectModel.create({ name: 'Project 1', repoUrl: 'url1' });
      await projectModel.create({ name: 'Project 2', repoUrl: 'url2' });
      await projectModel.create({ name: 'Project 3', repoUrl: 'url3' });

      const projects = await projectModel.findAll();

      expect(projects).toHaveLength(3);
      expect(projects.map(p => p.name)).toEqual(
        expect.arrayContaining(['Project 1', 'Project 2', 'Project 3'])
      );
    });

    test('should exclude archived projects by default', async () => {
      const p1 = await projectModel.create({ name: 'Active', repoUrl: 'url1' });
      const p2 = await projectModel.create({ name: 'Archived', repoUrl: 'url2' });
      
      await projectModel.archive(p2.id);

      const projects = await projectModel.findAll();

      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Active');
    });

    test('should include archived projects when requested', async () => {
      const p1 = await projectModel.create({ name: 'Active', repoUrl: 'url1' });
      const p2 = await projectModel.create({ name: 'Archived', repoUrl: 'url2' });
      
      await projectModel.archive(p2.id);

      const projects = await projectModel.findAll(true);

      expect(projects).toHaveLength(2);
      expect(projects.find(p => p.is_archived === 1)).toBeDefined();
    });

    test('should order by last_accessed DESC', async () => {
      const p1 = await projectModel.create({ name: 'Old', repoUrl: 'url1' });
      await new Promise(resolve => setTimeout(resolve, 10));
      const p2 = await projectModel.create({ name: 'New', repoUrl: 'url2' });
      
      await projectModel.updateLastAccessed(p1.id);

      const projects = await projectModel.findAll();

      expect(projects[0].name).toBe('Old');
      expect(projects[1].name).toBe('New');
    });
  });

  describe('update', () => {
    test('should update project fields', async () => {
      const project = await projectModel.create({
        name: 'Original Name',
        repoUrl: 'https://github.com/test/original'
      });

      const updated = await projectModel.update(project.id, {
        name: 'Updated Name',
        baseBranch: 'develop'
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.base_branch).toBe('develop');
      expect(updated.repo_url).toBe('https://github.com/test/original');
    });

    test('should update metadata as JSON', async () => {
      const project = await projectModel.create({
        name: 'Test Project',
        repoUrl: 'https://github.com/test/repo'
      });

      const metadata = { custom: 'data', count: 42 };
      const updated = await projectModel.update(project.id, { metadata });

      expect(updated.metadata).toEqual(metadata);
    });

    test('should return unchanged project if no fields provided', async () => {
      const project = await projectModel.create({
        name: 'Test Project',
        repoUrl: 'https://github.com/test/repo'
      });

      const updated = await projectModel.update(project.id, {});

      expect(updated).toEqual(project);
    });
  });

  describe('archive', () => {
    test('should archive project and its tasks', async () => {
      const project = await projectModel.create({
        name: 'Project to Archive',
        repoUrl: 'https://github.com/test/archive'
      });

      // Add a task
      await db.run(
        'INSERT INTO tasks (id, project_id, name, branch, worktree_path) VALUES (?, ?, ?, ?, ?)',
        ['task1', project.id, 'Task 1', 'feature-1', '/path1']
      );

      await projectModel.archive(project.id);

      // Check project is archived
      const projectRow = await db.get(
        'SELECT is_archived FROM projects WHERE id = ?',
        [project.id]
      );
      expect(projectRow.is_archived).toBe(1);

      // Check task is archived
      const taskRow = await db.get(
        'SELECT is_archived FROM tasks WHERE id = ?',
        ['task1']
      );
      expect(taskRow.is_archived).toBe(1);
    });
  });

  describe('delete', () => {
    test('should delete project and cascade to tasks and sessions', async () => {
      const project = await projectModel.create({
        name: 'Project to Delete',
        repoUrl: 'https://github.com/test/delete'
      });

      // Add a task
      await db.run(
        'INSERT INTO tasks (id, project_id, name, branch, worktree_path) VALUES (?, ?, ?, ?, ?)',
        ['task1', project.id, 'Task 1', 'feature-1', '/path1']
      );

      // Add a session
      await db.run(
        'INSERT INTO claude_sessions (id, task_id, session_id) VALUES (?, ?, ?)',
        ['session1', 'task1', 'claude-session-123']
      );

      await projectModel.delete(project.id);

      // Check everything is deleted
      const projectExists = await db.get(
        'SELECT 1 FROM projects WHERE id = ?',
        [project.id]
      );
      const taskExists = await db.get(
        'SELECT 1 FROM tasks WHERE id = ?',
        ['task1']
      );
      const sessionExists = await db.get(
        'SELECT 1 FROM claude_sessions WHERE id = ?',
        ['session1']
      );

      expect(projectExists).toBeUndefined();
      expect(taskExists).toBeUndefined();
      expect(sessionExists).toBeUndefined();
    });
  });

  describe('findByRepoUrl', () => {
    test('should find project by repository URL', async () => {
      await projectModel.create({
        name: 'Test Project',
        repoUrl: 'https://github.com/user/repo'
      });

      const found = await projectModel.findByRepoUrl('https://github.com/user/repo');

      expect(found).toBeDefined();
      expect(found.name).toBe('Test Project');
    });

    test('should return undefined for non-existent repo URL', async () => {
      const found = await projectModel.findByRepoUrl('https://github.com/not/exists');
      expect(found).toBeUndefined();
    });

    test('should not return archived projects', async () => {
      const project = await projectModel.create({
        name: 'Archived Project',
        repoUrl: 'https://github.com/user/archived'
      });

      await projectModel.archive(project.id);

      const found = await projectModel.findByRepoUrl('https://github.com/user/archived');
      expect(found).toBeUndefined();
    });
  });

  describe('exists', () => {
    test('should return true for existing project', async () => {
      const project = await projectModel.create({
        name: 'Test Project',
        repoUrl: 'https://github.com/test/repo'
      });

      const exists = await projectModel.exists(project.id);
      expect(exists).toBe(true);
    });

    test('should return false for non-existent project', async () => {
      const exists = await projectModel.exists('non-existent');
      expect(exists).toBe(false);
    });

    test('should return false for archived project', async () => {
      const project = await projectModel.create({
        name: 'Archived Project',
        repoUrl: 'https://github.com/test/archived'
      });

      await projectModel.archive(project.id);

      const exists = await projectModel.exists(project.id);
      expect(exists).toBe(false);
    });
  });
});