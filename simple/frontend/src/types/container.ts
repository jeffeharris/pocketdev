export interface Service {
  id: string;
  name: string;
  port: number;
  status: 'running' | 'stopped' | 'starting' | 'error';
  autoAssigned: boolean;
  type?: 'web-app' | 'api' | 'database' | 'custom';
  url?: string;
}

export interface ContainerLogs {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  service?: string;
}

export interface DeploymentResult {
  success: boolean;
  services: Service[];
  error?: string;
  logs?: ContainerLogs[];
}

export interface ContainerConfig {
  timeoutMinutes: number;
  portRangeStart: number;
  portRangeEnd: number;
  enableDind: boolean;
}