import type { DeploymentResult } from '../../types/container';

/**
 * ContainerService Interface - Container and deployment management
 * 
 * Handles Docker container operations for task environments.
 * This service manages container lifecycle and monitoring.
 */

export interface IContainerService {
  /**
   * Deploy containers for a task
   * @param taskId Task identifier
   * @returns Promise<DeploymentResult> Deployment result with service details
   */
  deployContainers(taskId: string): Promise<DeploymentResult>;

  /**
   * Stop all containers for a task
   * @param taskId Task identifier
   * @returns Promise<void>
   */
  stopContainers(taskId: string): Promise<void>;

  /**
   * Get container logs for a task
   * @param taskId Task identifier
   * @returns Promise<string[]> Container log lines
   */
  getContainerLogs(taskId: string): Promise<string[]>;
}