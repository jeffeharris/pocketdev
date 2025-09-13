/**
 * Controller for container-related task operations
 * Handles HTTP requests and delegates container operations to ContainerService
 */
export class TaskContainerController {
  constructor(models) {
    this.models = models;
  }

  /**
   * Deploy containers for validation
   */
  async deployContainers(req, res) {
    const { projectId, taskId } = req.params;
    const { forceRecreate = false, environmentOverrides = {}, portBindings = {} } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get ContainerService from request services
      const containerService = req.services.ContainerService;
      
      // Create containers using the service
      const result = await containerService.createContainer(taskId, {
        forceRecreate,
        environmentOverrides,
        portBindings
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Stop containers
   */
  async stopContainers(req, res) {
    const { projectId, taskId } = req.params;
    const { removeVolumes = false, force = false } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get ContainerService from request services
      const containerService = req.services.ContainerService;
      
      // Stop containers using the service
      const result = await containerService.stopContainer(taskId, {
        removeVolumes,
        force
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get running services
   */
  async getServices(req, res) {
    const { projectId, taskId } = req.params;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get ContainerService from request services
      const containerService = req.services.ContainerService;
      
      // Get container status using the service
      const status = await containerService.getContainerStatus(taskId);
      
      res.json(status.services);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get preview URL
   */
  async getPreviewUrl(req, res) {
    const { projectId, taskId } = req.params;
    const { service } = req.query;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get ContainerService from request services
      const containerService = req.services.ContainerService;
      
      // Get preview URL using the service
      const result = await containerService.getPreviewUrl(taskId, service);
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Get container logs
   */
  async getContainerLogs(req, res) {
    const { projectId, taskId } = req.params;
    const { tail, since, follow, service } = req.query;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get ContainerService from request services
      const containerService = req.services.ContainerService;
      
      // Get container logs using the service
      const logs = await containerService.getContainerLogs(taskId, {
        tail: tail ? parseInt(tail) : 100,
        since,
        follow: follow === 'true',
        service
      });
      
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Launch debug shell in container
   */
  async debugShell(req, res) {
    const { projectId, taskId } = req.params;
    const { containerId, service } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get ContainerService from request services
      const containerService = req.services.ContainerService;
      
      // Get container status to verify container exists
      const status = await containerService.getContainerStatus(taskId);
      
      let targetContainer = null;
      if (containerId) {
        targetContainer = status.containers.find(c => c.id.startsWith(containerId));
      } else if (service) {
        targetContainer = status.containers.find(c => c.service === service);
      } else if (status.containers.length > 0) {
        targetContainer = status.containers[0]; // Use first container
      }
      
      if (!targetContainer || !targetContainer.running) {
        return res.status(400).json({ 
          error: 'No running container found for debug shell',
          availableContainers: status.containers.map(c => ({
            id: c.id.substring(0, 12),
            service: c.service,
            running: c.running
          }))
        });
      }
      
      // TODO: Create a Shelltender session attached to the container
      // This would involve creating a new terminal session that executes:
      // docker exec -it <containerId> /bin/bash
      
      res.json({
        shellUrl: `http://localhost:7681/?container=${targetContainer.id.substring(0, 12)}`,
        containerId: targetContainer.id.substring(0, 12),
        service: targetContainer.service
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  /**
   * Restart containers for a task
   */
  async restartContainers(req, res) {
    const { projectId, taskId } = req.params;
    const { service, recreate = false } = req.body;
    
    try {
      const task = await this.models.tasks.findById(taskId);
      if (!task || task.project_id !== projectId) {
        return res.status(404).json({ error: 'Task not found' });
      }

      // Get ContainerService from request services
      const containerService = req.services.ContainerService;
      
      // Restart containers using the service
      const result = await containerService.restartContainer(taskId, {
        service,
        recreate
      });
      
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}