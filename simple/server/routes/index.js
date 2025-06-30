import { Router } from 'express';

// Import route creators
import projectRoutes from './project.routes.js';
import settingsRoutes from './settings.routes.js';
import monitoringRoutes from './monitoring.routes.js';
import uploadRoutes from './upload.routes.js';
import terminalRoutes from './terminal.routes.js';
import createTaskRoutes from './task.routes.js';
import { TaskController } from '../controllers/task.controller.js';

/**
 * Create all routes with access to app instance
 */
export default function createRoutes(app) {
  const router = Router();
  
  // Get models and config from app
  const models = app.locals.models;
  const projectsDir = app.locals.projectsDir || process.env.PROJECTS_DIR || '/projects';
  
  // Mount simple route modules
  router.use('/projects', projectRoutes);
  router.use('/settings', settingsRoutes);
  router.use('/monitoring', monitoringRoutes);
  
  // Mount nested task routes under projects
  const taskRouter = createTaskRoutes(models, projectsDir);
  router.use('/projects/:projectId/tasks', taskRouter);
  
  // Upload routes are nested, so mount at root
  router.use('/', uploadRoutes);
  
  // Terminal routes are mixed, so mount at root
  router.use('/', terminalRoutes);
  
  // Global tasks endpoints for shelltender-client
  router.get('/tasks', async (req, res, next) => {
    try {
      const allTasks = await models.tasks.findAll();
      res.json(allTasks);
    } catch (error) {
      next(error);
    }
  });
  
  router.post('/tasks', async (req, res, next) => {
    try {
      const { projectId, branchName, description } = req.body;
      
      if (!projectId || !branchName) {
        return res.status(400).json({ error: 'projectId and branchName are required' });
      }
      
      // Delegate to task controller
      req.params.projectId = projectId;
      req.body = { name: description || branchName, branch: branchName };
      
      const taskController = new TaskController(models, projectsDir);
      return taskController.createTask(req, res);
    } catch (error) {
      next(error);
    }
  });
  
  // Health check endpoint
  router.get('/health', (req, res) => {
    res.json({ 
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'pocketdev-project-manager-api'
    });
  });
  
  return router;
}