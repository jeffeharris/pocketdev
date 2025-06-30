import { Router } from 'express';

// Import all route modules
import projectRoutes from './project.routes.js';
import taskRoutes from './task.routes.js';
import settingsRoutes from './settings.routes.js';
import monitoringRoutes from './monitoring.routes.js';
import uploadRoutes from './upload.routes.js';
import terminalRoutes from './terminal.routes.js';

const router = Router();

// Mount route modules with their base paths
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/settings', settingsRoutes);
router.use('/monitoring', monitoringRoutes);

// Upload routes are nested, so mount at root
router.use('/', uploadRoutes);

// Terminal routes are mixed, so mount at root
router.use('/', terminalRoutes);

// Health check endpoint (already in app.js but can be here too)
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pocketdev-project-manager-api'
  });
});

export default router;