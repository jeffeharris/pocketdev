import { Router } from 'express';
import * as projectController from '../controllers/project.controller.js';
import { TaskController } from '../controllers/task.controller.js';

const router = Router();

// Project CRUD operations
router.get('/', projectController.listProjects);
router.post('/', projectController.createProject);
router.get('/:projectId', projectController.getProject);
router.put('/:projectId', projectController.updateProject);
router.delete('/:projectId', projectController.deleteProject);

// Project-specific operations
router.post('/:projectId/branches', projectController.createBranch);
router.get('/:projectId/branches', projectController.listBranches);
router.post('/:projectId/sync', projectController.syncProject);

export default router;