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
import GitHubAPI from './github.js';
// Shelltender v0.5.0 - WebSocket client functionality is now provided by the service
import { AISessionMonitor } from './ai-session-monitor.js';
import { NotificationService } from './notification-service.js';
import { createSessionMonitor } from './shelltender-session-monitor.js';
import createRoutes from './routes/index.js';
import { cleanupOrphanedWorktrees } from './services/cleanup.service.js';
import { SessionCleanupService } from './services/session-cleanup.service.js';
import { initializeWebSocketEvents } from './services/websocket-events.js';
import { initializeGitStatusMonitor } from './git-status-monitor.js';
import { getGitHubTokenService } from './services/github-token.service.js';

// ES Module compatibility
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  
  // Check if lifecycle migration needs to run
  try {
    const needsLifecycleMigration = await db.get(
      `SELECT COUNT(*) as count FROM pragma_table_info('tasks') 
       WHERE name='task_chain_id'`
    );
    
    if (needsLifecycleMigration.count === 0) {
      console.log('Running task lifecycle migration...');
      const migrationPath = path.join(path.dirname(__filename), 'db/migrations/001_task_lifecycle.sql');
      const migration = await fs.readFile(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Task lifecycle migration completed');
    }
  } catch (error) {
    console.error('Lifecycle migration check failed:', error);
  }
  
  // Check if multi-terminal sessions migration needs to run
  try {
    const needsMultiTerminalMigration = await db.get(
      `SELECT COUNT(*) as count FROM pragma_table_info('terminal_sessions') 
       WHERE name='tab_name'`
    );
    
    if (needsMultiTerminalMigration.count === 0) {
      console.log('Running multi-terminal sessions migration...');
      const migrationPath = path.join(path.dirname(__filename), 'db/migrations/003_multi_terminal_sessions.sql');
      const migration = await fs.readFile(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Multi-terminal sessions migration completed');
    }
  } catch (error) {
    console.error('Multi-terminal sessions migration check failed:', error);
  }

  // Check if split view layouts migration needs to run
  try {
    const needsSplitViewMigration = await db.get(
      `SELECT COUNT(*) as count FROM pragma_table_info('tasks') 
       WHERE name='split_layout'`
    );
    
    if (needsSplitViewMigration.count === 0) {
      console.log('Running split view layouts migration...');
      const migrationPath = path.join(path.dirname(__filename), 'db/migrations/004_split_view_layouts.sql');
      const migration = await fs.readFile(migrationPath, 'utf8');
      await db.exec(migration);
      console.log('Split view layouts migration completed');
    }
  } catch (error) {
    console.error('Split view layouts migration check failed:', error);
  }
  
  // Store models in app locals for access in routes
  app.locals.models = models;
  app.locals.db = db;
  app.locals.projectsDir = config.projectsDir;
  
  // Initialize GitHub token service
  const githubTokenService = getGitHubTokenService(db);
  app.locals.githubTokenService = githubTokenService;
  
  // Run cleanup on startup
  await cleanupOrphanedWorktrees(models);
  
  // Initialize session cleanup service
  const sessionCleanupService = new SessionCleanupService(db, models);
  app.locals.sessionCleanupService = sessionCleanupService;
  sessionCleanupService.start();
}

// Load settings
async function loadSettings() {
  try {
    // First check database for GitHub token
    const githubTokenSetting = await app.locals.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['github_token']
    );
    
    if (githubTokenSetting?.value) {
      // Import decrypt function
      const { decrypt } = await import('./utils/crypto.js');
      const decryptedToken = decrypt(githubTokenSetting.value);
      const token = decryptedToken || githubTokenSetting.value; // Fallback to raw value if decryption fails
      
      github = new GitHubAPI(token);
      app.locals.github = github;
      console.log('GitHub integration enabled from database');
      return;
    }
    
    // Then check settings file
    const settingsData = await fs.readFile(config.settingsPath, 'utf8');
    const settings = JSON.parse(settingsData);
    
    if (settings.githubToken) {
      github = new GitHubAPI(settings.githubToken);
      app.locals.github = github;
      console.log('GitHub integration enabled from settings file');
    }
  } catch (error) {
    console.log('No settings found or error loading:', error.message);
    
    // Fall back to environment variable
    if (config.githubToken) {
      github = new GitHubAPI(config.githubToken);
      app.locals.github = github;
      console.log('GitHub integration enabled from environment');
    }
  }
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
async function initializeMonitoring(server, wsEventService, models) {
  try {
    console.log('Initializing AI monitoring...');
    
    // Create Shelltender session monitor for v0.6.1
    const sessionMonitor = await createSessionMonitor({
      wsUrl: config.shelltenderWsUrl,
      apiUrl: config.shelltenderApiUrl
    });
    
    console.log('Shelltender session monitor initialized');
    
    // For backward compatibility, create a wsClient that wraps the monitor
    const wsClient = { 
      send: () => {}, 
      on: (event, handler) => sessionMonitor.on(event, handler),
      connect: () => Promise.resolve()
    };
    
    // Initialize notification service
    notificationService = new NotificationService(wsClient);
    
    // Create AI monitor with the session monitor as sessionManager
    aiMonitor = new AISessionMonitor(sessionMonitor, wsClient, notificationService, wsEventService, models);
    
    // Register AI patterns
    aiMonitor.registerPatterns(wsClient);
    
    // Register existing sessions for pattern tracking (monitor mode receives all automatically)
    try {
      const response = await fetch(`${config.shelltenderApiUrl}/api/sessions`);
      if (response.ok) {
        const existingSessions = await response.json();
        console.log(`Found ${existingSessions.length} existing sessions`);
        
        // In monitor mode, we just need to set up pattern tracking
        // The monitor adapter automatically receives data from ALL sessions
        for (const session of existingSessions) {
          if (session.id && session.id.startsWith('task-')) {
            console.log('Setting up pattern tracking for session:', session.id);
            await aiMonitor.registerSessionPatterns(session.id);
          }
        }
      }
    } catch (error) {
      console.error('Failed to register existing sessions:', error);
    }
    
    // Listen for new task sessions to monitor
    // Note: We'll rely on the task creation endpoint to notify us
    // since Shelltender v0.6.1 doesn't have a global session event system
    
    // Listen for session closure
    wsClient.on('session-closed', (sessionId) => {
      if (sessionId && sessionId.startsWith('task-')) {
        console.log('Session closed, removing pattern tracking:', sessionId);
        aiMonitor.removeSession(sessionId);
        // Monitor mode continues to work for remaining sessions
      }
    });
    
    // Store in app locals for API access
    app.locals.aiMonitor = aiMonitor;
    app.locals.notificationService = notificationService;
    app.locals.wsClient = wsClient;
    app.locals.wsAdapter = sessionMonitor;
    
    console.log('AI monitoring initialized successfully');
    
    // Initialize git status monitoring
    const gitStatusMonitor = initializeGitStatusMonitor(models, wsEventService, app.locals.githubTokenService);
    app.locals.gitStatusMonitor = gitStatusMonitor;
    console.log('Git status monitoring initialized');
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
    
    // Create WebSocket server for app-level real-time updates
    const wss = new WebSocketServer({ server, path: '/ws' });
    
    // Store WebSocket server in app locals for access by services
    app.locals.wss = wss;
    
    // Initialize WebSocket event service
    const wsEventService = initializeWebSocketEvents(wss);
    app.locals.wsEventService = wsEventService;
    
    // Handle WebSocket connections
    wss.on('connection', (ws, req) => {
      console.log('New WebSocket client connected');
      
      // Store client metadata
      ws.clientId = Math.random().toString(36).substr(2, 9);
      ws.subscriptions = new Set();
      
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          handleWebSocketMessage(ws, data);
        } catch (error) {
          console.error('Invalid WebSocket message:', error);
        }
      });
      
      ws.on('close', () => {
        console.log(`WebSocket client ${ws.clientId} disconnected`);
      });
      
      ws.on('error', (error) => {
        console.error(`WebSocket client ${ws.clientId} error:`, error);
      });
      
      // Send initial connection success
      ws.send(JSON.stringify({ type: 'connected', clientId: ws.clientId }));
    });
    
    // Initialize monitoring with Shelltender v0.6.1 adapter
    await initializeMonitoring(server, wsEventService, models);
    
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