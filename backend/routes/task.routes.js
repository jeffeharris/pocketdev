import { Router } from 'express';
import { TaskController } from '../controllers/task.controller.js';
import { githubTokenMiddleware } from '../middleware/github-auth.middleware.js';

/**
 * Task routes - Consolidated version
 * All routes are relative to /api/projects/:projectId/tasks
 * 
 * This consolidated route file uses the unified TaskController
 * following the AI-assisted architecture principle of keeping
 * related concepts together.
 */
export default function createTaskRoutes(models, projectsDir) {
  const router = Router({ mergeParams: true }); // mergeParams to get projectId from parent router
  
  // Apply GitHub token middleware to all task routes
  router.use(githubTokenMiddleware);
  
  // Initialize the consolidated controller
  const taskController = new TaskController(models, projectsDir);

  // ===== Core CRUD Operations =====
  router.post('/', (req, res) => taskController.createTask(req, res));
  router.get('/minimal', (req, res) => taskController.getTasks(req, res));
  router.get('/', (req, res) => taskController.getTasks(req, res));
  router.get('/:taskId', (req, res) => taskController.getTask(req, res));
  router.patch('/:taskId', (req, res) => taskController.updateTaskMetadata(req, res));
  router.get('/:taskId/status', (req, res) => taskController.getTaskStatus(req, res));
  router.post('/:taskId/update', (req, res) => taskController.updateTask(req, res));
  router.get('/:taskId/check-delete', (req, res) => taskController.checkDelete(req, res));
  router.delete('/:taskId', (req, res) => taskController.deleteTask(req, res));

  // ===== Layout/UI State =====
  router.get('/:taskId/split-layout', (req, res) => taskController.getSplitLayout(req, res));
  router.put('/:taskId/split-layout', (req, res) => taskController.updateSplitLayout(req, res));

  // ===== Git Operations =====
  router.post('/:taskId/git', (req, res) => taskController.gitOperation(req, res)); // Legacy
  router.get('/:taskId/git/status', (req, res) => taskController.getGitStatus(req, res));
  router.get('/:taskId/files/changed', (req, res) => taskController.getChangedFiles(req, res));
  router.get('/:taskId/git/all-changes', (req, res) => taskController.getAllChanges(req, res));
  router.get('/:taskId/git/diff', (req, res) => taskController.getTaskDiff(req, res));
  router.get('/:taskId/git/diff/:file(*)', (req, res) => taskController.getFileDiff(req, res));
  router.get('/:taskId/git/commits', (req, res) => taskController.getCommitHistory(req, res));
  router.get('/:taskId/git/check-conflicts', (req, res) => taskController.checkConflicts(req, res));
  router.post('/:taskId/check-merge-conflicts', (req, res) => taskController.checkMergeConflicts(req, res));
  router.post('/:taskId/merge-to-base', (req, res) => taskController.mergeToBase(req, res));

  // ===== Pull Request Operations =====
  router.post('/:taskId/pr/create', (req, res) => taskController.createPullRequest(req, res));
  router.post('/:taskId/pr/merge', (req, res) => taskController.mergePullRequest(req, res));
  router.get('/:taskId/pr/status', (req, res) => taskController.getPullRequestStatus(req, res));

  // ===== Container Operations (Future Implementation) =====
  router.post('/:taskId/deploy', (req, res) => taskController.deployContainers(req, res));
  router.delete('/:taskId/containers', (req, res) => taskController.stopContainers(req, res));
  router.get('/:taskId/services', (req, res) => taskController.getServices(req, res));
  router.get('/:taskId/preview-url', (req, res) => taskController.getPreviewUrl(req, res));
  router.get('/:taskId/container-logs', (req, res) => taskController.getContainerLogs(req, res));

  return router;
}