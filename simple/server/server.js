import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import WebSocket from 'ws';
import config from './config/index.js';
import app, { addErrorHandlers } from './app.js';
import { getDatabase } from './db/index.js';
import Models from './db/models/index.js';
import GitHubAPI from './github.js';
import ShelltenderWebSocketClient from './shelltender-ws-client.js';
import { ShelltenderWSAdapter } from './shelltender-ws-adapter.js';
import { AISessionMonitor } from './ai-session-monitor.js';
import { NotificationService } from './notification-service.js';
import createRoutes from './routes/index.js';
import { cleanupOrphanedWorktrees } from './services/cleanup.service.js';

// Global instances
let db = null;
let models = null;
let github = null;
let aiMonitor = null;
let notificationService = null;

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
  
  // Check if migration needs to run
  try {
    const needsMigration = await db.get(
      `SELECT COUNT(*) as count FROM pragma_table_info('tasks') 
       WHERE name='merge_commit_sha'`
    );
    
    if (needsMigration.count === 0) {
      console.log('Running merge tracking migration...');
      const migrationPath = path.join(path.dirname(config.dbPath), 'migrations/add_merge_tracking.sql');
      const migration = await fs.readFile(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Migration completed');
    }
  } catch (error) {
    console.error('Migration check failed:', error);
  }
  
  // Store models in app locals for access in routes
  app.locals.models = models;
  app.locals.db = db;
  app.locals.projectsDir = config.projectsDir;
  
  // Run cleanup on startup
  await cleanupOrphanedWorktrees(models);
}

// Load settings
async function loadSettings() {
  try {
    const settingsData = await fs.readFile(config.settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    
    if (settings.githubToken) {
      github = new GitHubAPI(settings.githubToken);
      app.locals.github = github;
      console.log('GitHub integration enabled from settings');
    }
  } catch (error) {
    console.log('No settings file found or error loading:', error.message);
    
    // Fall back to environment variable
    if (config.githubToken) {
      github = new GitHubAPI(config.githubToken);
      app.locals.github = github;
      console.log('GitHub integration enabled from environment');
    }
  }
}

// Initialize WebSocket and monitoring
async function initializeMonitoring(server) {
  try {
    console.log('Initializing AI monitoring with Shelltender WebSocket adapter...');
    
    // Create the WebSocket adapter for terminal data monitoring
    const wsAdapter = new ShelltenderWSAdapter(config.shelltenderWsUrl);
    
    // Create WebSocket client for events and notifications
    const wsClient = new ShelltenderWebSocketClient(config.shelltenderWsUrl);
    wsClient.connect();
    
    // Initialize notification service
    notificationService = new NotificationService(wsClient);
    
    // Create AI monitor with the WebSocket adapter
    aiMonitor = new AISessionMonitor(wsAdapter, wsClient, notificationService);
    
    // Register AI patterns
    aiMonitor.registerPatterns(wsClient);
    
    // Register existing sessions with the adapter
    try {
      const response = await fetch(`${config.shelltenderApiUrl}/sessions`);
      if (response.ok) {
        const existingSessions = await response.json();
        console.log(`Found ${existingSessions.length} existing sessions`);
        
        for (const session of existingSessions) {
          if (session.id && session.id.startsWith('task-')) {
            console.log('Registering session for monitoring:', session.id);
            await aiMonitor.registerSessionPatterns(session.id);
            wsAdapter.registerSession(session.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to register existing sessions:', error);
    }
    
    // Listen for new session creation
    wsClient.on('session-created', async (event) => {
      if (event.id && event.id.startsWith('task-')) {
        console.log('New session created, registering for monitoring:', event.id);
        await aiMonitor.registerSessionPatterns(event.id);
        wsAdapter.registerSession(event.id);
      }
    });
    
    // Listen for session closure
    wsClient.on('session-closed', (sessionId) => {
      if (sessionId && sessionId.startsWith('task-')) {
        console.log('Session closed, unregistering:', sessionId);
        wsAdapter.unregisterSession(sessionId);
        aiMonitor.removeSession(sessionId);
      }
    });
    
    // Store in app locals for API access
    app.locals.aiMonitor = aiMonitor;
    app.locals.notificationService = notificationService;
    app.locals.wsClient = wsClient;
    app.locals.wsAdapter = wsAdapter;
    
    console.log('AI monitoring initialized successfully');
  } catch (error) {
    console.warn('Failed to initialize monitoring:', error.message);
    console.warn('Server will continue without AI monitoring features');
  }
}

// Start server
async function start() {
  try {
    await ensureProjectsDir();
    await initializeDatabase();
    await loadSettings();
    
    // Mount routes after models are initialized
    const routes = createRoutes(app);
    app.use('/api', routes);
    
    // Add error handlers after routes
    addErrorHandlers(app);
    
    // Create HTTP server
    const server = createServer(app);
    
    // Initialize monitoring
    await initializeMonitoring(server);
    
    // Start listening
    server.listen(config.port, () => {
      console.log(`Project Manager API running on port ${config.port}`);
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
  
  if (db) {
    await db.close();
    console.log('Database connection closed');
  }
  
  if (app.locals.wsClient) {
    app.locals.wsClient.close();
    console.log('WebSocket client closed');
  }
  
  if (app.locals.wsAdapter) {
    app.locals.wsAdapter.close();
    console.log('WebSocket adapter closed');
  }
  
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