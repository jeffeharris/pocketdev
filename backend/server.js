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

// Global instances
let db = null;
let models = null;
let github = null;

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
  models = new Models(db);
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
  
  // Store models in app locals for access in routes
  app.locals.models = models;
  app.locals.db = db;
  app.locals.projectsDir = config.projectsDir;
  
  // Initialize all services using ServiceInitializer
  const serviceInitializer = new ServiceInitializer(models, db, config);
  const { services, eventEmitterService, githubTokenService } = await serviceInitializer.initializeServices();
  
  // Store services in app.locals for backward compatibility
  app.locals.services = services;
  app.locals.githubTokenService = githubTokenService;
  app.locals.sessionCleanupService = services.SessionCleanupService;
  
  // Return services for use in the main server setup
  return { eventEmitterService, githubTokenService };
}

// Load settings
async function loadSettings() {
  const settingsLoader = new SettingsLoader(app.locals.db, config);
  const allSettings = await settingsLoader.loadAllSettings();
  
  // Get GitHub instance if configured
  const { github: githubInstance } = settingsLoader.getSettings();
  if (githubInstance) {
    github = githubInstance;
    app.locals.github = github;
  }
  
  // Store settings in app locals for backward compatibility
  app.locals.settings = allSettings;
  
  return settingsLoader;
}

// Handle WebSocket messages from clients
function handleWebSocketMessage(ws, data) {
  switch (data.type) {
    case 'subscribe':
      // Subscribe to updates for a specific project or task
      if (data.projectId) {
        ws.subscriptions.add(`project:${data.projectId}`);
        console.log(`Client ${ws.clientId} subscribed to project ${data.projectId}`);
      }
      if (data.taskId) {
        ws.subscriptions.add(`task:${data.taskId}`);
        console.log(`Client ${ws.clientId} subscribed to task ${data.taskId}`);
      }
      break;
      
    case 'unsubscribe':
      // Unsubscribe from updates
      if (data.projectId) {
        ws.subscriptions.delete(`project:${data.projectId}`);
      }
      if (data.taskId) {
        ws.subscriptions.delete(`task:${data.taskId}`);
      }
      break;
      
    default:
      console.log(`Unknown message type: ${data.type}`);
  }
}

// Initialize WebSocket and monitoring
async function initializeMonitoring(server, models, eventEmitterService, githubTokenService) {
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
    // Store monitors in app locals for backward compatibility (being phased out)
    app.locals.aiMonitor = monitors.aiMonitor;
    app.locals.notificationService = monitors.notificationService;
    app.locals.wsAdapter = monitors.sessionMonitor;
    app.locals.gitStatusMonitor = monitors.gitStatusMonitor;
    
    // Add monitoring services to services object
    app.locals.services.aiMonitor = monitors.aiMonitor;
    app.locals.services.wsAdapter = monitors.sessionMonitor;
    app.locals.services.notificationService = monitors.notificationService;
    app.locals.services.gitStatusMonitor = monitors.gitStatusMonitor;
    
    // Set monitoring dependencies on MonitoringService
    const monitoringService = app.locals.services.MonitoringService;
    monitoringService.setMonitoringDependencies(monitors.aiMonitor, monitors.notificationService);
  }
  
  return success;
}

// Start server
async function start() {
  try {
    await ensureProjectsDir();
    const { eventEmitterService, githubTokenService } = await initializeDatabase();
    const settingsLoader = await loadSettings();
    
    // Add service middleware before routes
    app.use((req, res, next) => {
      req.services = app.locals.services;
      next();
    });
    
    // Mount routes after models are initialized
    const routes = createRoutes(app);
    app.use('/api', routes);
    
    // Add error handlers after routes
    addErrorHandlers(app);
    
    // Create HTTP server
    const server = createServer(app);
    
    // Create WebSocket server for app-level real-time updates
    const wss = new WebSocketServer({ server, path: '/ws' });
    
    // Initialize new WebSocketService with event-based pattern
    const webSocketService = new WebSocketService(wss, eventEmitterService);
    
    // Store WebSocket services in app locals (for transition period)
    app.locals.wss = wss;
    app.locals.webSocketService = webSocketService;
    
    // Initialize monitoring with Shelltender v0.6.1 adapter
    await initializeMonitoring(server, models, eventEmitterService, githubTokenService);
    
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
  if (app.locals.sessionCleanupService) {
    app.locals.sessionCleanupService.stop();
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