import express from 'express';
import ContainerTaskManager from './lib/container-task-manager.js';
import { getActiveProject, getProjectConfig } from './project-routes.js';

const router = express.Router();
console.log('Container routes: Creating ContainerTaskManager...');
const containerManager = new ContainerTaskManager();

// Initialize container manager on startup
console.log('Container routes: Initializing container manager...');
containerManager.init().catch(console.error);

// Build Docker image if needed
router.post('/api/container/build-image', async (req, res) => {
  try {
    await containerManager.buildImage();
    res.json({ success: true, message: 'Docker image built successfully' });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Get all container-based engineers
router.get('/api/container/engineers', (req, res) => {
  const engineers = containerManager.getAllEngineers();
  res.json(engineers);
});

// Get specific engineer status
router.get('/api/container/engineers/:id', (req, res) => {
  const engineer = containerManager.getEngineerStatus(req.params.id);
  if (engineer) {
    res.json(engineer);
  } else {
    res.status(404).json({ error: 'Engineer not found' });
  }
});

// Assign containerized task
router.post('/api/container/assign-task', async (req, res) => {
  const { 
    engineerId, 
    repository,
    description,
    acceptanceCriteria = [],
    testFramework = 'jest',
    model = 'claude-3-5-sonnet-latest',
    maxIterations = 5,
    gitUsername,
    gitToken
  } = req.body;

  try {
    // Validate required fields
    if (!engineerId || !repository || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: engineerId, repository, description' 
      });
    }

    console.log('Container route: Assigning task to', engineerId);
    
    // Get active project config
    const activeProject = getActiveProject();
    const projectConfigService = getProjectConfig();
    
    // Format repository with credentials
    let repoConfig = repository;
    let finalCredentials = { username: gitUsername, token: gitToken };
    
    // If no credentials provided, try to use active project
    if (!gitUsername || !gitToken) {
      if (activeProject.config) {
        const projectCreds = projectConfigService.getCredentials(activeProject.config);
        if (projectCreds) {
          finalCredentials = projectCreds;
          // Use repository from active project if not provided
          if (!repository && activeProject.config.project.repository) {
            repoConfig = activeProject.config.project.repository;
          }
        }
      }
    }
    
    // Format for container orchestrator
    if (finalCredentials.username && finalCredentials.token) {
      repoConfig = {
        url: repoConfig,
        credentials: finalCredentials
      };
    } else {
      return res.status(400).json({
        error: 'No credentials available. Configure project settings or provide credentials.'
      });
    }
    
    const task = await containerManager.assignTask(engineerId, {
      repository: repoConfig,
      description,
      acceptanceCriteria,
      testFramework,
      model,
      maxIterations
    });

    res.json({
      success: true,
      task
    });

  } catch (error) {
    console.error('Container task assignment error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Continue an existing task
router.post('/api/container/continue-task', async (req, res) => {
  const { taskId, additionalInstructions } = req.body;

  try {
    if (!taskId || !additionalInstructions) {
      return res.status(400).json({ 
        error: 'Missing required fields: taskId, additionalInstructions' 
      });
    }

    const continuationTask = await containerManager.continueTask(
      taskId, 
      additionalInstructions
    );

    res.json({
      success: true,
      task: continuationTask
    });

  } catch (error) {
    console.error('Task continuation error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get task details
router.get('/api/container/tasks/:id', async (req, res) => {
  const task = await containerManager.getTask(req.params.id);
  if (task) {
    res.json(task);
  } else {
    res.status(404).json({ error: 'Task not found' });
  }
});

// Get task result JSON
router.get('/api/container/tasks/:id/result', async (req, res) => {
  const task = await containerManager.getTask(req.params.id);
  if (!task || !task.result || !task.result.workspacePath) {
    return res.status(404).json({ error: 'Task result not found' });
  }
  
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const resultPath = path.join(task.result.workspacePath, 'results', 'session_result.json');
    const resultData = await fs.readFile(resultPath, 'utf8');
    const result = JSON.parse(resultData);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to read task result' });
  }
});

// Accept task and commit changes
router.post('/api/container/tasks/:id/accept', async (req, res) => {
  const task = await containerManager.getTask(req.params.id);
  if (!task || !task.result) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  try {
    // Signal container to commit and shutdown
    await containerManager.acceptTask(req.params.id);
    res.json({ success: true, message: 'Task accepted and committed' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept task' });
  }
});

// Get task history for an engineer
router.get('/api/container/engineers/:id/history', (req, res) => {
  const history = containerManager.getTaskHistory(req.params.id);
  res.json(history);
});

// Stop a running task
router.post('/api/container/tasks/:id/stop', async (req, res) => {
  try {
    const stopped = await containerManager.stopTask(req.params.id);
    if (stopped) {
      res.json({ success: true, message: 'Task stopped' });
    } else {
      res.status(404).json({ error: 'Task not found or not running' });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Reset engineer in error state
router.post('/api/container/engineers/:id/reset', (req, res) => {
  const reset = containerManager.resetEngineer(req.params.id);
  if (reset) {
    res.json({ success: true, message: 'Engineer reset to idle' });
  } else {
    res.status(404).json({ error: 'Engineer not found' });
  }
});

// Cleanup old workspaces
router.post('/api/container/cleanup', async (req, res) => {
  const { olderThanHours = 24 } = req.body;
  
  try {
    await containerManager.cleanup(olderThanHours);
    res.json({ 
      success: true, 
      message: `Cleaned up workspaces older than ${olderThanHours} hours` 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// Get active containers
router.get('/api/container/active', (req, res) => {
  const activeContainers = containerManager.orchestrator.getActiveContainers();
  res.json(activeContainers);
});

// Get all tasks (running and completed) for task history
router.get('/api/container/completed-tasks', (req, res) => {
  const allTasks = [];
  const engineers = containerManager.getAllEngineers();
  
  for (const engineer of engineers) {
    const history = containerManager.getTaskHistory(engineer.id);
    for (const item of history) {
      if (item.task) {
        // Include both running and completed tasks
        const isRunning = item.task.status === 'running' || item.task.status === 'initializing';
        const taskData = {
          id: item.taskId,
          engineerId: engineer.id,
          engineerName: engineer.name,
          engineerRole: engineer.role,
          task: item.task.description || item.task.taskDescription,
          status: isRunning ? 'running' : (item.task.status === 'completed' ? 'complete' : 'error'),
          result: item.task.result?.summary || (isRunning ? 'Task in progress...' : ''),
          cost: item.task.result?.cost_usd || item.cost || 0,
          duration: item.task.result?.duration ? item.task.result.duration * 1000 : 
                   (isRunning && item.startTime ? Date.now() - new Date(item.startTime).getTime() : 0),
          sessionId: item.task.result?.sessionId || item.task.sessionId,
          filesCreated: (item.task.result?.filesChanged || []).map(f => ({ 
            filename: f, 
            size: 0 
          })),
          completedAt: item.endTime || item.task.result?.timestamp || 
                      (isRunning ? null : new Date().toISOString()),
          model: item.task.result?.model || item.task.model || 'claude-3-5-sonnet-latest',
          isContainer: true,
          isRunning: isRunning,
          prUrl: item.task.result?.prUrl,
          featureBranch: item.task.result?.featureBranch || item.task.featureBranch,
          repository: item.task.repository,
          testResults: item.task.result?.testResults,
          suggestedNextSteps: item.task.result?.suggestedNextSteps || [],
          startTime: item.startTime
        };
        allTasks.push(taskData);
      }
    }
  }
  
  res.json(allTasks);
});

// Debug endpoint to test orchestrator directly
router.get('/api/container/test-direct', async (req, res) => {
  try {
    console.error('TEST: Direct orchestrator test');
    process.stderr.write('[TEST] Direct orchestrator test endpoint called\n');
    
    const testTask = {
      id: 'test-' + Date.now(),
      repository: 'https://github.com/octocat/Hello-World.git',
      description: 'Test task',
      engineerRole: 'frontend'
    };
    
    process.stderr.write('[TEST] Calling orchestrator.executeTask\n');
    const result = await containerManager.orchestrator.executeTask(testTask);
    res.json({ success: true, result });
  } catch (error) {
    console.error('TEST: Orchestrator error:', error);
    process.stderr.write(`[TEST] Error: ${error.message}\n`);
    res.status(500).json({ success: false, error: error.message, stack: error.stack });
  }
});

export default router;