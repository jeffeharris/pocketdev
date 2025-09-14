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
import {
  createMockServices,
  createLogEntry,
  createStopLogs,
  mockSuccessfulDeploymentLogs,
  mockFailedDeploymentLogs,
  initialMockDeployments,
  initialMockLogs
} from './mocks/container.mock';

export class ContainerService extends BaseService implements IContainerService {
  private mockDeployments: Map<string, Service[]> = new Map(initialMockDeployments);
  private mockLogs: Map<string, string[]> = new Map(initialMockLogs);

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
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
      const services = createMockServices(taskId);
      
      this.mockDeployments.set(taskId, services);
      this.mockLogs.set(taskId, mockSuccessfulDeploymentLogs);
      
      return {
        success: true,
        services,
        logs: mockSuccessfulDeploymentLogs.map(msg => createLogEntry(msg))
      };
    } else {
      // Failed deployment scenario
      this.mockLogs.set(taskId, mockFailedDeploymentLogs);
      
      return {
        success: false,
        services: [],
        error: 'Failed to deploy containers: Port conflicts detected',
        logs: mockFailedDeploymentLogs.map(msg => createLogEntry(msg))
      };
    }
  }

  private handleMockStop(taskId: string): void {
    // Remove from mock deployments and add stop logs
    this.mockDeployments.delete(taskId);
    
    const stopLogs = createStopLogs();
    const existingLogs = this.mockLogs.get(taskId) || [];
    this.mockLogs.set(taskId, [...existingLogs, ...stopLogs]);
  }

}