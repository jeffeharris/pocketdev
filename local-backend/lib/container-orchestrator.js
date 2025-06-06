import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class ContainerOrchestrator {
  constructor(config = {}) {
    this.dockerImage = config.dockerImage || 'pocketdev/ai-developer:latest';
    this.workspaceBase = config.workspaceBase || '/tmp/pocketdev-workspaces';
    this.activeContainers = new Map();
    this.sessionStorage = new Map();
  }

  async init() {
    // Ensure workspace directory exists
    await fs.mkdir(this.workspaceBase, { recursive: true });
  }

  /**
   * Execute a containerized task
   * @param {Object} task - Task configuration
   * @returns {Promise<Object>} Task result
   */
  async executeTask(task) {
    const taskId = task.id || uuidv4();
    const workspacePath = path.join(this.workspaceBase, taskId);
    
    // Immediate synchronous log to stderr
    process.stderr.write(`[ORCHESTRATOR] executeTask called for ${taskId}\n`);
    
    // Debug file to prove we're here
    try {
      await fs.writeFile(`/tmp/orchestrator-called-${taskId}.txt`, JSON.stringify({
        message: 'executeTask was called',
        taskId,
        timestamp: new Date().toISOString()
      }));
    } catch (e) {
      console.error('Failed to write debug file:', e);
    }
    
    console.error('ContainerOrchestrator.executeTask called!');
    console.error('Task ID:', taskId);
    console.error('Task:', JSON.stringify(task, null, 2));
    
    console.log('ContainerOrchestrator: Starting task execution for', taskId);
    console.log('Task details:', JSON.stringify(task, null, 2));
    
    try {
      // Create workspace directories
      await fs.mkdir(workspacePath, { recursive: true });
      await fs.mkdir(path.join(workspacePath, 'logs'), { recursive: true });
      await fs.mkdir(path.join(workspacePath, 'results'), { recursive: true });

      // Prepare environment variables
      console.log('ContainerOrchestrator: ANTHROPIC_API_KEY present?', !!process.env.ANTHROPIC_API_KEY);
      console.log('ContainerOrchestrator: First 10 chars of API key:', process.env.ANTHROPIC_API_KEY?.substring(0, 10));
      
      const env = {
        REPO_URL: typeof task.repository === 'string' ? task.repository : task.repository.url,
        BRANCH: typeof task.repository === 'string' ? '' : (task.repository.branch || ''),  // Let git determine default branch
        TASK_DESCRIPTION: task.description,
        ACCEPTANCE_CRITERIA: JSON.stringify(task.acceptanceCriteria || []),
        TEST_FRAMEWORK: task.testFramework || 'jest',
        CLAUDE_API_KEY: process.env.ANTHROPIC_API_KEY,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY, // Add both for compatibility
        ENGINEER_ROLE: task.engineerRole || 'fullstack',
        MODEL: task.model || 'claude-3-5-sonnet-latest',
        MAX_ITERATIONS: task.maxIterations || '5'
      };

      // Add Git credentials if provided
      if (typeof task.repository === 'object' && task.repository.credentials) {
        env.GIT_USERNAME = task.repository.credentials.username;
        env.GIT_TOKEN = task.repository.credentials.token;
      }

      // Resume session if continuing
      if (task.sessionId && this.sessionStorage.has(task.sessionId)) {
        env.CLAUDE_SESSION_ID = task.sessionId;
      }

      // Docker run command
      const dockerArgs = [
        'run',
        '--rm',  // Remove container after execution
        '-v', `${workspacePath}/logs:/workspace/logs`,
        '-v', `${workspacePath}/results:/workspace/results`
      ];

      // Add environment variables
      console.log('Environment variables to pass:');
      Object.entries(env).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          dockerArgs.push('-e', `${key}=${value}`);
          console.log(`  ${key}=${key.includes('KEY') ? '***' : value.toString().substring(0, 50)}...`);
        } else {
          console.log(`  ${key}=<undefined or null, skipping>`);
        }
      });

      dockerArgs.push(this.dockerImage);

      // Start container
      console.log(`Starting container for task ${taskId}...`);
      console.log('Docker command:', 'docker', dockerArgs.join(' '));
      console.log('Full docker command would be:', `docker ${dockerArgs.join(' ')}`);
      
      // Test: Log the exact spawn arguments
      console.log('Spawn arguments array:', JSON.stringify(dockerArgs, null, 2));
      
      // Write to a debug file
      await fs.writeFile(`/tmp/docker-debug-${taskId}.txt`, JSON.stringify({
        dockerArgs,
        env,
        timestamp: new Date().toISOString()
      }, null, 2));
      
      let container;
      try {
        // Write debug info to file before spawn
        await fs.writeFile(`/tmp/pre-spawn-${taskId}.json`, JSON.stringify({
          dockerArgs,
          env,
          timestamp: new Date().toISOString()
        }, null, 2));
        
        container = spawn('docker', dockerArgs);
        
        // Write success marker
        await fs.writeFile(`/tmp/post-spawn-${taskId}.txt`, 'spawn completed');
      } catch (spawnError) {
        console.error('Failed to spawn Docker:', spawnError);
        await fs.writeFile(`/tmp/spawn-error-${taskId}.txt`, spawnError.toString());
        throw spawnError;
      }
      
      // Handle spawn errors
      container.on('error', (err) => {
        console.error(`Failed to start container: ${err.message}`);
      });
      
      this.activeContainers.set(taskId, {
        process: container,
        startTime: new Date(),
        task,
        logs: [],
        taskId: taskId
      });

      // Stream logs
      const logs = [];
      const containerInfo = this.activeContainers.get(taskId);
      const spawnTime = new Date();
      console.log(`[${new Date().toISOString()}] Container spawned for ${taskId}`);
      
      container.stdout.on('data', (data) => {
        const message = data.toString();
        const logEntry = { type: 'stdout', message, timestamp: new Date() };
        logs.push(logEntry);
        if (containerInfo) containerInfo.logs.push(logEntry);
        console.log(`[${taskId}] ${message}`);
      });

      container.stderr.on('data', (data) => {
        const message = data.toString();
        const logEntry = { type: 'stderr', message, timestamp: new Date() };
        logs.push(logEntry);
        if (containerInfo) containerInfo.logs.push(logEntry);
        console.error(`[${taskId}] ERROR: ${message}`);
      });

      // Instead of waiting for container to exit, poll for results
      let result = null;
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes with 1 second intervals
      
      while (attempts < maxAttempts) {
        // Check if results file exists
        try {
          const resultData = await fs.readFile(resultsPath, 'utf8');
          result = JSON.parse(resultData);
          console.log(`Task ${taskId} completed - results found`);
          break;
        } catch (error) {
          // Results not ready yet
          attempts++;
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Check if container is still running
          const isRunning = this.activeContainers.has(taskId);
          if (!isRunning && attempts > 10) {
            console.error(`Container for task ${taskId} stopped without results`);
            break;
          }
        }
      }
      
      // Container stays in activeContainers until explicitly removed
      // This allows it to receive signals for accept/continue
      
      if (!result) {
        result = {
          success: false,
          error: 'Task timed out or failed to produce results',
          exitCode: -1
        };
      }

      // Store session ID for potential continuation
      if (result.sessionId) {
        this.sessionStorage.set(result.sessionId, {
          taskId,
          timestamp: new Date(),
          workspacePath
        });
      }

      // Add metadata
      result.taskId = taskId;
      result.duration = Date.now() - this.activeContainers.get(taskId)?.startTime?.getTime() || 0;
      result.logs = logs;
      result.workspacePath = workspacePath;

      return result;

    } catch (error) {
      console.error(`Container orchestration error for task ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Stop a running container
   */
  async stopContainer(taskId) {
    const container = this.activeContainers.get(taskId);
    if (container) {
      console.log(`Stopping container for task ${taskId}...`);
      container.process.kill('SIGTERM');
      this.activeContainers.delete(taskId);
      return true;
    }
    return false;
  }

  /**
   * Get status of all active containers
   */
  getActiveContainers() {
    return Array.from(this.activeContainers.entries()).map(([taskId, info]) => ({
      taskId,
      startTime: info.startTime,
      task: info.task,
      running: !info.process.killed
    }));
  }
  
  /**
   * Get logs for a specific task
   */
  getTaskLogs(taskId) {
    const activeContainer = this.activeContainers.get(taskId);
    if (activeContainer && activeContainer.logs) {
      return activeContainer.logs;
    }
    return [];
  }
  
  /**
   * Check if a task is still running
   */
  isTaskRunning(taskId) {
    return this.activeContainers.has(taskId);
  }
  
  /**
   * Check if a container has results ready
   */
  async checkTaskResults(taskId) {
    const workspacePath = path.join(this.workspaceBase, taskId);
    const resultsPath = path.join(workspacePath, 'results', 'session_result.json');
    
    try {
      const resultData = await fs.readFile(resultsPath, 'utf8');
      return JSON.parse(resultData);
    } catch (error) {
      return null;
    }
  }

  /**
   * Continue a previous session
   */
  async continueSession(sessionId, additionalPrompt) {
    const sessionInfo = this.sessionStorage.get(sessionId);
    if (!sessionInfo) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // Create a continuation task
    const task = {
      id: uuidv4(),
      sessionId,
      description: additionalPrompt,
      repository: { url: 'existing', branch: 'existing' }, // Will use existing workspace
      continueFrom: sessionInfo.taskId
    };

    return this.executeTask(task);
  }

  /**
   * Clean up old workspaces
   */
  async cleanup(olderThanHours = 24) {
    const cutoffTime = Date.now() - (olderThanHours * 60 * 60 * 1000);
    
    try {
      const workspaces = await fs.readdir(this.workspaceBase);
      
      for (const workspace of workspaces) {
        const workspacePath = path.join(this.workspaceBase, workspace);
        const stats = await fs.stat(workspacePath);
        
        if (stats.mtimeMs < cutoffTime) {
          console.log(`Cleaning up old workspace: ${workspace}`);
          await fs.rm(workspacePath, { recursive: true, force: true });
        }
      }
    } catch (error) {
      console.error('Cleanup error:', error);
    }
  }

  /**
   * Build the Docker image
   */
  async buildImage() {
    const dockerfilePath = path.join(__dirname, '../../docker/ai-developer');
    
    return new Promise((resolve, reject) => {
      const buildProcess = spawn('docker', [
        'build',
        '-t', this.dockerImage,
        dockerfilePath
      ]);

      buildProcess.stdout.on('data', (data) => {
        console.log(`Build: ${data}`);
      });

      buildProcess.stderr.on('data', (data) => {
        console.error(`Build error: ${data}`);
      });

      buildProcess.on('close', (code) => {
        if (code === 0) {
          console.log('Docker image built successfully');
          resolve();
        } else {
          reject(new Error(`Docker build failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Signal a container (e.g., to shutdown or continue)
   */
  async signalContainer(taskId, signal, data = null) {
    // Get workspace path
    const workspacePath = path.join(this.workspaceBase, taskId);
    
    // For active containers, we can directly write to the mapped volume
    const container = this.activeContainers.get(taskId);
    if (container) {
      // Write signal file to the results directory (which is mapped as a volume)
      const signalPath = path.join(workspacePath, 'results', signal);
      await fs.writeFile(signalPath, data || '');
      console.log(`Signaled container ${taskId} with ${signal}`);
      return true;
    }
    
    // For inactive containers, check session storage
    const sessionInfo = Array.from(this.sessionStorage.values()).find(s => s.taskId === taskId);
    if (sessionInfo && sessionInfo.workspacePath) {
      const signalPath = path.join(sessionInfo.workspacePath, 'results', signal);
      await fs.writeFile(signalPath, data || '');
      console.log(`Signaled workspace ${taskId} with ${signal}`);
      return true;
    }
    
    console.error(`Could not signal container ${taskId} - not found`);
    return false;
  }
}

export default ContainerOrchestrator;