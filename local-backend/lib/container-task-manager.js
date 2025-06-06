import ContainerOrchestrator from './container-orchestrator.js';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

class ContainerTaskManager {
  constructor() {
    console.error('[CTM] Creating ContainerOrchestrator instance');
    this.orchestrator = new ContainerOrchestrator();
    console.error('[CTM] ContainerOrchestrator created:', !!this.orchestrator);
    console.error('[CTM] executeTask method exists:', typeof this.orchestrator.executeTask);
    this.tasks = new Map();
    this.engineers = new Map();
  }

  async init() {
    await this.orchestrator.init();
    
    // Initialize default engineers
    this.registerEngineer('frontend-1', {
      name: 'Frontend Engineer',
      role: 'frontend',
      specialties: ['React', 'TypeScript', 'UI/UX'],
      systemPrompt: 'You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, accessibility, and user experience.'
    });

    this.registerEngineer('backend-1', {
      name: 'Backend Engineer', 
      role: 'backend',
      specialties: ['Node.js', 'Python', 'API Design'],
      systemPrompt: 'You are a backend architect specializing in scalable APIs. Focus on security, performance, and proper error handling.'
    });

    this.registerEngineer('devops-1', {
      name: 'DevOps Engineer',
      role: 'devops', 
      specialties: ['Docker', 'Kubernetes', 'CI/CD'],
      systemPrompt: 'You are a DevOps specialist. Focus on automation, monitoring, and infrastructure as code.'
    });
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

    // Create task
    const task = {
      id: uuidv4(),
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
    this.tasks.set(task.id, task);

    // Execute in container
    try {
      task.status = 'running';
      
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

      // Update task with results
      task.status = result.success ? 'completed' : 'failed';
      task.endTime = new Date();
      task.result = result;
      task.sessionId = result.sessionId;
      task.prUrl = result.prUrl;
      task.cost = result.cost_usd;

      // Update engineer
      engineer.status = 'idle';
      engineer.currentTask = null;
      engineer.taskHistory.push({
        taskId: task.id,
        startTime: task.startTime,
        endTime: task.endTime,
        success: result.success,
        cost: result.cost_usd
      });

      return task;

    } catch (error) {
      task.status = 'error';
      task.error = error.message;
      task.endTime = new Date();
      
      engineer.status = 'error';
      engineer.currentTask = null;
      
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
    
    // Update engineer status
    const engineer = this.engineers.get(task.engineerId);
    if (engineer) {
      engineer.status = 'idle';
      engineer.currentTask = null;
    }
    
    return true;
  }
}

export default ContainerTaskManager;