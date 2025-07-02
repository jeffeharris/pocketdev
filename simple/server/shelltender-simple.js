// Simplified Shelltender integration
// Work around module resolution issues by using direct imports

// Import only server components to avoid client-side ESM issues
import { 
  SessionManager, 
  BufferManager, 
  SessionStore, 
  WebSocketServer,
  TerminalDataPipeline,
  PipelineIntegration,
  EventManager
} from '@shelltender/server';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Global instances
let sessionManager = null;
let bufferManager = null;
let sessionStore = null;
let wsServer = null;
let pipeline = null;
let pipelineIntegration = null;
let eventManager = null;
let activeSessions = new Map();

// Initialize Shelltender
export async function initializeShelltender(httpServer) {
  console.log('Initializing Shelltender (simplified)...');
  
  try {
    // Create data directory
    const dataDir = path.join(__dirname, '../data/shelltender-sessions');
    await fs.mkdir(dataDir, { recursive: true });
    
    // Initialize components according to shelltender docs
    bufferManager = new BufferManager();
    
    // Initialize SessionStore with the data directory
    const sessionStorePath = path.join(dataDir, 'sessions');
    sessionStore = new SessionStore(sessionStorePath);
    
    // Await proper initialization as per v0.2.4
    await sessionStore.initialize();
    
    // SessionManager expects only sessionStore
    sessionManager = new SessionManager(sessionStore);
    
    // Create event manager for pattern matching
    eventManager = new EventManager();
    
    // Create data pipeline for processing terminal output
    pipeline = new TerminalDataPipeline();
    
    // Create WebSocket server using shelltender's WebSocketServer
    const port = 8080; // Use a different port for shelltender WebSocket
    wsServer = new WebSocketServer(port, sessionManager, bufferManager, eventManager);
    
    // Set up pipeline integration to connect all components
    pipelineIntegration = new PipelineIntegration(
      pipeline,
      sessionManager,
      bufferManager,
      wsServer,
      sessionStore,
      eventManager
    );
    pipelineIntegration.setup();
    
    
    console.log(`Shelltender WebSocket server listening on port ${port}`);
    console.log('Shelltender initialized successfully (simplified mode)');
    console.log('Session persistence enabled - sessions will be restored automatically');
    
    return { sessionManager, wsServer, bufferManager, sessionStore, pipeline, pipelineIntegration, eventManager };
    
  } catch (error) {
    console.error('Failed to initialize Shelltender:', error);
    throw error;
  }
}

// Create a task session
export async function createTaskSession(taskId, worktreePath, metadata = {}) {
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  const sessionId = `task-${taskId}`;
  
  try {
    // Check if session exists
    let session = activeSessions.get(sessionId);
    
    if (!session) {
      // Create session with proper options structure
      session = await sessionManager.createSession({
        id: sessionId,
        name: `Task ${taskId}`,
        command: 'bash',
        cwd: worktreePath,
        env: {
          ...process.env,
          TASK_ID: taskId,
          WORKTREE_PATH: worktreePath
        }
      });
      
      // Save session metadata for persistence
      await sessionStore.saveSession(sessionId, {
        session: {
          id: sessionId,
          name: `Task ${taskId}`,
          command: 'bash',
          createdAt: new Date(),
          lastAccessedAt: new Date(),
          cols: 80,
          rows: 24
        },
        cwd: worktreePath,
        env: {
          TASK_ID: taskId,
          WORKTREE_PATH: worktreePath
        },
        buffer: ''
      });
      
      activeSessions.set(sessionId, session);
      console.log(`Created shelltender session for task ${taskId} with persistence`);
      
      // Emit event for AI monitoring
      if (eventManager && eventManager.emit) {
        eventManager.emit('session-created', { id: sessionId, session });
      }
    }
    
    return {
      id: session.id,
      status: 'active',
      metadata: { ...metadata, taskId, worktreePath }
    };
    
  } catch (error) {
    console.error(`Failed to create session for task ${taskId}:`, error);
    throw error;
  }
}

// Execute command in session
export async function executeCommand(sessionId, command) {
  if (!sessionManager) {
    throw new Error('Shelltender not initialized');
  }
  
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  // Send command through session - get the actual session object from manager
  const activeSession = sessionManager.getSession(session.id);
  if (activeSession && activeSession.pty) {
    activeSession.pty.write(command + '\n');
  } else {
    throw new Error(`Session ${sessionId} PTY not available`);
  }
}

// Get session info
export async function getSessionInfo(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    return null;
  }
  
  return {
    id: session.id,
    status: 'active',
    createdAt: new Date().toISOString()
  };
}

// List all sessions
export async function listSessions() {
  return Array.from(activeSessions.values()).map(session => ({
    id: session.id,
    name: session.id,
    status: 'active',
    metadata: {},
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  }));
}

// Export the managers for direct use if needed
export { sessionManager, eventManager };