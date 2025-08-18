/**
 * ServiceInitializer - Deep Module for Service Initialization
 * 
 * Handles all service initialization and dependency injection with a simple interface.
 * Hides the complexity of service creation, dependency resolution, and registration.
 * 
 * Public API (2 methods):
 * - initializeServices() - Initialize all services with dependencies
 * - getServiceRegistry() - Get the initialized service registry
 */

import { getGitHubTokenService } from './github-token.service.js';
import { GitStatusService } from './git-status.service.js';
import GitOperationService from './git-operation.service.js';
import { TaskService } from './task.service.js';
import { ProjectService } from './project.service.js';
import { TerminalService } from './terminal.service.js';
import { PullRequestService } from './pull-request.service.js';
import { getEventEmitterService } from './event-emitter.service.js';
import { SettingsService } from './settings.service.js';
import { ContainerService } from './container.service.js';
import { UploadService } from './upload.service.js';
import { MonitoringService } from './monitoring.service.js';
import { SessionCleanupService } from './session-cleanup.service.js';
import { cleanupOrphanedWorktrees } from './cleanup.service.js';

export class ServiceInitializer {
  constructor(models, db, config) {
    this.models = models;
    this.db = db;
    this.config = config;
    this.services = null;
  }

  /**
   * Initialize all services with their dependencies
   * @returns {Promise<Object>} Object containing all initialized services and utilities
   */
  async initializeServices() {
    console.log('Initializing services...');
    
    // Initialize core services first
    const githubTokenService = getGitHubTokenService(this.db);
    const eventEmitterService = getEventEmitterService();
    
    // Create service registry
    this.services = {
      // Core dependencies
      models: this.models,
      EventEmitterService: eventEmitterService,
      GitHubTokenService: githubTokenService,
      githubTokenService: githubTokenService, // Compatibility alias
      
      // Domain Services
      GitStatusService: new GitStatusService(this.models, githubTokenService),
      GitOperationService: new GitOperationService(this.models, githubTokenService, eventEmitterService),
      TaskService: new TaskService(this.models, githubTokenService, eventEmitterService),
      ProjectService: new ProjectService(this.models, githubTokenService),
      TerminalService: new TerminalService(this.models, eventEmitterService),
      PullRequestService: new PullRequestService(this.models, githubTokenService, eventEmitterService),
      
      // Support Services
      SettingsService: new SettingsService(this.models, eventEmitterService),
      ContainerService: new ContainerService(this.models, eventEmitterService),
      UploadService: new UploadService(this.models, eventEmitterService),
      MonitoringService: new MonitoringService(this.models, eventEmitterService)
    };
    
    // Initialize cleanup services
    await this._initializeCleanupServices();
    
    console.log('Services initialized successfully');
    
    return {
      services: this.services,
      eventEmitterService,
      githubTokenService
    };
  }

  /**
   * Get the initialized service registry
   * @returns {Object|null} The service registry or null if not initialized
   */
  getServiceRegistry() {
    return this.services;
  }

  // Private methods (hidden complexity)
  
  async _initializeCleanupServices() {
    // Run initial cleanup
    await cleanupOrphanedWorktrees(this.models);
    console.log('Orphaned worktrees cleanup completed');
    
    // Initialize and start session cleanup service
    const sessionCleanupService = new SessionCleanupService(this.db, this.models);
    sessionCleanupService.start();
    
    // Add to services
    this.services.SessionCleanupService = sessionCleanupService;
    
    console.log('Cleanup services initialized');
  }
}