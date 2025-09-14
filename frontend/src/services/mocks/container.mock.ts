/**
 * Mock data for ContainerService
 * Separated from production code for cleaner services
 */

import type { Service, ContainerLogs, DeploymentResult } from '../../types/container';

export const mockSampleServices: Service[] = [
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

export const mockSampleLogs = [
  '[09:15:30] Container deployment initiated',
  '[09:15:31] Building application images...',
  '[09:15:35] Starting web application on port 9001',
  '[09:15:37] Starting API server on port 9002',
  '[09:15:40] All services running successfully'
];

export const mockSuccessfulDeploymentLogs = [
  '[10:30:45] Starting container deployment...',
  '[10:30:46] Building Docker images...',
  '[10:30:50] Starting web-app service on port 9001',
  '[10:30:52] Starting api service on port 9002',
  '[10:30:55] All services started successfully'
];

export const mockFailedDeploymentLogs = [
  '[10:30:45] Starting container deployment...',
  '[10:30:46] Building Docker images...',
  '[10:30:50] ERROR: Failed to build web-app image',
  '[10:30:51] ERROR: Port 9001 already in use',
  '[10:30:52] Deployment failed'
];

export function createMockServices(taskId: string): Service[] {
  return [
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
}

export function createLogEntry(message: string): ContainerLogs {
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

export function generatePortNumber(): number {
  // Generate random port in development range (9000-9999)
  return Math.floor(Math.random() * 1000) + 9000;
}

export function createStopLogs(): string[] {
  const now = new Date().toTimeString().slice(0, 8);
  return [
    `[${now}] Stopping all containers...`,
    `[${now}] All containers stopped successfully`
  ];
}

// Initial mock deployments data
export const initialMockDeployments = new Map<string, Service[]>([
  ['task_1', mockSampleServices],
  ['task_2', [mockSampleServices[0]]] // Only web-app
]);

export const initialMockLogs = new Map<string, string[]>([
  ['task_1', mockSampleLogs],
  ['task_2', mockSampleLogs.slice(0, 3)] // Partial logs
]);