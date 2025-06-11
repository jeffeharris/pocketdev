const request = require('supertest');
const express = require('express');
const path = require('path');
const fs = require('fs').promises;
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Mock the modules
jest.mock('child_process');
jest.mock('fs');

describe('Project API Endpoints', () => {
  let app;
  let db;
  let models;

  beforeEach(async () => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Mock fs.mkdir
    fs.mkdir = jest.fn().mockResolvedValue(undefined);
    
    // Mock execAsync for git operations
    execAsync.mockImplementation((cmd) => {
      if (cmd.includes('git clone')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      if (cmd.includes('git checkout')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      if (cmd.includes('git remote set-url')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      if (cmd.includes('git config')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      if (cmd.includes('git worktree add')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      if (cmd.includes('git status')) {
        return Promise.resolve({ stdout: '', stderr: '' });
      }
      return Promise.reject(new Error(`Unknown command: ${cmd}`));
    });

    // Create a test app with mocked dependencies
    app = express();
    app.use(express.json());
    
    // Mock database and models
    const { createTestDatabase } = require('../helpers/database');
    const Models = require('../../db/models/index.cjs');
    
    db = await createTestDatabase();
    models = new Models(db);
    
    // Define routes (simplified version for testing)
    app.post('/api/projects', async (req, res) => {
      try {
        const { repoUrl, branch = 'main', projectName } = req.body;
        
        // Check if project exists
        const existing = await models.projects.findByRepoUrl(repoUrl);
        if (existing) {
          return res.status(400).json({ 
            error: 'Project already exists', 
            project: existing 
          });
        }
        
        const projectId = models.projects.generateId();
        const projectPath = path.join('/tmp/projects', projectId);
        
        // Mock git operations
        await fs.mkdir(path.dirname(projectPath), { recursive: true });
        
        // Create project in database
        const project = await models.projects.create({
          id: projectId,
          name: projectName || 'Test Project',
          repoUrl,
          baseBranch: branch,
          localPath: projectPath
        });
        
        res.json({ success: true, project });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
    
    app.get('/api/projects', async (req, res) => {
      try {
        const projects = await models.projects.findAll();
        res.json(projects);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.get('/api/projects/:id', async (req, res) => {
      try {
        const project = await models.projects.findById(req.params.id);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        res.json(project);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    app.delete('/api/projects/:id', async (req, res) => {
      try {
        const project = await models.projects.findById(req.params.id);
        if (!project) {
          return res.status(404).json({ error: 'Project not found' });
        }
        
        await models.projects.delete(project.id);
        res.json({ success: true });
      } catch (error) {
        res.status(500).json({ success: false, error: error.message });
      }
    });
  });

  afterEach(async () => {
    if (db) {
      await db.close();
    }
  });

  describe('POST /api/projects', () => {
    test('should create a new project', async () => {
      const projectData = {
        repoUrl: 'https://github.com/test/repo',
        projectName: 'Test Project',
        branch: 'main'
      };

      const response = await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.project).toBeDefined();
      expect(response.body.project.name).toBe('Test Project');
      expect(response.body.project.repo_url).toBe('https://github.com/test/repo');
      expect(response.body.project.base_branch).toBe('main');
    });

    test('should reject duplicate repository URLs', async () => {
      const projectData = {
        repoUrl: 'https://github.com/test/duplicate',
        projectName: 'First Project'
      };

      // Create first project
      await request(app)
        .post('/api/projects')
        .send(projectData)
        .expect(200);

      // Try to create duplicate
      const response = await request(app)
        .post('/api/projects')
        .send({
          ...projectData,
          projectName: 'Second Project'
        })
        .expect(400);

      expect(response.body.error).toBe('Project already exists');
      expect(response.body.project).toBeDefined();
    });

    test('should handle errors gracefully', async () => {
      // Force an error by making the create method throw
      models.projects.create = jest.fn().mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .post('/api/projects')
        .send({
          repoUrl: 'https://github.com/test/error',
          projectName: 'Error Project'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  describe('GET /api/projects', () => {
    test('should return all projects', async () => {
      // Create some test projects
      await models.projects.create({
        name: 'Project 1',
        repoUrl: 'https://github.com/test/proj1'
      });
      await models.projects.create({
        name: 'Project 2',
        repoUrl: 'https://github.com/test/proj2'
      });

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(response.body.map(p => p.name)).toEqual(
        expect.arrayContaining(['Project 1', 'Project 2'])
      );
    });

    test('should exclude archived projects', async () => {
      const p1 = await models.projects.create({
        name: 'Active Project',
        repoUrl: 'https://github.com/test/active'
      });
      const p2 = await models.projects.create({
        name: 'Archived Project',
        repoUrl: 'https://github.com/test/archived'
      });

      await models.projects.archive(p2.id);

      const response = await request(app)
        .get('/api/projects')
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].name).toBe('Active Project');
    });
  });

  describe('GET /api/projects/:id', () => {
    test('should return project by ID', async () => {
      const project = await models.projects.create({
        name: 'Test Project',
        repoUrl: 'https://github.com/test/repo'
      });

      const response = await request(app)
        .get(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.id).toBe(project.id);
      expect(response.body.name).toBe('Test Project');
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .get('/api/projects/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Project not found');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    test('should delete project and cascade', async () => {
      const project = await models.projects.create({
        name: 'Project to Delete',
        repoUrl: 'https://github.com/test/delete'
      });

      // Add a task
      await models.tasks.create(project.id, {
        name: 'Task 1',
        branch: 'feature-1'
      });

      const response = await request(app)
        .delete(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify project is deleted
      const deleted = await models.projects.findById(project.id);
      expect(deleted).toBeUndefined();

      // Verify tasks are deleted
      const tasks = await models.tasks.findByProjectId(project.id);
      expect(tasks).toHaveLength(0);
    });

    test('should return 404 for non-existent project', async () => {
      const response = await request(app)
        .delete('/api/projects/non-existent')
        .expect(404);

      expect(response.body.error).toBe('Project not found');
    });
  });
});