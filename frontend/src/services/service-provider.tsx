/**
 * ServiceProvider - React Context for dependency injection of services
 * 
 * Provides:
 * - Centralized service management
 * - Lazy initialization of services
 * - TypeScript-friendly service access
 * - Mock support configuration
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { BaseService } from './base.service';
import { SessionAdapter, sessionAdapter } from './session-adapter';
import { SettingsService } from './settings.service';
import { UploadService } from './upload.service';
import { GitService } from './git.service';
import { TerminalService } from './terminal.service';
import { ContainerService } from './container.service';
import { PullRequestService } from './pull-request.service';
import { ProjectService } from './project.service';

// Service registry types
export type ServiceType = 'project' | 'task' | 'git' | 'terminal' | 'settings' | 'upload' | 'container' | 'pullRequest';

export interface ServiceConfig {
  mockEnabled?: boolean;
  baseUrl?: string;
}

export interface ServiceRegistry {
  // Core services
  project: ProjectService;     // Phase 3 implemented
  task: any;                   // Will be TaskService
  git: GitService;             // Phase 2 implemented
  terminal: TerminalService;   // Phase 2 implemented
  settings: SettingsService;   // Phase 1 implemented
  upload: UploadService;       // Phase 1 implemented
  container: ContainerService; // Phase 3 implemented
  pullRequest: PullRequestService; // Phase 3 implemented
  
  // Infrastructure
  sessionAdapter: SessionAdapter;
}

// Service context
interface ServiceContextValue {
  services: ServiceRegistry;
  config: ServiceConfig;
  isInitialized: boolean;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

/**
 * Hook to access services from components
 */
export function useService<T extends keyof ServiceRegistry>(
  serviceType: T
): ServiceRegistry[T] {
  const context = useContext(ServiceContext);
  
  if (!context) {
    throw new Error('useService must be used within a ServiceProvider');
  }

  if (!context.isInitialized) {
    throw new Error('Services are not yet initialized');
  }

  const service = context.services[serviceType];
  if (!service) {
    throw new Error(`Service '${serviceType}' is not registered`);
  }

  return service;
}

/**
 * Hook to access the session adapter specifically
 */
export function useSessionAdapter(): SessionAdapter {
  return useService('sessionAdapter');
}

/**
 * Hook to access service configuration
 */
export function useServiceConfig(): ServiceConfig {
  const context = useContext(ServiceContext);
  
  if (!context) {
    throw new Error('useServiceConfig must be used within a ServiceProvider');
  }

  return context.config;
}

/**
 * ServiceProvider component props
 */
interface ServiceProviderProps {
  children: React.ReactNode;
  config?: ServiceConfig;
}

/**
 * ServiceProvider - Provides services via React Context
 */
export function ServiceProvider({ children, config = {} }: ServiceProviderProps) {
  const [services, setServices] = useState<ServiceRegistry | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Merge default config with provided config
  const serviceConfig: ServiceConfig = {
    mockEnabled: import.meta.env.VITE_USE_MOCKS === 'true',
    baseUrl: '/api',
    ...config,
  };

  useEffect(() => {
    async function initializeServices() {
      try {
        // Create service instances
        const serviceRegistry: ServiceRegistry = {
          // Phase 3 services - actual implementations
          project: new ProjectService(serviceConfig),
          container: new ContainerService(serviceConfig),
          pullRequest: new PullRequestService(serviceConfig),
          
          // Phase 1 & 2 services - actual implementations
          git: new GitService(serviceConfig),
          terminal: new TerminalService(serviceConfig),
          settings: new SettingsService(serviceConfig),
          upload: new UploadService(serviceConfig),
          
          // Still to be implemented
          task: createPlaceholderService('task', serviceConfig),
          
          // Infrastructure services
          sessionAdapter: sessionAdapter,
        };

        setServices(serviceRegistry);
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize services:', error);
        // In a real app, you might want to show an error UI
      }
    }

    initializeServices();
  }, [serviceConfig.mockEnabled, serviceConfig.baseUrl]);

  if (!services || !isInitialized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <div className="text-gray-600">Initializing services...</div>
        </div>
      </div>
    );
  }

  const contextValue: ServiceContextValue = {
    services,
    config: serviceConfig,
    isInitialized,
  };

  return (
    <ServiceContext.Provider value={contextValue}>
      {children}
    </ServiceContext.Provider>
  );
}

/**
 * Create a placeholder service for development
 * This will be replaced when actual services are implemented
 */
function createPlaceholderService(name: string, config: ServiceConfig) {
  return new (class PlaceholderService extends BaseService {
    constructor() {
      super(config);
      console.log(`Placeholder ${name} service initialized`);
    }
    
    // Add any common methods that all services might need
    async ping() {
      return { service: name, status: 'ok', mock: this.isMockEnabled };
    }
  })();
}

/**
 * ServiceConsumer - Render prop component for accessing services
 * Alternative to useService hook for class components
 */
interface ServiceConsumerProps {
  children: (services: ServiceRegistry, config: ServiceConfig) => React.ReactNode;
}

export function ServiceConsumer({ children }: ServiceConsumerProps) {
  const context = useContext(ServiceContext);
  
  if (!context) {
    throw new Error('ServiceConsumer must be used within a ServiceProvider');
  }

  if (!context.isInitialized) {
    return <div>Services initializing...</div>;
  }

  return <>{children(context.services, context.config)}</>;
}