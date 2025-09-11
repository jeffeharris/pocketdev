/**
 * ServerOrchestrator - Deep Module for Server Initialization
 * 
 * Orchestrates the entire server startup sequence with a simple interface.
 * Hides the complexity of initialization order, dependency wiring, and server configuration.
 * 
 * Public API (3 methods):
 * - initialize() - Initialize all systems
 * - start() - Start the server
 * - getServices() - Get initialized services (for shutdown)
 */

import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import { getDatabase } from '../db/index.js';
import Models from '../db/models/index.js';
import { MigrationService } from './migration.service.js';
import { ServiceInitializer } from './service-initializer.js';
import { SettingsLoader } from './settings-loader.js';
import { MonitoringInitializer } from './monitoring-initializer.js';
import { WebSocketService } from './websocket.service.js';
import createRoutes from '../routes/index.js';
import { addErrorHandlers } from '../app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ServerOrchestrator {
  constructor(app, config) {
    this.app = app;
    this.config = config;
    this.db = null;
    this.services = null;
    this.server = null;
    this.initialized = false;
  }

  /**
   * Initialize all systems in the correct order
   * @returns {Promise<{success: boolean}>}
   */
  async initialize() {
    try {
      console.log('Starting server initialization...');
      
      // Phase 1: Environment setup
      await this._ensureProjectsDir();
      
      // Phase 2: Database and core services
      const { models, services, eventEmitterService, githubTokenService } = 
        await this._initializeDatabase();
      
      // Phase 3: Settings and configuration
      const { allSettings, github } = await this._loadSettings();
      
      // Phase 4: Consolidate services
      this._consolidateServices(services, {
        github,
        githubTokenService,
        settings: allSettings
      });
      
      // Phase 5: Configure Express app
      this._configureExpressApp(services, models);
      
      // Phase 6: Create servers
      this.server = this._createHttpServer();
      const { wss, webSocketService } = this._createWebSocketServer(eventEmitterService);
      services.wss = wss;
      services.webSocketService = webSocketService;
      
      // Phase 7: Initialize monitoring
      await this._initializeMonitoring(models, eventEmitterService, githubTokenService, services);
      
      this.services = services;
      this.initialized = true;
      
      console.log('Server initialization complete');
      return { success: true };
    } catch (error) {
      console.error('Server initialization failed:', error);
      return { success: false, error };
    }
  }

  /**
   * Start the server listening
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.initialized) {
      throw new Error('Server not initialized. Call initialize() first.');
    }
    
    return new Promise((resolve) => {
      this.server.listen(this.config.port, () => {
        this._logStartupInfo();
        resolve();
      });
    });
  }

  /**
   * Get services for shutdown or external access
   * @returns {Object} Services and database
   */
  getServices() {
    return {
      db: this.db,
      sessionCleanupService: this.services?.SessionCleanupService
    };
  }

  // Private methods - hidden implementation details

  async _ensureProjectsDir() {
    try {
      await fs.mkdir(this.config.projectsDir, { recursive: true });
      console.log(`Projects directory ensured: ${this.config.projectsDir}`);
    } catch (error) {
      console.error('Failed to create projects directory:', error);
      throw error;
    }
  }

  async _initializeDatabase() {
    this.db = await getDatabase();
    const models = new Models(this.db);
    console.log('Database initialized');
    
    // Run migrations
    const migrationService = new MigrationService(this.db, {
      dbPath: this.config.dbPath,
      migrationsDir: path.join(__dirname, '../db/migrations')
    });
    
    const migrationResult = await migrationService.runPendingMigrations();
    if (!migrationResult.success) {
      console.error('Some migrations failed:', 
        migrationResult.migrations.filter(m => m.status === 'failed'));
    }
    
    // Initialize services
    const serviceInitializer = new ServiceInitializer(models, this.db, this.config);
    const { services, eventEmitterService, githubTokenService } = 
      await serviceInitializer.initializeServices();
    
    return { models, services, eventEmitterService, githubTokenService };
  }

  async _loadSettings() {
    const settingsLoader = new SettingsLoader(this.db, this.config);
    const allSettings = await settingsLoader.loadAllSettings();
    const { github } = settingsLoader.getSettings();
    
    return { allSettings, github };
  }

  _consolidateServices(services, additionalServices) {
    // Add additional services to the main services object
    Object.entries(additionalServices).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        services[key] = value;
      }
    });
  }

  _configureExpressApp(services, models) {
    // Add service middleware using closure
    this.app.use((req, res, next) => {
      req.services = services;
      next();
    });
    
    // Mount routes
    const routes = createRoutes(models, this.config.projectsDir);
    this.app.use('/api', routes);
    
    // Add error handlers
    addErrorHandlers(this.app);
  }

  _createHttpServer() {
    return createServer(this.app);
  }

  _createWebSocketServer(eventEmitterService) {
    const wss = new WebSocketServer({ 
      server: this.server, 
      path: '/ws' 
    });
    
    const webSocketService = new WebSocketService(wss, eventEmitterService);
    
    return { wss, webSocketService };
  }

  async _initializeMonitoring(models, eventEmitterService, githubTokenService, services) {
    const monitoringInitializer = new MonitoringInitializer(
      this.config,
      models,
      eventEmitterService,
      githubTokenService
    );
    
    const { success, monitors } = await monitoringInitializer.initialize();
    
    if (success) {
      // Add monitoring services
      Object.assign(services, {
        aiMonitor: monitors.aiMonitor,
        wsAdapter: monitors.sessionMonitor,
        notificationService: monitors.notificationService,
        gitStatusMonitor: monitors.gitStatusMonitor,
        models // Add models for controller access
      });
      
      // Set monitoring dependencies
      const monitoringService = services.MonitoringService;
      if (monitoringService) {
        monitoringService.setMonitoringDependencies(
          monitors.aiMonitor, 
          monitors.notificationService
        );
      }
    }
    
    return success;
  }

  _logStartupInfo() {
    console.log(`Project Manager API running on port ${this.config.port}`);
    console.log(`WebSocket server running on ws://${this.config.host || '0.0.0.0'}:${this.config.port}/ws`);
    console.log(`Projects directory: ${this.config.projectsDir}`);
    console.log(`Database: ${this.config.dbPath}`);
    console.log(`Connected to Shelltender service at ${this.config.shelltenderWsUrl}`);
  }
}