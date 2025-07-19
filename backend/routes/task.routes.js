import { Router } from 'express';
import { TaskController } from '../controllers/task.controller.js';
import { TaskGitController } from '../controllers/task-git.controller.js';
import { TaskPullRequestController } from '../controllers/task-pr.controller.js';
import { TaskContainerController } from '../controllers/task-container.controller.js';
import { githubTokenMiddleware } from '../middleware/github-auth.middleware.js';

/**
 * Task routes
 * All routes are relative to /api/projects/:projectId/tasks
 */
export default function createTaskRoutes(models, projectsDir) {
  const router = Router({ mergeParams: true }); // mergeParams to get projectId from parent router
  
  // Apply GitHub token middleware to all task routes
  router.use(githubTokenMiddleware);
  
  // Initialize controllers
  const taskController = new TaskController(models, projectsDir);
  const gitController = new TaskGitController(models);
  const prController = new TaskPullRequestController(models);
  const containerController = new TaskContainerController(models);

  // Create a new task
  router.post('/', (req, res) => taskController.createTask(req, res));
  
  // List minimal task info for fast loading (must be before base route)
  router.get('/minimal', (req, res) => taskController.listTasksMinimal(req, res));

  // List all tasks for a project (with full git status)
  router.get('/', (req, res) => taskController.listTasks(req, res));

  // Get task details
  router.get('/:taskId', (req, res) => taskController.getTask(req, res));

  // Update task metadata (name, description, etc.)
  router.patch('/:taskId', (req, res) => taskController.updateTaskMetadata(req, res));

  // Get task status (for real-time updates)
  router.get('/:taskId/status', (req, res) => taskController.getTaskStatus(req, res));

  // Git operations on task (legacy endpoint)
  router.post('/:taskId/git', (req, res) => gitController.gitOperation(req, res));

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

  // ===== Git Status and File Operations =====
  
  // Get detailed git status
  router.get('/:taskId/git/status', (req, res) => gitController.getGitStatus(req, res));
  
  // Get changed files with diff details
  router.get('/:taskId/files/changed', (req, res) => gitController.getChangedFiles(req, res));
  
  // Get all changes (working tree + committed not in base)
  router.get('/:taskId/git/all-changes', (req, res) => gitController.getAllChanges(req, res));
  
  // Get full diff for all changes in the task
  router.get('/:taskId/git/diff', (req, res) => gitController.getTaskDiff(req, res));
  
  // Get diff for a specific file
  router.get('/:taskId/git/diff/:file(*)', (req, res) => gitController.getFileDiff(req, res));
  
  // Get commit history for the task
  router.get('/:taskId/git/commits', (req, res) => gitController.getCommitHistory(req, res));
  
  // Check for merge conflicts (simplified endpoint)
  router.get('/:taskId/git/check-conflicts', (req, res) => gitController.checkConflicts(req, res));
  
  // ===== Pull Request Operations =====
  
  // Create pull request
  router.post('/:taskId/pr/create', (req, res) => prController.createPullRequest(req, res));
  
  // Merge pull request
  router.post('/:taskId/pr/merge', (req, res) => prController.mergePullRequest(req, res));
  
  // Get PR status
  router.get('/:taskId/pr/status', (req, res) => prController.getPullRequestStatus(req, res));
  
  // ===== Container Operations (Future Implementation) =====
  
  // Deploy containers for validation
  router.post('/:taskId/deploy', (req, res) => containerController.deployContainers(req, res));
  
  // Stop containers
  router.delete('/:taskId/containers', (req, res) => containerController.stopContainers(req, res));
  
  // Get running services
  router.get('/:taskId/services', (req, res) => containerController.getServices(req, res));
  
  // Get preview URL
  router.get('/:taskId/preview-url', (req, res) => containerController.getPreviewUrl(req, res));
  
  // Get container logs
  router.get('/:taskId/container-logs', (req, res) => containerController.getContainerLogs(req, res));

  return router;
}