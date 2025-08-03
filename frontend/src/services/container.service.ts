/**
 * ContainerService - Container and deployment management
 * 
 * Handles Docker container operations for task environments.
 * This service manages container lifecycle and monitoring with a clean,
 * simple interface that hides deployment complexity.
 * 
 * Deep module design:
 * - Simple interface: 3 methods for core container operations
 * - Hidden complexity: Docker API integration, mock deployments, service management
 * - Clear abstraction: Users don't need to know about Docker internals or port assignment
 */

import { BaseService } from './base.service';
import type { 
  IContainerService 
} from './interfaces/container.service.interface';
import type { 
  DeploymentResult, 
  Service, 
  ContainerLogs 
} from '../types/container';

export class ContainerService extends BaseService implements IContainerService {
  private mockDeployments: Map<string, Service[]> = new Map();
  private mockLogs: Map<string, string[]> = new Map();

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Simple public interface - 3 core methods (deep module principle)

  async deployContainers(taskId: string): Promise<DeploymentResult> {
    if (this.isMockEnabled) {
      return this.handleMockDeployment(taskId);
    }
    
    const result = await this.post<DeploymentResult>(
      `/tasks/${taskId}/deploy`,
      {}
    );
    
    return result;
  }

  async stopContainers(taskId: string): Promise<void> {
    if (this.isMockEnabled) {
      this.handleMockStop(taskId);
      return;
    }
    
    await this.delete<void>(`/tasks/${taskId}/containers`);
  }

  async getContainerLogs(taskId: string): Promise<string[]> {
    if (this.isMockEnabled) {
      return this.mockLogs.get(taskId) || [];
    }
    
    const logs = await this.get<string[]>(`/tasks/${taskId}/container-logs`);
    return logs;
  }

  // Complex implementation hidden from users

  private handleMockDeployment(taskId: string): DeploymentResult {
    // Simulate deployment with different scenarios based on task ID
    const isEvenTask = parseInt(taskId.slice(-1), 10) % 2 === 0;
    
    if (isEvenTask) {
      // Successful deployment
      const services: Service[] = [
        { 
          id: `${taskId}-web`, 
          name: 'web-app', 
          port: 9001, 
          status: 'running', 
          autoAssigned: true, 
          type: 'web-app',
          url: 'http://localhost:9001'
        },
        { 
          id: `${taskId}-api`, 
          name: 'api', 
          port: 9002, 
          status: 'running', 
          autoAssigned: true, 
          type: 'api',
          url: 'http://localhost:9002'
        },
        { 
          id: `${taskId}-db`, 
          name: 'database', 
          port: 9003, 
          status: 'stopped', 
          autoAssigned: true, 
          type: 'database'
        }
      ];
      
      this.mockDeployments.set(taskId, services);
      
      // Add deployment logs
      const deploymentLogs = [
        '[10:30:45] Starting container deployment...',
        '[10:30:46] Building Docker images...',
        '[10:30:50] Starting web-app service on port 9001',
        '[10:30:52] Starting api service on port 9002',
        '[10:30:55] All services started successfully'
      ];
      this.mockLogs.set(taskId, deploymentLogs);
      
      return {
        success: true,
        services,
        logs: deploymentLogs.map(msg => this.createLogEntry(msg))
      };
    } else {
      // Failed deployment scenario
      const errorLogs = [
        '[10:30:45] Starting container deployment...',
        '[10:30:46] Building Docker images...',
        '[10:30:50] ERROR: Failed to build web-app image',
        '[10:30:51] ERROR: Port 9001 already in use',
        '[10:30:52] Deployment failed'
      ];
      this.mockLogs.set(taskId, errorLogs);
      
      return {
        success: false,
        services: [],
        error: 'Failed to deploy containers: Port conflicts detected',
        logs: errorLogs.map(msg => this.createLogEntry(msg))
      };
    }
  }

  private handleMockStop(taskId: string): void {
    // Remove from mock deployments and add stop logs
    this.mockDeployments.delete(taskId);
    
    const stopLogs = [
      '[' + new Date().toTimeString().slice(0, 8) + '] Stopping all containers...',
      '[' + new Date().toTimeString().slice(0, 8) + '] All containers stopped successfully'
    ];
    
    const existingLogs = this.mockLogs.get(taskId) || [];
    this.mockLogs.set(taskId, [...existingLogs, ...stopLogs]);
  }

  private createLogEntry(message: string): ContainerLogs {
    const timestamp = new Date().toISOString();
    
    // Parse log level from message
    let level: ContainerLogs['level'] = 'info';
    if (message.includes('ERROR')) {
      level = 'error';
    } else if (message.includes('WARN')) {
      level = 'warn';
    } else if (message.includes('DEBUG')) {
      level = 'debug';
    }
    
    // Extract service name if present
    let service: string | undefined;
    if (message.includes('web-app')) {
      service = 'web-app';
    } else if (message.includes('api')) {
      service = 'api';
    } else if (message.includes('database')) {
      service = 'database';
    }
    
    return {
      timestamp,
      level,
      message,
      service
    };
  }

  private generatePortNumber(): number {
    // Generate random port in development range (9000-9999)
    return Math.floor(Math.random() * 1000) + 9000;
  }

  protected initializeMockData(): void {
    // Initialize with some sample deployments for development
    const sampleServices: Service[] = [
      {
        id: 'sample-web',
        name: 'web-app',
        port: 9001,
        status: 'running',
        autoAssigned: true,
        type: 'web-app',
        url: 'http://localhost:9001'
      },
      {
        id: 'sample-api',
        name: 'api',
        port: 9002,
        status: 'running',
        autoAssigned: true,
        type: 'api',
        url: 'http://localhost:9002'
      }
    ];
    
    const sampleLogs = [
      '[09:15:30] Container deployment initiated',
      '[09:15:31] Building application images...',
      '[09:15:35] Starting web application on port 9001',
      '[09:15:37] Starting API server on port 9002',
      '[09:15:40] All services running successfully'
    ];
    
    // Add sample data for mock tasks
    this.mockDeployments.set('task_1', sampleServices);
    this.mockDeployments.set('task_2', [sampleServices[0]]); // Only web-app
    
    this.mockLogs.set('task_1', sampleLogs);
    this.mockLogs.set('task_2', sampleLogs.slice(0, 3)); // Partial logs
  }
}