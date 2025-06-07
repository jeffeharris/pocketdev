import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { getActiveProject } from '../project-routes.js';
import { performance } from 'perf_hooks';
import { MemoryEnhancedPrompts } from './memory-enhanced-prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Debug logging helper
const debugLog = (level, taskId, message, data = null) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    taskId,
    message,
    data,
    pid: process.pid
  };
  
  // Console output
  console[level === 'error' ? 'error' : 'log'](
    `[${timestamp}] [${level.toUpperCase()}] [${taskId}] ${message}`,
    data ? JSON.stringify(data, null, 2) : ''
  );
  
  // Also write to debug file
  try {
    const debugFile = `/tmp/orchestrator-debug-${new Date().toISOString().split('T')[0]}.log`;
    fs.appendFile(debugFile, JSON.stringify(logEntry) + '\n').catch(() => {});
  } catch (e) {
    // Ignore file write errors
  }
};

class ContainerOrchestrator {
  constructor(config = {}) {
    this.dockerImage = config.dockerImage || 'pocketdev/ai-developer:latest';
    this.workspaceBase = config.workspaceBase || '/tmp/pocketdev-workspaces';
    this.activeContainers = new Map();
    this.sessionStorage = new Map();
    this.debugMode = process.env.DEBUG === 'true';
    this.healthCheckIntervals = new Map();
    this.containerStats = new Map();
    this.memoryEnhancer = new MemoryEnhancedPrompts();
    
    debugLog('info', 'constructor', 'ContainerOrchestrator initialized', {
      dockerImage: this.dockerImage,
      workspaceBase: this.workspaceBase,
      debugMode: this.debugMode
    });
  }

  async init() {
    debugLog('info', 'init', 'Initializing ContainerOrchestrator');
    
    try {
      // Ensure workspace directory exists with validation
      await fs.mkdir(this.workspaceBase, { recursive: true });
      
      // Verify directory is writable
      const testFile = path.join(this.workspaceBase, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      debugLog('info', 'init', 'Workspace directory verified', {
        workspaceBase: this.workspaceBase,
        writable: true
      });
      
      // Check Docker availability
      await this.checkDockerAvailable();
      
      // Start cleanup interval
      setInterval(() => {
        this.cleanupStaleContainers().catch(err => {
          debugLog('error', 'cleanup', 'Cleanup interval error', err);
        });
      }, 60000); // Every minute
      
    } catch (error) {
      debugLog('error', 'init', 'Initialization failed', {
        error: error.message,
        stack: error.stack
      });
      throw new Error(`ContainerOrchestrator initialization failed: ${error.message}`);
    }
  }
  
  async checkDockerAvailable() {
    debugLog('info', 'docker-check', 'Checking Docker availability');
    
    return new Promise((resolve, reject) => {
      const dockerCheck = spawn('docker', ['version'], {
        timeout: 5000
      });
      
      let output = '';
      dockerCheck.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      dockerCheck.on('error', (err) => {
        debugLog('error', 'docker-check', 'Docker command failed', err);
        reject(new Error('Docker is not available: ' + err.message));
      });
      
      dockerCheck.on('close', (code) => {
        if (code === 0) {
          debugLog('info', 'docker-check', 'Docker is available', {
            version: output.split('\n')[0]
          });
          resolve();
        } else {
          reject(new Error(`Docker check failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Get the default branch from active project config
   * @returns {string} Default branch name or 'main'
   */
  getDefaultBranch() {
    const activeProject = getActiveProject();
    return activeProject?.config?.project?.default_branch || 'main';
  }

  /**
   * Get the base system prompt for a given engineer role
   * @param {string} role - Engineer role
   * @returns {string} Base system prompt
   */
  async getBasePromptForRole(role) {
    // In the future, this could load from database
    // For now, match the prompts in entrypoint.sh
    const prompts = {
      frontend: "You are a senior frontend engineer specializing in React and TypeScript. Focus on component architecture, accessibility, and user experience.",
      backend: "You are a backend architect specializing in scalable APIs. Focus on security, performance, and proper error handling.",
      devops: "You are a DevOps specialist focusing on automation and infrastructure. Create reproducible deployments and comprehensive monitoring.",
      fullstack: "You are a fullstack engineer capable of building complete features. Balance frontend usability with backend reliability.",
      qa_manual: "You are an expert QA engineer. Focus on comprehensive testing, edge cases, and user experience validation. Create detailed bug reports and test plans."
    };
    
    return prompts[role] || prompts.fullstack;
  }

  /**
   * Execute a containerized task
   * @param {Object} task - Task configuration
   * @returns {Promise<Object>} Task result
   */
  async executeTask(task) {
    const executionStart = performance.now();
    const taskId = task.id || uuidv4();
    const workspacePath = path.join(this.workspaceBase, taskId);
    
    // Initialize task statistics
    this.containerStats.set(taskId, {
      startTime: new Date(),
      status: 'initializing',
      errors: [],
      warnings: [],
      checkpoints: []
    });
    
    const addCheckpoint = (name, data = {}) => {
      const stats = this.containerStats.get(taskId);
      if (stats) {
        stats.checkpoints.push({
          name,
          timestamp: new Date(),
          elapsed: performance.now() - executionStart,
          data
        });
      }
    };
    
    debugLog('info', taskId, 'executeTask called', {
      task,
      workspacePath,
      timestamp: new Date().toISOString()
    });
    
    // Write comprehensive debug file
    try {
      const debugInfo = {
        taskId,
        task,
        environment: {
          nodeVersion: process.version,
          platform: process.platform,
          arch: process.arch,
          pid: process.pid,
          ppid: process.ppid,
          cwd: process.cwd(),
          memory: process.memoryUsage(),
          env: Object.keys(process.env).reduce((acc, key) => {
            if (key.includes('KEY') || key.includes('TOKEN') || key.includes('SECRET')) {
              acc[key] = '***REDACTED***';
            } else {
              acc[key] = process.env[key];
            }
            return acc;
          }, {})
        },
        timestamp: new Date().toISOString()
      };
      
      await fs.mkdir('/tmp/pocketdev-debug', { recursive: true });
      await fs.writeFile(
        `/tmp/pocketdev-debug/task-${taskId}-start.json`,
        JSON.stringify(debugInfo, null, 2)
      );
    } catch (e) {
      debugLog('error', taskId, 'Failed to write debug file', e);
    }
    
    addCheckpoint('task_started');
    
    try {
      // Create workspace directories with validation
      debugLog('info', taskId, 'Creating workspace directories');
      
      for (const dir of [workspacePath, path.join(workspacePath, 'logs'), path.join(workspacePath, 'results')]) {
        try {
          await fs.mkdir(dir, { recursive: true });
          
          // Verify directory was created
          const stats = await fs.stat(dir);
          if (!stats.isDirectory()) {
            throw new Error(`${dir} is not a directory`);
          }
          
          // Test write permissions
          const testFile = path.join(dir, '.test');
          await fs.writeFile(testFile, 'test');
          await fs.unlink(testFile);
          
          debugLog('debug', taskId, `Directory created and verified: ${dir}`);
        } catch (error) {
          debugLog('error', taskId, `Failed to create/verify directory: ${dir}`, error);
          throw new Error(`Cannot create workspace directory ${dir}: ${error.message}`);
        }
      }
      
      addCheckpoint('directories_created');

      // Prepare and validate environment variables
      debugLog('info', taskId, 'Preparing environment variables');
      
      // Validate API key
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error('ANTHROPIC_API_KEY environment variable is not set');
      }
      
      const apiKeyLength = process.env.ANTHROPIC_API_KEY.length;
      const apiKeyPrefix = process.env.ANTHROPIC_API_KEY.substring(0, 10);
      
      debugLog('debug', taskId, 'API key validation', {
        present: true,
        length: apiKeyLength,
        prefix: apiKeyPrefix + '...'
      });
      
      // Build environment with validation
      const env = {};
      
      // Repository URL validation
      if (typeof task.repository === 'string') {
        env.REPO_URL = task.repository;
        env.BRANCH = this.getDefaultBranch();
      } else if (task.repository && typeof task.repository === 'object') {
        env.REPO_URL = task.repository.url;
        env.BRANCH = task.repository.branch || this.getDefaultBranch();
      } else {
        throw new Error('Invalid repository configuration');
      }
      
      // Required fields
      if (!task.description) {
        throw new Error('Task description is required');
      }
      
      env.TASK_ID = taskId;
      env.TASK_DESCRIPTION = task.description;
      env.ACCEPTANCE_CRITERIA = JSON.stringify(task.acceptanceCriteria || []);
      env.TEST_FRAMEWORK = task.testFramework || 'jest';
      env.CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
      env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
      env.ENGINEER_ROLE = task.engineerRole || 'fullstack';
      env.MODEL = task.model || 'claude-3-5-sonnet-latest';
      env.MAX_ITERATIONS = String(task.maxIterations || '5');
      env.DEBUG = this.debugMode ? 'true' : 'false';
      
      // We'll let the container handle memory loading since it needs to clone the repo first
      // Just provide the base prompt
      const basePrompt = await this.getBasePromptForRole(task.engineerRole || 'fullstack');
      env.BASE_SYSTEM_PROMPT = basePrompt;
      
      // Validate all environment variables
      const requiredEnvVars = ['REPO_URL', 'TASK_DESCRIPTION', 'ANTHROPIC_API_KEY'];
      for (const varName of requiredEnvVars) {
        if (!env[varName]) {
          throw new Error(`Required environment variable ${varName} is not set or empty`);
        }
      }
      
      debugLog('debug', taskId, 'Environment variables prepared', {
        count: Object.keys(env).length,
        variables: Object.keys(env).map(key => {
          if (key.includes('KEY') || key.includes('TOKEN')) {
            return `${key}=***REDACTED*** (length: ${env[key]?.length || 0})`;
          }
          return `${key}=${String(env[key]).substring(0, 50)}...`;
        })
      });

      // Add Git credentials if provided
      if (typeof task.repository === 'object' && task.repository.credentials) {
        env.GIT_USERNAME = task.repository.credentials.username;
        env.GIT_TOKEN = task.repository.credentials.token;
      }
      
      // CRITICAL: Check for verbose/debug mode
      if (env.DEBUG === 'true' || env.CLAUDE_DEBUG === 'true') {
        console.error('=====================================');
        console.error('ERROR: DEBUG/VERBOSE MODE IS ENABLED');
        console.error('This WILL break Claude JSON output!');
        console.error('Setting DEBUG=false to prevent failure');
        console.error('=====================================');
        env.DEBUG = 'false';
        env.CLAUDE_DEBUG = 'false';
      }

      // Resume session if continuing
      if (task.sessionId && this.sessionStorage.has(task.sessionId)) {
        env.CLAUDE_SESSION_ID = task.sessionId;
      }

      // Build Docker command with validation
      const dockerArgs = [
        'run',
        '--rm',  // Remove container after execution
        '--name', `pocketdev-${taskId}`, // Named container for easier management
        '-v', `${workspacePath}/logs:/workspace/logs`,
        '-v', `${workspacePath}/results:/workspace/results`
      ];
      
      // Add resource limits
      dockerArgs.push(
        '--memory', '2g',  // 2GB memory limit
        '--memory-swap', '2g',  // No swap
        '--cpus', '2.0',  // 2 CPU cores max
        '--pids-limit', '512'  // Process limit
      );
      
      // Add environment variables with validation
      debugLog('debug', taskId, 'Adding environment variables to Docker command');
      
      for (const [key, value] of Object.entries(env)) {
        if (value === undefined || value === null) {
          debugLog('warning', taskId, `Skipping undefined/null env var: ${key}`);
          continue;
        }
        
        // Validate environment variable value
        const strValue = String(value);
        if (strValue.includes('\n') || strValue.includes('\r')) {
          debugLog('warning', taskId, `Environment variable ${key} contains newlines`);
        }
        
        dockerArgs.push('-e', `${key}=${strValue}`);
      }
      
      dockerArgs.push(this.dockerImage);
      
      addCheckpoint('docker_args_prepared', {
        argCount: dockerArgs.length,
        image: this.dockerImage
      });

      // Start container with comprehensive error handling
      debugLog('info', taskId, 'Starting Docker container');
      
      // Write debug information
      const debugInfo = {
        taskId,
        dockerArgs,
        env: Object.keys(env).reduce((acc, key) => {
          acc[key] = key.includes('KEY') ? '***REDACTED***' : env[key];
          return acc;
        }, {}),
        timestamp: new Date().toISOString(),
        dockerCommand: `docker ${dockerArgs.join(' ')}`
      };
      
      await fs.writeFile(
        `/tmp/pocketdev-debug/docker-${taskId}.json`,
        JSON.stringify(debugInfo, null, 2)
      );
      
      let container;
      let spawnError = null;
      
      try {
        // Pre-spawn validation
        debugLog('debug', taskId, 'Pre-spawn validation');
        
        // Check if Docker image exists
        await this.checkDockerImage(this.dockerImage);
        
        // Spawn container
        const spawnStart = performance.now();
        container = spawn('docker', dockerArgs, {
          detached: false,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        const spawnDuration = performance.now() - spawnStart;
        debugLog('info', taskId, 'Docker spawn completed', {
          duration: spawnDuration,
          pid: container.pid
        });
        
        addCheckpoint('container_spawned', {
          pid: container.pid,
          spawnDuration
        });
        
        // Validate spawn succeeded
        if (!container.pid) {
          throw new Error('Container spawn failed - no PID assigned');
        }
        
      } catch (error) {
        spawnError = error;
        debugLog('error', taskId, 'Failed to spawn Docker container', {
          error: error.message,
          stack: error.stack
        });
        
        // Write detailed error info
        await fs.writeFile(
          `/tmp/pocketdev-debug/spawn-error-${taskId}.txt`,
          `Error: ${error.message}\n\nStack:\n${error.stack}\n\nDebug Info:\n${JSON.stringify(debugInfo, null, 2)}`
        );
        
        throw new Error(`Failed to start container: ${error.message}`);
      }
      
      // Set up error handler
      container.on('error', (err) => {
        debugLog('error', taskId, 'Container process error', {
          error: err.message,
          code: err.code
        });
        
        const stats = this.containerStats.get(taskId);
        if (stats) {
          stats.errors.push({
            timestamp: new Date(),
            error: err.message,
            code: err.code
          });
        }
      });
      
      // Register container with enhanced tracking
      const containerInfo = {
        process: container,
        startTime: new Date(),
        task,
        logs: [],
        taskId: taskId,
        pid: container.pid,
        status: 'running',
        lastHealthCheck: new Date(),
        outputBuffer: '',
        errorBuffer: ''
      };
      
      this.activeContainers.set(taskId, containerInfo);
      
      debugLog('info', taskId, 'Container registered', {
        pid: container.pid,
        startTime: containerInfo.startTime
      });
      
      // Set up health monitoring
      this.startHealthMonitoring(taskId);
      
      // Stream logs with buffering and error handling
      const logs = [];
      const maxLogSize = 10 * 1024 * 1024; // 10MB max log size
      let totalLogSize = 0;
      
      const processOutput = (stream, type) => {
        let buffer = '';
        
        stream.on('data', (chunk) => {
          try {
            const data = chunk.toString();
            buffer += data;
            
            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop() || ''; // Keep incomplete line in buffer
            
            for (const line of lines) {
              if (!line.trim()) continue;
              
              const logEntry = {
                type,
                message: line + '\n',
                timestamp: new Date()
              };
              
              // Size check
              totalLogSize += line.length;
              if (totalLogSize > maxLogSize) {
                debugLog('warning', taskId, 'Log size limit exceeded', {
                  totalSize: totalLogSize,
                  maxSize: maxLogSize
                });
                logEntry.message = '[Log truncated due to size limit]\n';
              } else {
                logs.push(logEntry);
                if (containerInfo) {
                  containerInfo.logs.push(logEntry);
                }
              }
              
              // Console output with task ID
              const prefix = `[${taskId}]`;
              if (type === 'stderr') {
                console.error(`${prefix} ${line}`);
              } else {
                console.log(`${prefix} ${line}`);
              }
              
              // Check for important patterns
              if (line.includes('[ERROR]') || line.includes('ERROR:')) {
                debugLog('error', taskId, 'Error detected in output', { line });
              } else if (line.includes('[WARNING]') || line.includes('WARNING:')) {
                debugLog('warning', taskId, 'Warning detected in output', { line });
              }
            }
          } catch (error) {
            debugLog('error', taskId, 'Error processing output', {
              type,
              error: error.message
            });
          }
        });
        
        stream.on('error', (error) => {
          debugLog('error', taskId, `Stream error (${type})`, error);
        });
        
        stream.on('end', () => {
          // Process any remaining buffer
          if (buffer.trim()) {
            const logEntry = {
              type,
              message: buffer,
              timestamp: new Date()
            };
            logs.push(logEntry);
            if (containerInfo) {
              containerInfo.logs.push(logEntry);
            }
          }
          debugLog('debug', taskId, `Stream ended (${type})`);
        });
      };
      
      processOutput(container.stdout, 'stdout');
      processOutput(container.stderr, 'stderr');
      
      // Monitor container exit
      container.on('exit', (code, signal) => {
        debugLog('info', taskId, 'Container exited', { code, signal });
        containerInfo.status = 'exited';
        containerInfo.exitCode = code;
        containerInfo.exitSignal = signal;
        this.stopHealthMonitoring(taskId);
      });

      // Poll for results with enhanced monitoring
      debugLog('info', taskId, 'Starting result polling');
      
      let result = null;
      let attempts = 0;
      const maxAttempts = 300; // 5 minutes
      const pollInterval = 1000; // 1 second
      const resultsPath = path.join(workspacePath, 'results', 'session_result.json');
      
      addCheckpoint('polling_started');
      
      while (attempts < maxAttempts) {
        try {
          // Check if results file exists
          const stats = await fs.stat(resultsPath).catch(() => null);
          
          if (stats && stats.isFile()) {
            debugLog('debug', taskId, 'Results file found, attempting to read');
            
            const resultData = await fs.readFile(resultsPath, 'utf8');
            
            // Validate JSON
            try {
              result = JSON.parse(resultData);
              debugLog('info', taskId, 'Results successfully parsed', {
                success: result.success,
                hasError: !!result.error
              });
              addCheckpoint('results_found');
              break;
            } catch (parseError) {
              debugLog('error', taskId, 'Invalid JSON in results file', {
                error: parseError.message,
                content: resultData.substring(0, 200)
              });
              
              // Wait a bit and retry in case file is being written
              await new Promise(resolve => setTimeout(resolve, 500));
            }
          }
        } catch (error) {
          // File doesn't exist yet, this is expected
          if (attempts % 10 === 0) {
            debugLog('debug', taskId, `Still waiting for results (attempt ${attempts})`);
          }
        }
        
        // Check container health
        const containerInfo = this.activeContainers.get(taskId);
        if (containerInfo) {
          // Check if container process is still alive
          try {
            process.kill(containerInfo.pid, 0); // Signal 0 = check if process exists
            containerInfo.lastHealthCheck = new Date();
          } catch (error) {
            debugLog('warning', taskId, 'Container process no longer exists', {
              pid: containerInfo.pid,
              attempts
            });
            
            if (attempts > 10) {
              debugLog('error', taskId, 'Container died without producing results');
              break;
            }
          }
          
          // Check container status if exited
          if (containerInfo.status === 'exited' && attempts > 5) {
            debugLog('warning', taskId, 'Container exited', {
              exitCode: containerInfo.exitCode,
              exitSignal: containerInfo.exitSignal
            });
            
            // Give it a few more attempts in case results are being written
            if (attempts > 10) {
              break;
            }
          }
        } else if (attempts > 10) {
          debugLog('error', taskId, 'Container info lost');
          break;
        }
        
        attempts++;
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
      
      debugLog('info', taskId, 'Polling completed', {
        attempts,
        resultFound: !!result
      });
      
      // Container stays in activeContainers until explicitly removed
      // This allows it to receive signals for accept/continue
      
      // Handle missing results
      if (!result) {
        const containerInfo = this.activeContainers.get(taskId);
        const errorDetails = {
          attempts,
          containerStatus: containerInfo?.status || 'unknown',
          exitCode: containerInfo?.exitCode,
          exitSignal: containerInfo?.exitSignal,
          lastLogs: logs.slice(-20).map(l => l.message).join(''),
          workspacePath
        };
        
        debugLog('error', taskId, 'No results produced', errorDetails);
        
        // Try to gather diagnostic information
        const diagnostics = await this.gatherDiagnostics(taskId, workspacePath);
        
        result = {
          success: false,
          error: 'Task failed to produce results',
          errorDetails,
          diagnostics,
          exitCode: containerInfo?.exitCode || -1
        };
      }
      
      // Store session ID for potential continuation
      if (result.sessionId) {
        this.sessionStorage.set(result.sessionId, {
          taskId,
          timestamp: new Date(),
          workspacePath,
          result
        });
        debugLog('info', taskId, 'Session stored', { sessionId: result.sessionId });
      }
      
      // Add comprehensive metadata
      const executionTime = performance.now() - executionStart;
      const stats = this.containerStats.get(taskId);
      
      result.taskId = taskId;
      result.duration = executionTime;
      result.logs = logs;
      result.workspacePath = workspacePath;
      result.statistics = {
        executionTimeMs: executionTime,
        errorCount: stats?.errors.length || 0,
        warningCount: stats?.warnings.length || 0,
        checkpoints: stats?.checkpoints || [],
        logCount: logs.length,
        totalLogSize: logs.reduce((sum, log) => sum + log.message.length, 0)
      };
      
      addCheckpoint('task_completed', {
        success: result.success,
        duration: executionTime
      });
      
      debugLog('info', taskId, 'Task execution completed', {
        success: result.success,
        duration: executionTime,
        hasError: !!result.error
      });
      
      // Extract and save memories from this task
      if (result.success || result.logs?.length > 0) {
        try {
          debugLog('info', taskId, 'Extracting memories from task');
          const memories = await this.memoryEnhancer.extractMemoriesFromTask(
            result, 
            task.engineerRole || 'fullstack',
            workspacePath
          );
          
          // Add memory extraction summary to result
          result.memoriesExtracted = {
            performance: memories.performance.length,
            failures: memories.failures.length,
            patterns: memories.patterns.length
          };
          
          debugLog('info', taskId, 'Memories extracted', result.memoriesExtracted);
        } catch (err) {
          debugLog('warning', taskId, 'Failed to extract memories', err);
          // Don't fail the task if memory extraction fails
        }
      }
      
      // Save final debug info
      await fs.writeFile(
        `/tmp/pocketdev-debug/task-${taskId}-complete.json`,
        JSON.stringify({
          taskId,
          result: {
            ...result,
            logs: `[${logs.length} log entries]`
          },
          statistics: result.statistics,
          timestamp: new Date().toISOString()
        }, null, 2)
      ).catch(() => {});
      
      return result;

    } catch (error) {
      const executionTime = performance.now() - executionStart;
      
      debugLog('error', taskId, 'Container orchestration failed', {
        error: error.message,
        stack: error.stack,
        executionTime
      });
      
      // Clean up
      this.stopHealthMonitoring(taskId);
      const containerInfo = this.activeContainers.get(taskId);
      if (containerInfo?.process) {
        try {
          containerInfo.process.kill('SIGTERM');
        } catch (killError) {
          debugLog('error', taskId, 'Failed to kill container process', killError);
        }
      }
      this.activeContainers.delete(taskId);
      
      // Save error information
      const errorInfo = {
        taskId,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        executionTime,
        checkpoints: this.containerStats.get(taskId)?.checkpoints || []
      };
      
      await fs.writeFile(
        `/tmp/pocketdev-debug/task-${taskId}-error.json`,
        JSON.stringify(errorInfo, null, 2)
      ).catch(() => {});
      
      throw new Error(`Container orchestration failed: ${error.message}`);
    }
  }
  
  async checkDockerImage(imageName) {
    return new Promise((resolve, reject) => {
      const imageCheck = spawn('docker', ['image', 'inspect', imageName], {
        timeout: 10000
      });
      
      let errorOutput = '';
      imageCheck.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      imageCheck.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Docker image '${imageName}' not found. Please build it first.`));
        }
      });
    });
  }
  
  startHealthMonitoring(taskId) {
    const interval = setInterval(() => {
      const containerInfo = this.activeContainers.get(taskId);
      if (!containerInfo) {
        clearInterval(interval);
        return;
      }
      
      try {
        // Check if process is still alive
        process.kill(containerInfo.pid, 0);
        containerInfo.lastHealthCheck = new Date();
      } catch (error) {
        debugLog('warning', taskId, 'Health check failed - process may be dead', {
          pid: containerInfo.pid
        });
        containerInfo.status = 'dead';
      }
    }, 5000); // Every 5 seconds
    
    this.healthCheckIntervals.set(taskId, interval);
  }
  
  stopHealthMonitoring(taskId) {
    const interval = this.healthCheckIntervals.get(taskId);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(taskId);
    }
  }
  
  async gatherDiagnostics(taskId, workspacePath) {
    const diagnostics = {
      timestamp: new Date().toISOString(),
      taskId
    };
    
    try {
      // Check workspace structure
      const dirs = ['logs', 'results', 'debug'];
      diagnostics.workspaceStructure = {};
      
      for (const dir of dirs) {
        const dirPath = path.join(workspacePath, dir);
        try {
          const files = await fs.readdir(dirPath);
          diagnostics.workspaceStructure[dir] = files;
        } catch (error) {
          diagnostics.workspaceStructure[dir] = `Error: ${error.message}`;
        }
      }
      
      // Check for any debug files
      try {
        const debugDir = path.join(workspacePath, 'debug');
        const debugFiles = await fs.readdir(debugDir).catch(() => []);
        diagnostics.debugFiles = {};
        
        for (const file of debugFiles.slice(0, 5)) { // Limit to first 5 files
          try {
            const content = await fs.readFile(path.join(debugDir, file), 'utf8');
            diagnostics.debugFiles[file] = content.substring(0, 1000); // First 1000 chars
          } catch (error) {
            diagnostics.debugFiles[file] = `Read error: ${error.message}`;
          }
        }
      } catch (error) {
        diagnostics.debugFiles = `Error accessing debug files: ${error.message}`;
      }
      
      // Container info
      const containerInfo = this.activeContainers.get(taskId);
      if (containerInfo) {
        diagnostics.container = {
          status: containerInfo.status,
          pid: containerInfo.pid,
          startTime: containerInfo.startTime,
          lastHealthCheck: containerInfo.lastHealthCheck,
          exitCode: containerInfo.exitCode,
          exitSignal: containerInfo.exitSignal
        };
      }
      
    } catch (error) {
      diagnostics.error = `Failed to gather diagnostics: ${error.message}`;
    }
    
    return diagnostics;
  }
  
  async cleanupStaleContainers() {
    const now = Date.now();
    const staleTimeout = 3600000; // 1 hour
    
    for (const [taskId, containerInfo] of this.activeContainers.entries()) {
      const age = now - containerInfo.startTime.getTime();
      
      if (age > staleTimeout) {
        debugLog('warning', taskId, 'Cleaning up stale container', {
          age: Math.round(age / 1000) + 's',
          status: containerInfo.status
        });
        
        await this.stopContainer(taskId);
      }
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
   * Signal a container (e.g., to shutdown or continue) with validation
   */
  async signalContainer(taskId, signal, data = null) {
    debugLog('info', taskId, `Signaling container: ${signal}`);
    
    try {
      // Get workspace path
      const workspacePath = path.join(this.workspaceBase, taskId);
      
      // Validate signal
      const validSignals = ['SHUTDOWN', 'CONTINUE', 'PAUSE', 'RESUME'];
      if (!validSignals.includes(signal)) {
        throw new Error(`Invalid signal: ${signal}`);
      }
      
      // For active containers
      const container = this.activeContainers.get(taskId);
      if (container) {
        // Verify container is still running
        if (container.status === 'exited') {
          debugLog('warning', taskId, 'Container already exited', {
            exitCode: container.exitCode
          });
          return false;
        }
        
        // Write signal file
        const signalPath = path.join(workspacePath, 'results', signal);
        
        // Ensure directory exists
        await fs.mkdir(path.dirname(signalPath), { recursive: true });
        
        // Write signal with data if provided
        if (data) {
          await fs.writeFile(signalPath, typeof data === 'string' ? data : JSON.stringify(data));
        } else {
          await fs.writeFile(signalPath, '');
        }
        
        // Verify file was written
        const stats = await fs.stat(signalPath);
        if (!stats.isFile()) {
          throw new Error('Signal file was not created');
        }
        
        debugLog('info', taskId, `Signal sent successfully: ${signal}`, {
          signalPath,
          hasData: !!data
        });
        
        // Update container state
        const stats2 = this.containerStats.get(taskId);
        if (stats2) {
          stats2.checkpoints.push({
            name: `signal_${signal}`,
            timestamp: new Date()
          });
        }
        
        return true;
      }
      
      // For inactive containers, check session storage
      const sessionInfo = Array.from(this.sessionStorage.values()).find(s => s.taskId === taskId);
      if (sessionInfo && sessionInfo.workspacePath) {
        const signalPath = path.join(sessionInfo.workspacePath, 'results', signal);
        
        await fs.mkdir(path.dirname(signalPath), { recursive: true });
        await fs.writeFile(signalPath, data || '');
        
        debugLog('info', taskId, `Signal sent to inactive container: ${signal}`);
        return true;
      }
      
      debugLog('error', taskId, 'Container not found for signaling');
      return false;
      
    } catch (error) {
      debugLog('error', taskId, 'Failed to signal container', {
        signal,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }
}

export default ContainerOrchestrator;