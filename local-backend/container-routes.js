import express from 'express';
import ContainerTaskManager from './lib/container-task-manager.js';

const router = express.Router();
const containerManager = new ContainerTaskManager();

// Initialize container manager on startup
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
    maxIterations = 5
  } = req.body;

  try {
    // Validate required fields
    if (!engineerId || !repository || !description) {
      return res.status(400).json({ 
        error: 'Missing required fields: engineerId, repository, description' 
      });
    }

    const task = await containerManager.assignTask(engineerId, {
      repository,
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
router.get('/api/container/tasks/:id', (req, res) => {
  const task = containerManager.getTask(req.params.id);
  if (task) {
    res.json(task);
  } else {
    res.status(404).json({ error: 'Task not found' });
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

export default router;