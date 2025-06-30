import { createServer } from 'http';
import { promises as fs } from 'fs';
import path from 'path';
import config from './config/index.js';
import app from './app.js';
import { getDatabase } from './db/index.js';
import Models from './db/models/index.js';
import GitHubAPI from './github.js';
import ShelltenderWebSocketClient from './shelltender-ws-client.js';
import { AISessionMonitor } from './ai-session-monitor.js';
import { NotificationService } from './notification-service.js';

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
  // Connect to Shelltender WebSocket service
  const wsClient = new ShelltenderWebSocketClient(config.shelltenderWsUrl);
  wsClient.connect();
  
  // Initialize AI monitoring
  console.log('Initializing AI monitoring...');
  notificationService = new NotificationService(wsClient);
  
  // Create mock managers for AI monitor
  const mockSessionManager = {
    onData: (callback) => {
      wsClient.on('session-output', callback);
    }
  };
  
  const mockEventManager = {
    on: (event, callback) => {
      wsClient.on(event, callback);
    },
    emit: (event, data) => {
      wsClient.send({ type: event, ...data });
    }
  };
  
  aiMonitor = new AISessionMonitor(mockSessionManager, wsClient, notificationService);
  
  // Register AI patterns
  aiMonitor.registerPatterns(mockEventManager);
  
  // Listen for new session creation
  wsClient.on('session-created', async (event) => {
    console.log('New session created, registering AI patterns:', event.id);
    await aiMonitor.registerSessionPatterns(event.id);
  });
  
  // Store in app locals for API access
  app.locals.aiMonitor = aiMonitor;
  app.locals.notificationService = notificationService;
  app.locals.wsClient = wsClient;
  
  console.log('AI monitoring initialized successfully');
}

// Start server
async function start() {
  try {
    await ensureProjectsDir();
    await initializeDatabase();
    await loadSettings();
    
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
    console.log('WebSocket connection closed');
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