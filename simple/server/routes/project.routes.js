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

// Git operations
router.post('/:projectId/fetch', projectController.fetchProject);
router.get('/:projectId/base-branch-status', projectController.getBaseBranchStatus);
router.post('/:projectId/pull-base-branch', projectController.pullBaseBranch);
router.post('/:projectId/push-base-branch', projectController.pushBaseBranch);
router.get('/:projectId/update-status', projectController.getUpdateStatus);

// Planning
router.get('/:projectId/planning', projectController.getProjectPlanning);
router.get('/:projectId/dashboard', projectController.getProjectDashboard);

export default router;