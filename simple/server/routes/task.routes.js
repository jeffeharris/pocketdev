import { Router } from 'express';
import { TaskController } from '../controllers/task.controller.js';

/**
 * Task routes
 * All routes are relative to /api/projects/:projectId/tasks
 */
export default function createTaskRoutes(models, projectsDir) {
  const router = Router({ mergeParams: true }); // mergeParams to get projectId from parent router
  const taskController = new TaskController(models, projectsDir);

  // Create a new task
  router.post('/', (req, res) => taskController.createTask(req, res));

  // List all tasks for a project
  router.get('/', (req, res) => taskController.listTasks(req, res));

  // Get task details
  router.get('/:taskId', (req, res) => taskController.getTask(req, res));

  // Git operations on task
  router.post('/:taskId/git', (req, res) => taskController.gitOperation(req, res));

  // Check if task can be deleted
  router.get('/:taskId/check-delete', (req, res) => taskController.checkDelete(req, res));

  // Delete or archive task
  router.delete('/:taskId', (req, res) => taskController.deleteTask(req, res));

  // Update task with remote changes
  router.post('/:taskId/update', (req, res) => taskController.updateTask(req, res));

  // Check merge conflicts
  router.post('/:taskId/check-merge-conflicts', (req, res) => taskController.checkMergeConflicts(req, res));

  // Merge task into base branch
  router.post('/:taskId/merge-to-base', (req, res) => taskController.mergeToBase(req, res));

  return router;
}