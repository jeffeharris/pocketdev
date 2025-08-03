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

// Legacy API for migration (will be removed)
export { api } from './api';

/**
 * Re-export the service type for convenience
 */
export type { ServiceType } from './service-provider';