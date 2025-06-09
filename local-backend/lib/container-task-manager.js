import ContainerOrchestrator from './container-orchestrator.js';
import TaskRecoveryManager from './task-recovery-manager.js';
import { ErrorInterpreter } from './error-interpreter.js';
import ClaudeStreamExecutor from './claude-stream-executor.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { db } from '../db/index.js';
import { tasks, taskEvents, engineerProfiles, projects } from '../db/schema.js';
import { eq } from 'drizzle-orm';

class ContainerTaskManager {
  constructor() {
    console.error('[CTM] Creating ContainerOrchestrator instance');
    this.orchestrator = new ContainerOrchestrator();
    console.error('[CTM] ContainerOrchestrator created:', !!this.orchestrator);
    console.error('[CTM] executeTask method exists:', typeof this.orchestrator.executeTask);
    this.tasks = new Map();
    this.engineers = new Map();
    this.recoveryManager = new TaskRecoveryManager();
    this.errorInterpreter = new ErrorInterpreter();
    this.streamExecutor = null; // Will be initialized when needed
    this.eventHandlers = new Map(); // Store WebSocket handlers
  }

  async init() {
    await this.orchestrator.init();
    
    // Load engineers from database
    const dbEngineers = await db.select().from(engineerProfiles);
    
    for (const engineer of dbEngineers) {
      this.registerEngineer(engineer.id, {
        name: engineer.name,
        role: engineer.role,
        systemPrompt: engineer.baseSystemPrompt || engineer.customInstructions,
        // Database stats
        totalTasks: engineer.totalTasks,
        successfulTasks: engineer.successfulTasks,
        averageDurationMs: engineer.averageDurationMs,
        averageTurns: engineer.averageTurns,
        totalCostUsd: engineer.totalCostUsd
      });
    }
    
    console.error(`[CTM] Loaded ${dbEngineers.length} engineers from database`);
  }

  /**
   * Register an AI engineer
   */
  registerEngineer(id, config) {
    this.engineers.set(id, {
      id,
      ...config,
      status: 'idle',
      currentTask: null,
      taskHistory: []
    });
  }

  /**
   * Assign a containerized task to an engineer
   */
  async assignTask(engineerId, taskConfig) {
    const engineer = this.engineers.get(engineerId);
    if (!engineer) {
      throw new Error(`Engineer ${engineerId} not found`);
    }

    if (engineer.status !== 'idle') {
      throw new Error(`Engineer ${engineerId} is ${engineer.status}`);
    }

    // Get or create project based on repository
    let projectId = null;
    if (taskConfig.repository) {
      const repoUrl = typeof taskConfig.repository === 'string' 
        ? taskConfig.repository 
        : taskConfig.repository.url;
      
      // Check if project exists
      const [existingProject] = await db.select()
        .from(projects)
        .where(eq(projects.repositoryUrl, repoUrl))
        .limit(1);
      
      if (existingProject) {
        projectId = existingProject.id;
        // Update last activity
        await db.update(projects)
          .set({ lastActivityAt: new Date() })
          .where(eq(projects.id, projectId));
      } else {
        // Create new project
        const [newProject] = await db.insert(projects).values({
          name: repoUrl.split('/').pop().replace('.git', ''),
          repositoryUrl: repoUrl,
          defaultBranch: taskConfig.repository.branch || 'main'
        }).returning();
        projectId = newProject.id;
      }
    }

    // Create task in database
    const taskId = uuidv4();
    const [dbTask] = await db.insert(tasks).values({
      id: taskId,
      projectId,
      engineerProfileId: engineerId,
      title: taskConfig.description.substring(0, 100),
      description: taskConfig.description,
      acceptanceCriteria: taskConfig.acceptanceCriteria || [],
      status: 'queued',
      priority: 0,
      baseBranch: taskConfig.repository?.branch || 'main',
      createdAt: new Date()
    }).returning();

    // Create task event
    await db.insert(taskEvents).values({
      taskId: taskId,
      eventType: 'created',
      eventData: { engineerId, repository: taskConfig.repository },
      createdAt: new Date()
    });

    // Create in-memory task
    const task = {
      id: taskId,
      engineerId,
      engineerRole: engineer.role,
      systemPrompt: engineer.systemPrompt,
      ...taskConfig,
      status: 'initializing',
      startTime: new Date()
    };

    // Update engineer status
    engineer.status = 'busy';
    engineer.currentTask = task.id;
    engineer.currentTaskDetails = task;
    this.tasks.set(task.id, task);
    
    // Add to engineer's task history immediately
    engineer.taskHistory.push({
      taskId: task.id,
      startTime: task.startTime,
      status: 'running'
    });

    // Execute in container
    try {
      task.status = 'running';
      
      // Update database status to in_progress
      await db.update(tasks)
        .set({ 
          status: 'in_progress',
          startedAt: new Date(),
          containerId: `container-${task.id}`, // Will be updated with real container ID
          sessionId: task.id
        })
        .where(eq(tasks.id, task.id));
      
      // Create started event
      await db.insert(taskEvents).values({
        taskId: task.id,
        eventType: 'started',
        eventData: {},
        createdAt: new Date()
      });
      
      process.stderr.write(`[CTM] About to call orchestrator.executeTask for task ${task.id}\n`);
      console.error('[CTM] About to call orchestrator.executeTask');
      console.error('[CTM] Task config:', JSON.stringify(taskConfig, null, 2));
      
      const result = await this.orchestrator.executeTask({
        ...task,
        repository: taskConfig.repository,
        description: taskConfig.description,
        acceptanceCriteria: taskConfig.acceptanceCriteria,
        testFramework: taskConfig.testFramework,
        model: taskConfig.model
      });

      // If pre-flight validation failed, return the error immediately
      if (result.preflightFailed) {
        // Get natural language interpretation
        const interpretation = this.errorInterpreter.interpretValidationErrors(result);
        
        // Update task status in database
        await db.update(tasks)
          .set({
            status: 'failed',
            completedAt: new Date(),
            durationMs: result.duration,
            errorMessage: result.error,
            resultSummary: interpretation ? interpretation.summary : 'Pre-flight validation failed'
          })
          .where(eq(tasks.id, task.id));
        
        // Create failure event with interpretation
        await db.insert(taskEvents).values({
          taskId: task.id,
          eventType: 'preflight_failed',
          eventData: {
            validationErrors: result.validationErrors,
            validationWarnings: result.validationWarnings,
            interpretation: interpretation
          },
          createdAt: new Date()
        });
        
        // Update engineer status
        engineer.status = 'idle';
        engineer.currentTask = null;
        engineer.currentTaskDetails = null;
        
        // Add interpretation to the result
        if (interpretation) {
          result.naturalLanguageError = interpretation;
          result.humanFriendlyMessage = `${interpretation.summary}\n\n${interpretation.explanation}`;
        }
        
        // Return the validation error
        task.status = 'failed';
        task.endTime = new Date();
        task.result = result;
        
        return task;
      }

      // Update task with results
      task.status = result.success ? 'completed' : 'failed';
      task.endTime = new Date();
      task.result = result;
      task.sessionId = result.sessionId;
      task.prUrl = result.prUrl;
      task.cost = result.cost_usd;
      
      // Update database with results
      await db.update(tasks)
        .set({
          status: result.success ? 'awaiting_review' : 'failed',
          completedAt: new Date(),
          durationMs: new Date().getTime() - task.startTime.getTime(),
          costUsd: result.cost_usd,
          tokensInput: result.total_tokens_in,
          tokensOutput: result.total_tokens_out,
          numTurns: result.iterations || 0,
          resultSummary: result.summary,
          filesChanged: result.filesChanged || [],
          testResults: result.testResults || {},
          errorMessage: result.error,
          prUrl: result.prUrl,
          featureBranch: result.featureBranch,
          commitHash: result.commitHash
        })
        .where(eq(tasks.id, task.id));
      
      // Create completed event
      await db.insert(taskEvents).values({
        taskId: task.id,
        eventType: result.success ? 'completed' : 'failed',
        eventData: {
          success: result.success,
          summary: result.summary,
          cost: result.cost_usd
        },
        createdAt: new Date()
      });

      // Check if task failed and can be recovered
      if (!result.success && result.logs) {
        const failureAnalysis = this.recoveryManager.analyzeFailure(task, result.logs);
        
        if (failureAnalysis.recoverable) {
          // Store recovery information
          task.recoveryPlan = this.recoveryManager.generateRecoveryPlan(task, failureAnalysis);
          
          // Create recovery event
          await db.insert(taskEvents).values({
            taskId: task.id,
            eventType: 'recovery_available',
            eventData: {
              failureType: failureAnalysis.failureType,
              suggestions: failureAnalysis.suggestions,
              autoRecoveryAvailable: failureAnalysis.hasAutoRecovery
            },
            createdAt: new Date()
          });
        }
      }

      // Update engineer
      engineer.status = 'idle';
      engineer.currentTask = null;
      engineer.currentTaskDetails = null;
      
      // Update existing task history entry
      const historyEntry = engineer.taskHistory.find(h => h.taskId === task.id);
      if (historyEntry) {
        historyEntry.endTime = task.endTime;
        historyEntry.status = task.status;
        historyEntry.success = result.success;
        historyEntry.cost = result.cost_usd;
      } else {
        // Fallback: create new entry if not found
        engineer.taskHistory.push({
          taskId: task.id,
          startTime: task.startTime,
          endTime: task.endTime,
          status: task.status,
          success: result.success,
          cost: result.cost_usd
        });
      }

      return task;

    } catch (error) {
      task.status = 'error';
      task.error = error.message;
      task.endTime = new Date();
      
      // Update database with error
      await db.update(tasks)
        .set({
          status: 'failed',
          completedAt: new Date(),
          durationMs: new Date().getTime() - task.startTime.getTime(),
          errorMessage: error.message
        })
        .where(eq(tasks.id, task.id));
      
      // Create error event
      await db.insert(taskEvents).values({
        taskId: task.id,
        eventType: 'failed',
        eventData: {
          error: error.message,
          stack: error.stack
        },
        createdAt: new Date()
      });
      
      engineer.status = 'error';
      engineer.currentTask = null;
      engineer.currentTaskDetails = null;
      
      // Update existing task history entry
      const historyEntry = engineer.taskHistory.find(h => h.taskId === task.id);
      if (historyEntry) {
        historyEntry.endTime = task.endTime;
        historyEntry.status = 'error';
        historyEntry.error = error.message;
      }
      
      throw error;
    }
  }

  /**
   * Continue a task with additional instructions
   */
  async continueTask(taskId, additionalInstructions) {
    const originalTask = this.tasks.get(taskId);
    if (!originalTask) {
      throw new Error(`Cannot continue task ${taskId} - task not found`);
    }

    // Write follow-up task and signal
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const workspacePath = originalTask.result?.workspacePath;
    if (!workspacePath) {
      throw new Error('No workspace path found for task');
    }
    
    // Write the follow-up task
    const followupPath = path.join(workspacePath, 'results', 'followup_task.txt');
    await fs.writeFile(followupPath, additionalInstructions);
    
    // Signal the container to continue
    await this.orchestrator.signalContainer(taskId, 'CONTINUE');
    
    // Update engineer status
    const engineer = this.engineers.get(originalTask.engineerId);
    if (engineer) {
      engineer.status = 'busy';
      engineer.currentTask = taskId;
    }
    
    // Return immediately - the container will handle the rest
    return {
      success: true,
      message: 'Follow-up task sent to container',
      taskId: taskId
    };
  }

  /**
   * Get engineer status
   */
  getEngineerStatus(engineerId) {
    const engineer = this.engineers.get(engineerId);
    if (!engineer) return null;

    return {
      ...engineer,
      currentTaskDetails: engineer.currentTask ? 
        this.tasks.get(engineer.currentTask) : null
    };
  }

  /**
   * Get all engineers
   */
  getAllEngineers() {
    return Array.from(this.engineers.values()).map(eng => ({
      ...eng,
      currentTaskDetails: eng.currentTask ? 
        this.tasks.get(eng.currentTask) : null
    }));
  }

  /**
   * Get task details
   */
  async getTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return null;
    
    // If task is running, check if results are ready
    if (task.status === 'running') {
      const results = await this.orchestrator.checkTaskResults(taskId);
      if (results) {
        // Update task with results
        task.status = results.success ? 'completed' : 'failed';
        task.result = {
          ...results,
          workspacePath: path.join(this.orchestrator.workspaceBase, taskId)
        };
        task.endTime = new Date();
        
        // Update engineer status
        const engineer = this.engineers.get(task.engineerId);
        if (engineer && engineer.currentTask === taskId) {
          engineer.status = 'idle';
          engineer.currentTask = null;
        }
      } else {
        // Still running, get live logs
        const logs = this.orchestrator.getTaskLogs(taskId);
        if (!task.result) task.result = {};
        task.result.logs = logs;
      }
    }
    
    return task;
  }

  /**
   * Get task history for an engineer
   */
  getTaskHistory(engineerId) {
    const engineer = this.engineers.get(engineerId);
    if (!engineer) return [];

    return engineer.taskHistory.map(historyItem => ({
      ...historyItem,
      task: this.tasks.get(historyItem.taskId)
    }));
  }

  /**
   * Stop a running task
   */
  async stopTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    const success = await this.orchestrator.stopContainer(taskId);
    if (success) {
      task.status = 'cancelled';
      task.endTime = new Date();
      
      const engineer = this.engineers.get(task.engineerId);
      if (engineer) {
        engineer.status = 'idle';
        engineer.currentTask = null;
      }
    }

    return success;
  }

  /**
   * Reset an engineer in error state
   */
  resetEngineer(engineerId) {
    const engineer = this.engineers.get(engineerId);
    if (!engineer) return false;

    engineer.status = 'idle';
    engineer.currentTask = null;
    return true;
  }

  /**
   * Clean up old workspaces
   */
  async cleanup(olderThanHours = 24) {
    await this.orchestrator.cleanup(olderThanHours);
  }

  /**
   * Build Docker image
   */
  async buildImage() {
    await this.orchestrator.buildImage();
  }

  /**
   * Accept task and signal container to commit
   */
  async acceptTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || !task.result || !task.result.workspacePath) {
      throw new Error('Task not found or not completed');
    }

    // Signal container to commit and shutdown
    await this.orchestrator.signalContainer(taskId, 'SHUTDOWN');
    
    // Update task status
    task.accepted = true;
    task.acceptedAt = new Date();
    
    // Update database
    await db.update(tasks)
      .set({
        status: 'accepted',
        reviewStatus: 'approved',
        reviewedAt: new Date()
      })
      .where(eq(tasks.id, taskId));
    
    // Create accepted event
    await db.insert(taskEvents).values({
      taskId: taskId,
      eventType: 'accepted',
      eventData: {},
      createdAt: new Date()
    });
    
    // Update engineer metrics
    const engineer = this.engineers.get(task.engineerId);
    if (engineer) {
      engineer.status = 'idle';
      engineer.currentTask = null;
      
      // Update engineer stats in database
      await db.update(engineerProfiles)
        .set({
          totalTasks: engineer.totalTasks + 1,
          successfulTasks: engineer.successfulTasks + 1,
          totalCostUsd: engineer.totalCostUsd + (task.cost || 0)
        })
        .where(eq(engineerProfiles.id, task.engineerId));
    }
    
    return true;
  }

  /**
   * Retry a failed task with recovery options
   */
  async retryTaskWithRecovery(taskId, recoveryContext = {}) {
    const task = this.tasks.get(taskId);
    if (!task || !task.result || task.result.success) {
      throw new Error('Task not found or not in failed state');
    }

    // Analyze the failure
    const failureAnalysis = this.recoveryManager.analyzeFailure(task, task.result.logs || []);
    if (!failureAnalysis.recoverable) {
      throw new Error('Task failure is not recoverable');
    }

    // Attempt automatic recovery
    const recovery = await this.recoveryManager.attemptAutoRecovery(task, failureAnalysis, recoveryContext);
    if (!recovery || !recovery.success) {
      throw new Error('Automatic recovery not available for this failure type');
    }

    // Create retry event
    await db.insert(taskEvents).values({
      taskId: taskId,
      eventType: 'retry_started',
      eventData: {
        failureType: failureAnalysis.failureType,
        recoveryApplied: recovery.config
      },
      createdAt: new Date()
    });

    // Create a new task with recovery configuration
    const retryTask = {
      ...task,
      id: uuidv4(),
      parentTaskId: taskId,
      retryAttempt: (task.retryAttempt || 0) + 1,
      recoveryConfig: recovery.config,
      startTime: new Date(),
      status: 'pending',
      result: null
    };

    // Apply recovery configuration to environment
    const enhancedEnv = {
      ...task.environment,
      ...recovery.config
    };

    // Execute the retry
    return this.assignTask(task.engineerId, {
      description: task.description,
      repository: enhancedEnv.REPO_URL || task.repository,
      branch: task.branch,
      acceptanceCriteria: task.acceptanceCriteria,
      gitUsername: recoveryContext.gitUsername,
      gitToken: recoveryContext.gitToken,
      isRetry: true,
      parentTaskId: taskId,
      recoveryConfig: recovery.config
    });
  }

  /**
   * Check if a task can be recovered
   */
  isTaskRecoverable(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || !task.result) {
      return false;
    }
    return this.recoveryManager.isRecoverable(task);
  }

  /**
   * Get recovery suggestions for a failed task
   */
  getRecoverySuggestions(taskId) {
    const task = this.tasks.get(taskId);
    if (!task || !task.result || task.result.success) {
      return null;
    }

    const failureAnalysis = this.recoveryManager.analyzeFailure(task, task.result.logs || []);
    return this.recoveryManager.generateRecoveryPlan(task, failureAnalysis);
  }

  /**
   * Assign a task with streaming support
   * Similar to assignTask but uses ClaudeStreamExecutor for real-time updates
   */
  async assignStreamingTask(engineerId, taskConfig, eventCallback) {
    console.log('[CTM] assignStreamingTask called for engineer:', engineerId);
    console.log('[CTM] Task config:', taskConfig);
    
    const engineer = this.engineers.get(engineerId);
    if (!engineer) {
      console.error('[CTM] Engineer not found:', engineerId);
      console.error('[CTM] Available engineers:', Array.from(this.engineers.keys()));
      throw new Error(`Engineer ${engineerId} not found`);
    }

    if (engineer.status !== 'idle') {
      throw new Error(`Engineer ${engineerId} is ${engineer.status}`);
    }

    // Get or create project
    let projectId = null;
    if (taskConfig.repository) {
      const repoUrl = typeof taskConfig.repository === 'string' 
        ? taskConfig.repository 
        : taskConfig.repository.url;
      
      const [existingProject] = await db.select()
        .from(projects)
        .where(eq(projects.repositoryUrl, repoUrl))
        .limit(1);
      
      if (existingProject) {
        projectId = existingProject.id;
        await db.update(projects)
          .set({ lastActivityAt: new Date() })
          .where(eq(projects.id, projectId));
      } else {
        const [newProject] = await db.insert(projects).values({
          name: repoUrl.split('/').pop().replace('.git', ''),
          repositoryUrl: repoUrl,
          defaultBranch: taskConfig.repository.branch || 'main'
        }).returning();
        projectId = newProject.id;
      }
    }

    // Create task in database
    const taskId = uuidv4();
    const [dbTask] = await db.insert(tasks).values({
      id: taskId,
      projectId,
      engineerProfileId: engineerId,
      title: taskConfig.description.substring(0, 100),
      description: taskConfig.description,
      acceptanceCriteria: taskConfig.acceptanceCriteria || [],
      status: 'queued',
      priority: 0,
      baseBranch: taskConfig.repository?.branch || 'main',
      createdAt: new Date()
    }).returning();

    // Create task event
    await db.insert(taskEvents).values({
      taskId: taskId,
      eventType: 'created',
      eventData: { engineerId, repository: taskConfig.repository, streaming: true },
      createdAt: new Date()
    });

    // Create in-memory task
    const task = {
      id: taskId,
      engineerId,
      engineerRole: engineer.role,
      systemPrompt: engineer.systemPrompt,
      ...taskConfig,
      status: 'initializing',
      startTime: new Date(),
      streaming: true
    };

    // Update engineer status
    engineer.status = 'busy';
    engineer.currentTask = task.id;
    engineer.currentTaskDetails = task;
    this.tasks.set(task.id, task);

    // Store event callback
    if (eventCallback) {
      this.eventHandlers.set(taskId, eventCallback);
    }

    // Execute with streaming
    try {
      task.status = 'running';
      
      // Update database
      await db.update(tasks)
        .set({ 
          status: 'in_progress',
          startedAt: new Date()
        })
        .where(eq(tasks.id, task.id));

      // Initialize stream executor
      this.streamExecutor = new ClaudeStreamExecutor({
        maxTurns: taskConfig.maxTurns || 10,
        allowedTools: taskConfig.allowedTools || ['Read', 'Write', 'Edit', 'Bash', 'LS', 'Grep', 'Glob']
      });

      // Set up event listeners
      this.streamExecutor.on('init', (data) => {
        console.log('[CTM] Stream init:', data);
        if (eventCallback) {
          eventCallback({
            type: 'stream:init',
            taskId,
            data
          });
        }
      });

      this.streamExecutor.on('tool_use', (data) => {
        console.log('[CTM] Tool use:', data.name);
        if (eventCallback) {
          eventCallback({
            type: 'stream:tool_use',
            taskId,
            data
          });
        }
      });

      this.streamExecutor.on('assistant_text', (data) => {
        if (eventCallback) {
          eventCallback({
            type: 'stream:text',
            taskId,
            data
          });
        }
      });

      this.streamExecutor.on('complete', async (data) => {
        console.log('[CTM] Stream complete:', data);
        
        // Update database with results
        await db.update(tasks)
          .set({
            status: data.success ? 'awaiting_review' : 'failed',
            completedAt: new Date(),
            durationMs: data.duration,
            costUsd: data.cost,
            numTurns: data.turns,
            sessionId: data.sessionId
          })
          .where(eq(tasks.id, task.id));

        if (eventCallback) {
          eventCallback({
            type: 'stream:complete',
            taskId,
            data
          });
        }
      });

      // Execute the task
      console.log('[CTM] Starting streaming execution for task:', taskId);
      const result = await this.streamExecutor.executeStreamingTask(
        taskConfig.description,
        {
          systemPrompt: engineer.systemPrompt,
          workingDirectory: taskConfig.workingDirectory || process.cwd(),
          apiKey: process.env.ANTHROPIC_API_KEY,
          sessionId: taskConfig.sessionId
        }
      );

      // Update task with results
      task.status = result.success ? 'completed' : 'failed';
      task.endTime = new Date();
      task.result = result;
      task.sessionId = result.sessionId;
      task.cost = result.cost;

      // Update engineer status
      engineer.status = 'idle';
      engineer.currentTask = null;
      engineer.currentTaskDetails = null;

      // Clean up event handler
      this.eventHandlers.delete(taskId);

      return task;

    } catch (error) {
      console.error('[CTM] Streaming execution error:', error);
      
      // Update task status
      task.status = 'failed';
      task.endTime = new Date();
      task.error = error.message;

      // Update database
      await db.update(tasks)
        .set({
          status: 'failed',
          completedAt: new Date(),
          errorMessage: error.message
        })
        .where(eq(tasks.id, task.id));

      // Update engineer status
      engineer.status = 'idle';
      engineer.currentTask = null;
      engineer.currentTaskDetails = null;

      // Clean up
      this.eventHandlers.delete(taskId);

      throw error;
    }
  }
}

export default ContainerTaskManager;