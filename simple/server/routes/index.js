import { Router } from 'express';
import projectRoutes from './project.routes.js';
import taskRoutes from './task.routes.js';
import settingsRoutes from './settings.routes.js';
import monitoringRoutes from './monitoring.routes.js';

const router = Router();

// Mount all route modules
router.use('/projects', projectRoutes);
router.use('/tasks', taskRoutes);
router.use('/settings', settingsRoutes);
router.use('/monitoring', monitoringRoutes);

// Legacy endpoints (will be moved to appropriate routes)
// For now, we'll keep compatibility by mounting the old routes

export default router;