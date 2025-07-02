import { SessionManager, BufferManager, SessionStore, WebSocketServer } from 'shelltender';
import { WebSocketServer as WSServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration for shelltender
const config = {
  sessionStore: {
    // Store sessions in a dedicated directory
    basePath: path.join(__dirname, '../data/shelltender-sessions'),
    maxSessions: 100
  },
  bufferManager: {
    maxBufferSize: 10000, // 10k lines of scrollback
    persistToDisk: true
  },
  shell: {
    defaultShell: 'bash',
    defaultCwd: process.env.HOME || '/workspace'
  }
};

// Initialize shelltender components
let sessionManager;
let bufferManager;
let sessionStore;
let wsServer;

export async function initializeShelltender(server) {
  console.log('Initializing Shelltender...');
  
  // Create session store
  sessionStore = new SessionStore({
    basePath: config.sessionStore.basePath,
    maxSessions: config.sessionStore.maxSessions
  });
  
  // Create buffer manager
  bufferManager = new BufferManager({
    maxBufferSize: config.bufferManager.maxBufferSize,
    persistToDisk: config.bufferManager.persistToDisk,
    storePath: path.join(config.sessionStore.basePath, 'buffers')
  });
  
  // Create session manager
  sessionManager = new SessionManager({
    sessionStore,
    bufferManager,
    defaultShell: config.shell.defaultShell,
    defaultCwd: config.shell.defaultCwd
  });
  
  // Initialize session manager
  await sessionManager.initialize();
  
  // Create WebSocket server for shelltender
  const wss = new WSServer({ 
    server,
    path: '/ws/shelltender'
  });
  
  // Create shelltender WebSocket server wrapper
  wsServer = new WebSocketServer({
    wss,
    sessionManager,
    // Enable mobile optimizations
    enableTouchSupport: true,
    enableVirtualKeyboard: true,
    // Session options
    sessionTimeout: 30 * 60 * 1000, // 30 minutes
    reconnectTimeout: 5 * 60 * 1000 // 5 minutes
  });
  
  // Start the WebSocket server
  await wsServer.start();
  
  console.log('Shelltender initialized successfully');
  console.log(`Session data directory: ${config.sessionStore.basePath}`);
  console.log(`WebSocket endpoint: ws://localhost:3005/ws/shelltender`);
  
  return {
    sessionManager,
    bufferManager,
    sessionStore,
    wsServer
  };
}

// Create a new session for a task
export async function createTaskSession(taskId, worktreePath, metadata = {}) {
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  const sessionId = `task-${taskId}`;
  
  // Check if session already exists
  let session = await sessionManager.getSession(sessionId);
  
  if (!session) {
    // Create new session
    session = await sessionManager.createSession({
      id: sessionId,
      name: `Task ${taskId}`,
      command: 'bash',
      cwd: worktreePath,
      env: {
        ...process.env,
        TASK_ID: taskId,
        WORKTREE_PATH: worktreePath
      },
      metadata: {
        taskId,
        worktreePath,
        createdAt: new Date().toISOString(),
        ...metadata
      }
    });
    
    console.log(`Created new session for task ${taskId}`);
  } else {
    console.log(`Reusing existing session for task ${taskId}`);
  }
  
  return session;
}

// Execute a command in a session
export async function executeCommand(sessionId, command) {
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  const session = await sessionManager.getSession(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  // Send command to session
  await session.write(command + '\n');
  
  return session;
}

// Get session info and recent output
export async function getSessionInfo(sessionId) {
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  const session = await sessionManager.getSession(sessionId);
  if (!session) {
    return null;
  }
  
  // Get buffer content
  const buffer = await bufferManager.getBuffer(sessionId);
  const recentOutput = buffer ? buffer.getRecentLines(100) : [];
  
  return {
    id: session.id,
    name: session.name,
    status: session.status,
    metadata: session.metadata,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    recentOutput
  };
}

// List all active sessions
export async function listSessions() {
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  const sessions = await sessionManager.listSessions();
  
  return sessions.map(session => ({
    id: session.id,
    name: session.name,
    status: session.status,
    metadata: session.metadata,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity
  }));
}

// Close a session
export async function closeSession(sessionId) {
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  await sessionManager.closeSession(sessionId);
  console.log(`Closed session ${sessionId}`);
}

// Clean up old sessions
export async function cleanupSessions(maxAge = 24 * 60 * 60 * 1000) { // 24 hours
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  const sessions = await sessionManager.listSessions();
  const now = Date.now();
  let cleaned = 0;
  
  for (const session of sessions) {
    const age = now - new Date(session.lastActivity).getTime();
    if (age > maxAge) {
      await closeSession(session.id);
      cleaned++;
    }
  }
  
  console.log(`Cleaned up ${cleaned} old sessions`);
  return cleaned;
}

// Export for use in other modules
export {
  sessionManager,
  bufferManager,
  sessionStore,
  wsServer
};