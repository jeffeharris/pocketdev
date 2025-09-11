import 'dotenv/config';
import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fetch from 'node-fetch';
import WebSocket, { WebSocketServer } from 'ws';
import config from './config/index.js';
import app, { addErrorHandlers } from './app.js';
import { getDatabase } from './db/index.js';
import Models from './db/models/index.js';
import createRoutes from './routes/index.js';
import { WebSocketService } from './services/websocket.service.js';
import { MigrationService } from './services/migration.service.js';
import { ServiceInitializer } from './services/service-initializer.js';
import { SettingsLoader } from './services/settings-loader.js';
import { MonitoringInitializer } from './services/monitoring-initializer.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Global instances (only for shutdown)
let db = null;
let sessionCleanupService = null;

// Ensure projects directory exists
async function ensureProjectsDir() {
  try {
    await fs.mkdir(config.projectsDir, { recursive: true });
    console.log(`Projects directory ensured: ${config.projectsDir}`);
  } catch (error) {
    console.error('Failed to create projects directory:', error);
    throw error;
  }
}

// Initialize database
async function initializeDatabase() {
  db = await getDatabase();
  const models = new Models(db);
  console.log('Database initialized');
  
  // Run pending migrations using MigrationService
  const migrationService = new MigrationService(db, {
    dbPath: config.dbPath,
    migrationsDir: path.join(__dirname, 'db/migrations')
  });
  
  const migrationResult = await migrationService.runPendingMigrations();
  if (!migrationResult.success) {
    console.error('Some migrations failed:', migrationResult.migrations.filter(m => m.status === 'failed'));
  }
  
  // Initialize all services using ServiceInitializer
  const serviceInitializer = new ServiceInitializer(models, db, config);
  const { services, eventEmitterService, githubTokenService } = await serviceInitializer.initializeServices();
  
  // Store cleanup service for shutdown
  sessionCleanupService = services.SessionCleanupService;
  
  // Return everything needed by the app
  return { 
    models, 
    services, 
    eventEmitterService, 
    githubTokenService 
  };
}

// Load settings
async function loadSettings(database) {
  const settingsLoader = new SettingsLoader(database, config);
  const allSettings = await settingsLoader.loadAllSettings();
  
  // Get GitHub instance if configured
  const { github: githubInstance } = settingsLoader.getSettings();
  
  return { 
    settingsLoader, 
    allSettings, 
    github: githubInstance 
  };
}


// Initialize WebSocket and monitoring
async function initializeMonitoring(models, eventEmitterService, githubTokenService, services) {
  // Create monitoring initializer
  const monitoringInitializer = new MonitoringInitializer(
    config,
    models,
    eventEmitterService,
    githubTokenService
  );
  
  // Initialize all monitoring systems
  const { success, monitors } = await monitoringInitializer.initialize();
  
  if (success) {
    // Add monitoring services to services object
    services.aiMonitor = monitors.aiMonitor;
    services.wsAdapter = monitors.sessionMonitor;
    services.notificationService = monitors.notificationService;
    services.gitStatusMonitor = monitors.gitStatusMonitor;
    services.models = models; // Add models to services for controller access
    
    // Set monitoring dependencies on MonitoringService
    const monitoringService = services.MonitoringService;
    monitoringService.setMonitoringDependencies(monitors.aiMonitor, monitors.notificationService);
  }
  
  return success;
}

// Start server
async function start() {
  try {
    await ensureProjectsDir();
    
    // Initialize database and services
    const { models, services, eventEmitterService, githubTokenService } = await initializeDatabase();
    
    // Load settings
    const { allSettings, github } = await loadSettings(db);
    
    // Add GitHub to services if configured
    if (github) {
      services.github = github;
    }
    services.githubTokenService = githubTokenService;
    services.settings = allSettings;
    
    // Add service middleware before routes using closure
    app.use((req, res, next) => {
      req.services = services;
      next();
    });
    
    // Mount routes after models are initialized
    const routes = createRoutes(models, config.projectsDir);
    app.use('/api', routes);
    
    // Add error handlers after routes
    addErrorHandlers(app);
    
    // Create HTTP server
    const server = createServer(app);
    
    // Create WebSocket server for app-level real-time updates
    const wss = new WebSocketServer({ server, path: '/ws' });
    
    // Initialize new WebSocketService with event-based pattern
    const webSocketService = new WebSocketService(wss, eventEmitterService);
    services.wss = wss;
    services.webSocketService = webSocketService;
    
    // Initialize monitoring with Shelltender v0.6.1 adapter
    await initializeMonitoring(models, eventEmitterService, githubTokenService, services);
    
    // Start listening
    server.listen(config.port, () => {
      console.log(`Project Manager API running on port ${config.port}`);
      console.log(`WebSocket server running on ws://${config.host || '0.0.0.0'}:${config.port}/ws`);
      console.log(`Projects directory: ${config.projectsDir}`);
      console.log(`Database: ${config.dbPath}`);
      console.log(`Connected to Shelltender service at ${config.shelltenderWsUrl}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  
  // Stop session cleanup service
  if (sessionCleanupService) {
    sessionCleanupService.stop();
    console.log('Session cleanup service stopped');
  }
  
  if (db) {
    await db.close();
    console.log('Database connection closed');
  }
  
  // WebSocket cleanup removed - handled by shelltender service
  
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the server
start();