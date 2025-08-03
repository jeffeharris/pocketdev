/**
 * Service Infrastructure - Public API
 * 
 * This file exports the complete service infrastructure for use
 * throughout the frontend application.
 */

// Core service infrastructure
export { BaseService } from './base.service';
export { ServiceProvider, useService, useSessionAdapter, useServiceConfig } from './service-provider';
export { SessionAdapter, sessionAdapter } from './session-adapter';

// Types
export type { 
  NormalizedSessionId, 
  SessionInfo 
} from './session-adapter';

export type {
  // Base types
  ApiResponse,
  PaginatedResponse,
  ServiceResult,
  ServiceError,
  ServiceConfiguration,
  ServiceProviderConfig,
  
  // Service interfaces
  IServiceRegistry,
  IProjectService,
  ITaskService,
  IGitService,
  ITerminalService,
  ISettingsService,
  IUploadService,
  IContainerService,
  ISessionAdapter,
  
  // Pattern types
  CrudService,
  ProjectScopedService,
  ServiceHook,
  
  // Utility types
  ValidationRule,
  ValidationResult,
  ServiceEvent,
  ServiceEventHandler,
  CacheEntry,
  CacheOptions,
  ServiceState,
  ServiceMetrics,
  MockServiceOptions,
  MockService
} from './types';

// Error classes
export {
  ServiceError,
  ValidationError,
  NotFoundError,
  NetworkError
} from './base.service';

// Implemented services (for direct access if needed)
export { ProjectService } from './project.service';
export { TaskService } from './task.service';
export { GitService } from './git.service';
export { TerminalService } from './terminal.service';
export { SettingsService } from './settings.service';
export { UploadService } from './upload.service';
export { ContainerService } from './container.service';
export { PullRequestService } from './pull-request.service';

// Legacy API removed - components now use services directly

/**
 * Re-export the service type for convenience
 */
export type { ServiceType } from './service-provider';