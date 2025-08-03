import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';

const execAsync = promisify(exec);

/**
 * ContainerService - Handles all Docker container operations for tasks
 * 
 * This service provides a clean interface for container lifecycle management,
 * hiding the complexity of Docker commands, port allocation, and container
 * orchestration. It handles container creation, monitoring, and cleanup
 * operations while emitting events for state changes.
 * 
 * Following deep module principles: simple interface (6 methods), 
 * complex Docker command handling hidden inside.
 */
export class ContainerService {
  constructor(models, eventEmitterService = null) {
    this.models = models;
    this.eventEmitterService = eventEmitterService;
    
    // Port allocation pool for containerized services (9001-9010)
    this.portPool = {
      min: 9001,
      max: 9010,
      allocated: new Map() // taskId -> Set<ports>
    };
    
    // Container registry for tracking active containers
    this.containers = new Map(); // taskId -> { containers: [], services: [] }
    
    // Docker configuration
    this.dockerConfig = {
      network: 'pocketdev-network',
      labelPrefix: 'pocketdev'
    };
    
    // Initialize Docker network if needed
    this._ensureDockerNetwork().catch(error => {
      console.warn('Failed to ensure Docker network:', error.message);
    });
  }

  /**
   * Create and start containers for a task based on docker-compose.yml or Dockerfile
   * @param {string} taskId - Task identifier
   * @param {Object} options - Container creation options
   * @returns {Promise<Object>} Container creation result with service info
   */
  async createContainer(taskId, options = {}) {
    const { 
      forceRecreate = false,
      environmentOverrides = {},
      portBindings = {}
    } = options;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} not found`);
      }
      
      // Check if containers already exist
      if (!forceRecreate && this.containers.has(taskId)) {
        const existing = this.containers.get(taskId);
        const runningServices = await this._getRunningServices(taskId);
        return {
          success: true,
          services: runningServices,
          message: 'Containers already running'
        };
      }
      
      // Stop existing containers if recreating
      if (forceRecreate && this.containers.has(taskId)) {
        await this.stopContainer(taskId);
      }
      
      // Detect container configuration in worktree
      const containerConfig = await this._detectContainerConfig(task.worktree_path);
      if (!containerConfig) {
        return {
          success: false,
          error: 'No Docker configuration found (docker-compose.yml or Dockerfile)',
          services: []
        };
      }
      
      // Allocate ports for services
      const allocatedPorts = await this._allocatePorts(taskId, containerConfig.serviceCount);
      
      // Build and start containers
      const result = await this._buildAndStartContainers(
        taskId, 
        task.worktree_path, 
        containerConfig, 
        allocatedPorts,
        environmentOverrides,
        portBindings
      );
      
      // Store container information
      this.containers.set(taskId, result.containerInfo);
      
      // Emit container created event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('container.created', {
          taskId,
          services: result.services,
          ports: allocatedPorts
        });
      }
      
      return {
        success: true,
        services: result.services,
        containerInfo: result.containerInfo,
        message: 'Containers created and started successfully'
      };
    } catch (error) {
      // Emit error event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('container.error', {
          taskId,
          error: error.message,
          operation: 'create'
        });
      }
      
      throw new Error(`Failed to create containers for task ${taskId}: ${error.message}`);
    }
  }

  /**
   * Stop and remove containers for a task
   * @param {string} taskId - Task identifier
   * @param {Object} options - Stop options
   * @returns {Promise<Object>} Stop operation result
   */
  async stopContainer(taskId, options = {}) {
    const { removeVolumes = false, force = false } = options;
    
    try {
      const containerInfo = this.containers.get(taskId);
      if (!containerInfo) {
        return {
          success: true,
          message: 'No containers found for task'
        };
      }
      
      // Stop all containers for this task
      const stopPromises = containerInfo.containers.map(async (container) => {
        try {
          const stopCommand = force ? 
            `docker kill ${container.id}` : 
            `docker stop ${container.id}`;
          
          await execAsync(stopCommand);
          
          // Remove container
          await execAsync(`docker rm ${container.id}`);
          
          return { id: container.id, stopped: true };
        } catch (error) {
          console.error(`Failed to stop container ${container.id}:`, error.message);
          return { id: container.id, stopped: false, error: error.message };
        }
      });
      
      const stopResults = await Promise.all(stopPromises);
      
      // Remove volumes if requested
      if (removeVolumes) {
        await this._removeTaskVolumes(taskId);
      }
      
      // Release allocated ports
      this._releasePorts(taskId);
      
      // Remove from container registry
      this.containers.delete(taskId);
      
      // Emit container stopped event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('container.stopped', {
          taskId,
          containers: stopResults,
          removedVolumes: removeVolumes
        });
      }
      
      return {
        success: true,
        containers: stopResults,
        message: 'Containers stopped successfully'
      };
    } catch (error) {
      // Emit error event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('container.error', {
          taskId,
          error: error.message,
          operation: 'stop'
        });
      }
      
      throw new Error(`Failed to stop containers for task ${taskId}: ${error.message}`);
    }
  }

  /**
   * Get status of containers for a task
   * @param {string} taskId - Task identifier
   * @returns {Promise<Object>} Container status information
   */
  async getContainerStatus(taskId) {
    try {
      const containerInfo = this.containers.get(taskId);
      if (!containerInfo) {
        return {
          taskId,
          status: 'not-running',
          containers: [],
          services: []
        };
      }
      
      // Check actual Docker container status
      const statusPromises = containerInfo.containers.map(async (container) => {
        try {
          const { stdout } = await execAsync(
            `docker inspect ${container.id} --format='{{.State.Status}}'`
          );
          
          return {
            ...container,
            status: stdout.trim(),
            running: stdout.trim() === 'running'
          };
        } catch (error) {
          return {
            ...container,
            status: 'not-found',
            running: false,
            error: error.message
          };
        }
      });
      
      const containers = await Promise.all(statusPromises);
      const runningCount = containers.filter(c => c.running).length;
      
      // Get service information
      const services = await this._getRunningServices(taskId);
      
      return {
        taskId,
        status: runningCount > 0 ? 'running' : 'stopped',
        containers,
        services,
        runningCount,
        totalCount: containers.length
      };
    } catch (error) {
      throw new Error(`Failed to get container status for task ${taskId}: ${error.message}`);
    }
  }

  /**
   * Get logs from containers for a task
   * @param {string} taskId - Task identifier
   * @param {Object} options - Log retrieval options
   * @returns {Promise<Array>} Container logs
   */
  async getContainerLogs(taskId, options = {}) {
    const { 
      tail = 100, 
      since = null, 
      follow = false,
      service = null 
    } = options;
    
    try {
      const containerInfo = this.containers.get(taskId);
      if (!containerInfo || containerInfo.containers.length === 0) {
        return [];
      }
      
      // Filter containers by service if specified
      const targetContainers = service ? 
        containerInfo.containers.filter(c => c.service === service) :
        containerInfo.containers;
      
      if (targetContainers.length === 0) {
        return [];
      }
      
      // Build docker logs command
      let logCommand = `docker logs`;
      if (tail) logCommand += ` --tail ${tail}`;
      if (since) logCommand += ` --since "${since}"`;
      if (follow) logCommand += ` --follow`;
      logCommand += ` --timestamps`;
      
      // Get logs from all target containers
      const logPromises = targetContainers.map(async (container) => {
        try {
          const { stdout, stderr } = await execAsync(`${logCommand} ${container.id}`);
          
          // Parse log lines and add metadata
          const lines = (stdout + stderr).split('\n').filter(line => line.trim());
          return lines.map(line => {
            const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)$/);
            if (timestampMatch) {
              return {
                timestamp: timestampMatch[1],
                message: timestampMatch[2],
                container: container.id.substring(0, 12),
                service: container.service
              };
            }
            return {
              timestamp: new Date().toISOString(),
              message: line,
              container: container.id.substring(0, 12),
              service: container.service
            };
          });
        } catch (error) {
          return [{
            timestamp: new Date().toISOString(),
            message: `Error getting logs: ${error.message}`,
            container: container.id.substring(0, 12),
            service: container.service,
            error: true
          }];
        }
      });
      
      const allLogs = await Promise.all(logPromises);
      
      // Flatten and sort by timestamp
      const flatLogs = allLogs.flat().sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
      
      return flatLogs;
    } catch (error) {
      throw new Error(`Failed to get container logs for task ${taskId}: ${error.message}`);
    }
  }

  /**
   * Restart containers for a task
   * @param {string} taskId - Task identifier
   * @param {Object} options - Restart options
   * @returns {Promise<Object>} Restart operation result
   */
  async restartContainer(taskId, options = {}) {
    const { service = null, recreate = false } = options;
    
    try {
      if (recreate) {
        // Full recreation - stop and create again
        await this.stopContainer(taskId);
        return await this.createContainer(taskId, { forceRecreate: true });
      } else {
        // Simple restart
        const containerInfo = this.containers.get(taskId);
        if (!containerInfo) {
          throw new Error('No containers found to restart');
        }
        
        // Filter containers by service if specified
        const targetContainers = service ? 
          containerInfo.containers.filter(c => c.service === service) :
          containerInfo.containers;
        
        // Restart containers
        const restartPromises = targetContainers.map(async (container) => {
          try {
            await execAsync(`docker restart ${container.id}`);
            return { id: container.id, restarted: true };
          } catch (error) {
            return { id: container.id, restarted: false, error: error.message };
          }
        });
        
        const restartResults = await Promise.all(restartPromises);
        
        // Emit restart event
        if (this.eventEmitterService) {
          this.eventEmitterService.emit('container.restarted', {
            taskId,
            service,
            containers: restartResults
          });
        }
        
        return {
          success: true,
          containers: restartResults,
          message: 'Containers restarted successfully'
        };
      }
    } catch (error) {
      // Emit error event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit('container.error', {
          taskId,
          error: error.message,
          operation: 'restart'
        });
      }
      
      throw new Error(`Failed to restart containers for task ${taskId}: ${error.message}`);
    }
  }

  /**
   * Get preview URL for a task's web services
   * @param {string} taskId - Task identifier
   * @param {string} service - Optional service name
   * @returns {Promise<Object>} Preview URL information
   */
  async getPreviewUrl(taskId, service = null) {
    try {
      const services = await this._getRunningServices(taskId);
      
      if (services.length === 0) {
        return {
          available: false,
          message: 'No running services found'
        };
      }
      
      // Find web service
      const webService = service ? 
        services.find(s => s.name === service) :
        services.find(s => s.type === 'web-app' || s.port);
      
      if (!webService) {
        return {
          available: false,
          message: 'No web service found',
          services: services.map(s => ({ name: s.name, type: s.type }))
        };
      }
      
      return {
        available: true,
        url: `http://localhost:${webService.port}`,
        service: webService.name,
        port: webService.port
      };
    } catch (error) {
      throw new Error(`Failed to get preview URL for task ${taskId}: ${error.message}`);
    }
  }

  // Private helper methods

  /**
   * Ensure Docker network exists for container isolation
   * @private
   */
  async _ensureDockerNetwork() {
    try {
      // Check if network exists
      await execAsync(`docker network inspect ${this.dockerConfig.network}`);
    } catch (error) {
      // Create network if it doesn't exist
      try {
        await execAsync(
          `docker network create ${this.dockerConfig.network} --driver bridge`
        );
        console.log(`Created Docker network: ${this.dockerConfig.network}`);
      } catch (createError) {
        console.warn('Failed to create Docker network:', createError.message);
      }
    }
  }

  /**
   * Detect container configuration in worktree
   * @private
   */
  async _detectContainerConfig(worktreePath) {
    try {
      // Check for docker-compose.yml
      const composePaths = [
        'docker-compose.yml',
        'docker-compose.yaml',
        'compose.yml',
        'compose.yaml'
      ];
      
      for (const composePath of composePaths) {
        const fullPath = path.join(worktreePath, composePath);
        if (fsSync.existsSync(fullPath)) {
          const content = await fs.readFile(fullPath, 'utf8');
          return {
            type: 'compose',
            path: fullPath,
            content,
            serviceCount: this._countServicesInCompose(content)
          };
        }
      }
      
      // Check for Dockerfile
      const dockerfilePath = path.join(worktreePath, 'Dockerfile');
      if (fsSync.existsSync(dockerfilePath)) {
        const content = await fs.readFile(dockerfilePath, 'utf8');
        return {
          type: 'dockerfile',
          path: dockerfilePath,
          content,
          serviceCount: 1
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error detecting container config:', error);
      return null;
    }
  }

  /**
   * Count services in docker-compose file
   * @private
   */
  _countServicesInCompose(content) {
    try {
      // Simple regex to count service definitions
      const serviceMatches = content.match(/^\s*[a-zA-Z0-9_-]+:/gm);
      // Filter out top-level keys like 'version', 'services', 'volumes', 'networks'
      const topLevelKeys = ['version', 'services', 'volumes', 'networks', 'configs', 'secrets'];
      const serviceCount = serviceMatches ? 
        serviceMatches.filter(match => {
          const key = match.replace(':', '').trim();
          return !topLevelKeys.includes(key);
        }).length : 1;
      
      return Math.max(serviceCount, 1);
    } catch (error) {
      return 1;
    }
  }

  /**
   * Allocate ports for task services
   * @private
   */
  async _allocatePorts(taskId, serviceCount) {
    const allocatedPorts = [];
    const taskPorts = this.portPool.allocated.get(taskId) || new Set();
    
    for (let i = 0; i < serviceCount; i++) {
      let port = this.portPool.min;
      
      // Find next available port
      while (port <= this.portPool.max) {
        const isUsed = Array.from(this.portPool.allocated.values())
          .some(portSet => portSet.has(port));
        
        if (!isUsed) {
          taskPorts.add(port);
          allocatedPorts.push(port);
          break;
        }
        port++;
      }
      
      if (port > this.portPool.max) {
        throw new Error('No available ports in pool');
      }
    }
    
    this.portPool.allocated.set(taskId, taskPorts);
    return allocatedPorts;
  }

  /**
   * Release ports for a task
   * @private
   */
  _releasePorts(taskId) {
    this.portPool.allocated.delete(taskId);
  }

  /**
   * Build and start containers
   * @private
   */
  async _buildAndStartContainers(taskId, worktreePath, containerConfig, allocatedPorts, envOverrides, portBindings) {
    const containers = [];
    const services = [];
    
    try {
      if (containerConfig.type === 'compose') {
        // Handle docker-compose
        const result = await this._handleDockerCompose(
          taskId, 
          worktreePath, 
          containerConfig, 
          allocatedPorts, 
          envOverrides
        );
        containers.push(...result.containers);
        services.push(...result.services);
      } else if (containerConfig.type === 'dockerfile') {
        // Handle single Dockerfile
        const result = await this._handleDockerfile(
          taskId, 
          worktreePath, 
          containerConfig, 
          allocatedPorts[0], 
          envOverrides,
          portBindings
        );
        containers.push(result.container);
        services.push(result.service);
      }
      
      return {
        containerInfo: { containers, services },
        services
      };
    } catch (error) {
      // Cleanup on failure
      await this._cleanupFailedContainers(containers);
      throw error;
    }
  }

  /**
   * Handle docker-compose deployment
   * @private
   */
  async _handleDockerCompose(taskId, worktreePath, containerConfig, allocatedPorts, envOverrides) {
    // This is a placeholder implementation
    // In a real implementation, this would:
    // 1. Parse the docker-compose.yml
    // 2. Override port mappings with allocated ports
    // 3. Set environment variables
    // 4. Add labels for task identification
    // 5. Run docker-compose up -d
    // 6. Return container and service information
    
    const containers = [];
    const services = [];
    
    // For now, return mock data that matches the existing controller
    const mockPort = allocatedPorts[0] || 9001;
    containers.push({
      id: `task-${taskId}-web`,
      service: 'web-app',
      image: 'placeholder',
      port: mockPort
    });
    
    services.push({
      id: '1',
      name: 'web-app',
      port: mockPort,
      status: 'running',
      autoAssigned: true,
      type: 'web-app'
    });
    
    return { containers, services };
  }

  /**
   * Handle single Dockerfile deployment
   * @private
   */
  async _handleDockerfile(taskId, worktreePath, containerConfig, port, envOverrides, portBindings) {
    // This is a placeholder implementation
    // In a real implementation, this would:
    // 1. Build the Docker image
    // 2. Run the container with proper port mapping
    // 3. Set environment variables
    // 4. Add labels for task identification
    // 5. Return container and service information
    
    const containerId = `task-${taskId}-app`;
    
    return {
      container: {
        id: containerId,
        service: 'app',
        image: `pocketdev-task-${taskId}`,
        port
      },
      service: {
        id: '1',
        name: 'app',
        port,
        status: 'running',
        autoAssigned: true,
        type: 'web-app'
      }
    };
  }

  /**
   * Get currently running services for a task
   * @private
   */
  async _getRunningServices(taskId) {
    const containerInfo = this.containers.get(taskId);
    if (!containerInfo) {
      return [];
    }
    
    // Filter for running containers and return as services
    const runningServices = [];
    
    for (const container of containerInfo.containers) {
      try {
        const { stdout } = await execAsync(
          `docker inspect ${container.id} --format='{{.State.Status}}'`
        );
        
        if (stdout.trim() === 'running') {
          runningServices.push({
            id: container.id.substring(0, 12),
            name: container.service,
            port: container.port,
            status: 'running',
            autoAssigned: true,
            type: container.service === 'web-app' ? 'web-app' : 'service'
          });
        }
      } catch (error) {
        // Container not found or error - skip
        continue;
      }
    }
    
    return runningServices;
  }

  /**
   * Remove task-specific volumes
   * @private
   */
  async _removeTaskVolumes(taskId) {
    try {
      // List volumes with task label
      const { stdout } = await execAsync(
        `docker volume ls --filter "label=${this.dockerConfig.labelPrefix}.task=${taskId}" --format "{{.Name}}"`
      );
      
      const volumes = stdout.trim().split('\n').filter(v => v);
      
      // Remove each volume
      for (const volume of volumes) {
        try {
          await execAsync(`docker volume rm ${volume}`);
        } catch (error) {
          console.warn(`Failed to remove volume ${volume}:`, error.message);
        }
      }
    } catch (error) {
      console.warn('Failed to remove task volumes:', error.message);
    }
  }

  /**
   * Cleanup containers that failed to start properly
   * @private
   */
  async _cleanupFailedContainers(containers) {
    for (const container of containers) {
      try {
        await execAsync(`docker rm -f ${container.id}`);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}