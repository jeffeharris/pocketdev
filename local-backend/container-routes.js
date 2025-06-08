import express from 'express';
import ContainerTaskManager from './lib/container-task-manager.js';
import { getActiveProject, getProjectConfig } from './project-routes.js';
import { db } from './db/index.js';
import { tasks, taskEvents, engineerProfiles, projects } from './db/schema.js';
import { eq, desc } from 'drizzle-orm';
import SmartTaskRouter from './lib/smart-task-router.js';
import { prepareTaskAssignment } from './lib/task-assignment-handler.js';

const router = express.Router();
console.log('Container routes: Creating ContainerTaskManager...');
const containerManager = new ContainerTaskManager();
const smartRouter = new SmartTaskRouter();

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

// Get recovery suggestions for a failed task
router.get('/api/container/tasks/:id/recovery', async (req, res) => {
  try {
    const suggestions = containerManager.getRecoverySuggestions(req.params.id);
    if (!suggestions) {
      return res.status(404).json({ error: 'No recovery suggestions available' });
    }
    res.json(suggestions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Retry a failed task with recovery
router.post('/api/container/tasks/:id/retry', async (req, res) => {
  try {
    const { gitUsername, gitToken, ...otherContext } = req.body;
    
    const newTask = await containerManager.retryTaskWithRecovery(req.params.id, {
      gitUsername,
      gitToken,
      ...otherContext
    });
    
    res.json({
      success: true,
      newTaskId: newTask.id,
      message: 'Task retry started with recovery configuration'
    });
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
    branch,
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
    
    try {
      // Use shared function for credential handling
      const preparedTask = prepareTaskAssignment(
        activeProject, 
        projectConfigService,
        {
          repository,
          branch,
          gitUsername,
          gitToken,
          description,
          acceptanceCriteria,
          testFramework,
          model,
          maxIterations
        }
      );
      
      const task = await containerManager.assignTask(engineerId, preparedTask);
      
      res.json({
        success: true,
        task
      });
    } catch (error) {
      if (error.message.includes('credentials')) {
        return res.status(400).json({ error: error.message });
      }
      throw error;
    }

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
router.get('/api/container/completed-tasks', async (req, res) => {
  try {
    // Get tasks from database with related data
    const dbTasks = await db.query.tasks.findMany({
      with: {
        engineerProfile: true,
        project: true,
        events: {
          orderBy: (events, { asc }) => [asc(events.createdAt)]
        }
      },
      orderBy: (tasks, { desc }) => [desc(tasks.createdAt)],
      limit: 100
    });
    
    // Also get in-memory running tasks
    const engineers = containerManager.getAllEngineers();
    const runningTasks = [];
    
    for (const engineer of engineers) {
      if (engineer.currentTask) {
        const task = containerManager.tasks.get(engineer.currentTask);
        if (task && (task.status === 'running' || task.status === 'initializing')) {
          runningTasks.push({
            id: task.id,
            engineerId: engineer.id,
            engineerName: engineer.name,
            engineerRole: engineer.role,
            task: task.description,
            status: 'running',
            result: 'Task in progress...',
            cost: 0,
            duration: Date.now() - new Date(task.startTime).getTime(),
            sessionId: task.sessionId,
            filesCreated: [],
            completedAt: null,
            model: task.model || 'claude-3-5-sonnet-latest',
            isContainer: true,
            isRunning: true,
            repository: task.repository,
            startTime: task.startTime
          });
        }
      }
    }
    
    // Transform database tasks to API format
    const dbTasksFormatted = dbTasks.map(task => ({
      id: task.id,
      engineerId: task.engineerProfileId,
      engineerName: task.engineerProfile?.name || 'Unknown',
      engineerRole: task.engineerProfile?.role || 'unknown',
      task: task.description,
      status: task.status === 'accepted' ? 'complete' : 
              task.status === 'failed' ? 'error' : 
              task.status === 'in_progress' ? 'running' : 
              task.status,
      result: task.resultSummary || '',
      cost: task.costUsd || 0,
      duration: task.durationMs || 0,
      sessionId: task.sessionId,
      filesCreated: (task.filesChanged || []).map(f => ({ 
        filename: f, 
        size: 0 
      })),
      completedAt: task.completedAt ? task.completedAt.toISOString() : null,
      model: 'claude-3-5-sonnet-latest',
      isContainer: true,
      isRunning: task.status === 'in_progress',
      prUrl: task.prUrl,
      featureBranch: task.featureBranch,
      repository: task.project?.repositoryUrl,
      testResults: task.testResults,
      suggestedNextSteps: [],
      startTime: task.startedAt || task.createdAt,
      reviewStatus: task.reviewStatus,
      acceptanceCriteria: task.acceptanceCriteria
    }));
    
    // Combine and return all tasks
    const allTasks = [...runningTasks, ...dbTasksFormatted];
    res.json(allTasks);
    
  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
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

// Quick task assignment - The Magic Experience ✨
router.post('/api/container/quick-task', async (req, res) => {
  try {
    const { description, type = 'feature', urgency = 'normal' } = req.body;
    
    if (!description) {
      return res.status(400).json({ error: 'Task description required' });
    }
    
    // Get active project
    const activeProject = getActiveProject();
    if (!activeProject?.config) {
      return res.status(400).json({ 
        error: 'No active project. Please configure a project first.' 
      });
    }
    
    // Smart routing - pick the best engineer automatically
    const engineerRole = smartRouter.routeTask(description);
    
    // Find an available engineer of that role
    const engineers = containerManager.getAllEngineers();
    const availableEngineer = engineers.find(e => 
      e.role === engineerRole && e.status === 'idle'
    ) || engineers.find(e => e.status === 'idle'); // Fallback to any available
    
    if (!availableEngineer) {
      return res.status(503).json({ 
        error: 'No available engineers. All are currently busy.',
        suggestedRole: engineerRole
      });
    }
    
    // Generate smart acceptance criteria
    const acceptanceCriteria = smartRouter.generateAcceptanceCriteria(description, type);
    
    // Enhance the description with inferred details
    const enhancedDescription = smartRouter.enhanceDescription(description, {
      framework: activeProject.config.project.framework || 'unknown'
    });
    
    // Estimate complexity
    const { complexity, estimatedMinutes } = smartRouter.estimateComplexity(description, type);
    
    // Use shared function for credential handling
    const projectConfig = getProjectConfig();
    
    try {
      const preparedTask = prepareTaskAssignment(
        activeProject,
        projectConfig,
        {
          repository: activeProject.config.project.repository,
          branch: activeProject.config.project.default_branch || 'main',
          description: enhancedDescription,
          acceptanceCriteria,
          model: availableEngineer.role === 'qa_manual' ? 'claude-sonnet-4-0' : 'claude-sonnet-4-0'
        }
      );
      
      const taskResult = await containerManager.assignTask(availableEngineer.id, preparedTask);
      
      // Return simplified response focused on the experience
      res.json({
        success: true,
        task: {
          id: taskResult.id,
          description: description, // Original, not enhanced
          assignedTo: {
            name: availableEngineer.name,
            role: availableEngineer.role
          },
          estimatedMinutes,
          complexity,
          status: 'started'
        },
        message: `${availableEngineer.name} is working on your ${type}. Estimated time: ${estimatedMinutes} minutes.`
      });
    } catch (error) {
      if (error.message.includes('credentials')) {
        return res.status(400).json({ 
          error: error.message,
          hint: 'Please configure project credentials in settings'
        });
      }
      throw error;
    }
    
  } catch (error) {
    console.error('Quick task assignment error:', error);
    res.status(500).json({ 
      error: 'Failed to assign task',
      details: error.message 
    });
  }
});

// Get simplified task status for mobile UI
router.get('/api/container/quick-status/:taskId', async (req, res) => {
  try {
    const task = await containerManager.getTaskStatus(req.params.taskId);
    
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Simplify the response for mobile consumption
    const engineer = containerManager.getEngineerByTaskId(req.params.taskId);
    
    res.json({
      id: task.id,
      status: task.status,
      description: task.description,
      engineer: engineer ? {
        name: engineer.name,
        role: engineer.role
      } : null,
      progress: task.progress || 0,
      currentStep: task.currentStep || 'Analyzing requirements...',
      result: task.result || null,
      canReview: task.status === 'completed' && task.result?.success
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Failed to get task status' });
  }
});

export default router;