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
    
    try {
      // Create workspace directories
      await fs.mkdir(workspacePath, { recursive: true });
      await fs.mkdir(path.join(workspacePath, 'logs'), { recursive: true });
      await fs.mkdir(path.join(workspacePath, 'results'), { recursive: true });

      // Prepare environment variables
      const env = {
        ...process.env,
        REPO_URL: task.repository.url,
        BRANCH: task.repository.branch || 'main',
        TASK_DESCRIPTION: task.description,
        ACCEPTANCE_CRITERIA: JSON.stringify(task.acceptanceCriteria || []),
        TEST_FRAMEWORK: task.testFramework || 'jest',
        ENGINEER_ROLE: task.engineerRole || 'fullstack',
        MODEL: task.model || 'claude-3-5-sonnet-latest',
        MAX_ITERATIONS: task.maxIterations || '5',
        ENGINE_TYPE: task.engineType || 'claude'
      };

      if (env.ENGINE_TYPE === 'codex') {
        if (process.env.OPENAI_API_KEY) {
          env.OPENAI_API_KEY = process.env.OPENAI_API_KEY;
        }
      } else {
        env.CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
      }

      // Add Git credentials if provided
      if (task.repository.credentials) {
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
      Object.entries(env).forEach(([key, value]) => {
        if (value !== undefined) {
          dockerArgs.push('-e', `${key}=${value}`);
        }
      });

      dockerArgs.push(this.dockerImage);

      // Start container
      console.log(`Starting container for task ${taskId}...`);
      const container = spawn('docker', dockerArgs);
      
      this.activeContainers.set(taskId, {
        process: container,
        startTime: new Date(),
        task
      });

      // Stream logs
      const logs = [];
      container.stdout.on('data', (data) => {
        const message = data.toString();
        logs.push({ type: 'stdout', message, timestamp: new Date() });
        console.log(`[${taskId}] ${message}`);
      });

      container.stderr.on('data', (data) => {
        const message = data.toString();
        logs.push({ type: 'stderr', message, timestamp: new Date() });
        console.error(`[${taskId}] ERROR: ${message}`);
      });

      // Wait for completion
      const exitCode = await new Promise((resolve) => {
        container.on('close', (code) => {
          this.activeContainers.delete(taskId);
          resolve(code);
        });
      });

      // Read results
      const resultsPath = path.join(workspacePath, 'results', 'session_result.json');
      let result;
      
      try {
        const resultData = await fs.readFile(resultsPath, 'utf8');
        result = JSON.parse(resultData);
      } catch (error) {
        console.error(`Failed to read results for task ${taskId}:`, error);
        result = {
          success: false,
          error: 'Failed to read task results',
          exitCode
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
}

export default ContainerOrchestrator;