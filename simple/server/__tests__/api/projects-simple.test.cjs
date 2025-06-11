const request = require('supertest');
const express = require('express');
const path = require('path');
const { createTestDatabase, clearDatabase } = require('../helpers/database.cjs');
const Models = require('../../db/models/index.cjs');

describe('Project API Endpoints', () => {
  let app;
  let db;
  let models;

  beforeEach(async () => {
    // Create test database and models
    db = await createTestDatabase();
    models = new Models(db);
    
    // Create Express app with routes
    app = express();
    app.use(express.json());
    
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
    await clearDatabase(db);
    await db.close();
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
    test('should delete project', async () => {
      const project = await models.projects.create({
        name: 'Project to Delete',
        repoUrl: 'https://github.com/test/delete'
      });

      const response = await request(app)
        .delete(`/api/projects/${project.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify project is deleted
      const deleted = await models.projects.findById(project.id);
      expect(deleted).toBeUndefined();
    });
  });
});