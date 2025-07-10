#!/usr/bin/env node

/**
 * Shelltender Unified Service
 * HTTP and WebSocket on the same port
 */

import { 
  SessionManager, 
  BufferManager, 
  SessionStore, 
  TerminalDataPipeline,
  EventManager
} from '@shelltender/server';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.SHELLTENDER_PORT || 8080;
const DATA_DIR = process.env.SHELLTENDER_DATA_DIR || path.join(__dirname, '../data/shelltender-sessions');
const DEBUG = process.env.DEBUG || 'shelltender:*';

// Global instances
let sessionManager = null;
let bufferManager = null;
let sessionStore = null;
let wss = null;
let eventManager = null;
let activeSessions = new Map();
let clients = new Map();

// Express app for HTTP API
const app = express();
app.use(express.json());
app.use(cors());

// Add request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Create HTTP server
const server = createServer(app);

// Initialize Shelltender
async function initializeShelltender() {
  console.log('Starting Shelltender Unified Service...');
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Port: ${PORT}`);
  
  try {
    // Create data directory
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Initialize components
    bufferManager = new BufferManager();
    
    // Initialize SessionStore
    const sessionStorePath = path.join(DATA_DIR, 'sessions');
    sessionStore = new SessionStore(sessionStorePath);
    await sessionStore.initialize();
    
    // Initialize SessionManager
    sessionManager = new SessionManager(sessionStore);
    
    // Create event manager
    eventManager = new EventManager();
    
    // Create WebSocket server attached to HTTP server
    wss = new WebSocketServer({ 
      server,
      path: '/' // Accept WebSocket connections on root path
    });
    
    // Setup WebSocket handlers
    setupWebSocketHandlers();
    
    // Restore existing sessions
    await restoreExistingSessions();
    
    console.log('Session persistence enabled - sessions will be restored automatically');
    
  } catch (error) {
    console.error('Failed to initialize Shelltender:', error);
    throw error;
  }
}

// Setup WebSocket handlers
function setupWebSocketHandlers() {
  console.log('Setting up WebSocket handlers...');
  
  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    clients.set(clientId, ws);
    
    console.log(`[WS] New connection: ${clientId}`);
    
    // Parse session ID from URL if provided
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('session') || url.searchParams.get('sessionId');
    
    if (sessionId) {
      console.log(`[WS] Connection requested session: ${sessionId}`);
      handleAutoConnect(clientId, ws, sessionId);
    }
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log(`[WS] Message from ${clientId}:`, data.type);
        handleMessage(clientId, ws, data);
      } catch (error) {
        console.error(`[WS] Invalid message from ${clientId}:`, error);
        ws.send(JSON.stringify({ type: 'error', data: 'Invalid message format' }));
      }
    });
    
    ws.on('close', (code, reason) => {
      console.log(`[WS] Connection closed: ${clientId} - Code: ${code}, Reason: ${reason}`);
      
      // Remove client from all sessions
      for (const session of sessionManager.getAllSessions()) {
        sessionManager.removeClient(session.id, clientId);
      }
      
      clients.delete(clientId);
    });
    
    ws.on('error', (error) => {
      console.error(`[WS] Error for ${clientId}:`, error.message);
    });
    
    // Send initial connection success
    ws.send(JSON.stringify({ type: 'connected', clientId }));
  });
}

// Auto-connect to session if specified in URL
function handleAutoConnect(clientId, ws, sessionId) {
  const session = sessionManager.getSession(sessionId);
  
  if (session) {
    sessionManager.addClient(sessionId, clientId);
    ws.sessionId = sessionId;
    
    ws.send(JSON.stringify({
      type: 'connect',
      sessionId: sessionId,
      session,
      scrollback: bufferManager.getBuffer(sessionId)
    }));
    
    console.log(`[WS] Auto-connected client ${clientId} to session ${sessionId}`);
  } else {
    // Try to create the session
    console.log(`[WS] Session ${sessionId} not found, attempting to create...`);
    handleMessage(clientId, ws, {
      type: 'create',
      options: { id: sessionId }
    });
  }
}

// Handle WebSocket messages
function handleMessage(clientId, ws, data) {
  const handlers = {
    'create': handleCreateSession,
    'connect': handleConnectSession,
    'input': handleSessionInput,
    'resize': handleSessionResize,
    'disconnect': handleSessionDisconnect
  };
  
  const handler = handlers[data.type];
  if (handler) {
    handler(clientId, ws, data);
  } else {
    ws.send(JSON.stringify({
      type: 'error',
      data: `Unknown message type: ${data.type}`
    }));
  }
}

// Create session handler
async function handleCreateSession(clientId, ws, data) {
  try {
    const options = data.options || {};
    const sessionId = options.id || data.sessionId || `session-${Date.now()}`;
    
    // Check if session already exists
    let session = sessionManager.getSession(sessionId);
    
    if (session) {
      // Session already exists, just connect
      sessionManager.addClient(sessionId, clientId);
      ws.sessionId = sessionId;
      
      ws.send(JSON.stringify({
        type: 'connect',
        sessionId: sessionId,
        session,
        scrollback: bufferManager.getBuffer(sessionId)
      }));
      
      console.log(`[WS] Connected to existing session: ${sessionId}`);
      return;
    }
    
    // Create new session
    options.id = sessionId;
    if (data.cols) options.cols = data.cols;
    if (data.rows) options.rows = data.rows;
    
    console.log(`[WS] Creating session with options:`, JSON.stringify(options));
    session = await sessionManager.createSession(options);
    console.log(`[WS] Session created:`, session.id, 'pty:', !!session.pty);
    
    sessionManager.addClient(session.id, clientId);
    ws.sessionId = session.id;
    
    // Save session metadata
    const sessionData = {
      session: {
        id: session.id,
        name: options.name || `Session ${session.id}`,
        command: options.command || 'bash',
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        cols: options.cols || 80,
        rows: options.rows || 24
      },
      cwd: options.cwd || process.env.HOME,
      env: options.env || {},
      metadata: options.metadata || {},
      buffer: ''
    };
    
    await sessionStore.saveSession(session.id, sessionData);
    activeSessions.set(session.id, sessionData);
    
    // Set up data handler for the session
    const pty = session.pty;
    if (pty) {
      console.log(`[WS] Setting up PTY data handler for session ${session.id}`);
      pty.onData((data) => {
        console.log(`[WS] PTY output for ${session.id}: ${data.substring(0, 50)}...`);
        // Buffer the data
        bufferManager.addData(session.id, data);
        
        // Broadcast to all connected clients
        broadcastToSession(session.id, {
          type: 'output',
          sessionId: session.id,
          data: data
        });
      });
    } else {
      console.error(`[WS] No PTY for session ${session.id}!`);
    }
    
    ws.send(JSON.stringify({
      type: 'created',
      sessionId: session.id,
      session
    }));
    
    console.log(`[WS] Created new session: ${session.id}`);
  } catch (error) {
    console.error(`[WS] Error creating session:`, error);
    ws.send(JSON.stringify({
      type: 'error',
      data: error.message || 'Failed to create session'
    }));
  }
}

// Connect to existing session
function handleConnectSession(clientId, ws, data) {
  if (!data.sessionId) {
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Session ID required'
    }));
    return;
  }
  
  const session = sessionManager.getSession(data.sessionId);
  if (session) {
    sessionManager.addClient(data.sessionId, clientId);
    ws.sessionId = data.sessionId;
    
    const scrollback = bufferManager.getBuffer(data.sessionId);
    
    ws.send(JSON.stringify({
      type: 'connect',
      sessionId: data.sessionId,
      session,
      scrollback: scrollback
    }));
    
    console.log(`[WS] Connected client ${clientId} to session ${data.sessionId}, scrollback: ${scrollback ? scrollback.length : 0} bytes`);
  } else {
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Session not found'
    }));
  }
}

// Handle input to session
function handleSessionInput(clientId, ws, data) {
  if (!data.sessionId || data.data === undefined) {
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Session ID and data required'
    }));
    return;
  }
  
  console.log(`[WS] Input from ${clientId} to session ${data.sessionId}: "${data.data}"`);
  
  const success = sessionManager.writeToSession(data.sessionId, data.data);
  if (!success) {
    console.error(`[WS] Failed to write to session ${data.sessionId}`);
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Failed to write to session - session may be disconnected',
      sessionId: data.sessionId
    }));
  }
}

// Handle terminal resize
function handleSessionResize(clientId, ws, data) {
  if (!data.sessionId || !data.cols || !data.rows) {
    ws.send(JSON.stringify({
      type: 'error',
      data: 'Session ID, cols, and rows required'
    }));
    return;
  }
  
  sessionManager.resizeSession(data.sessionId, data.cols, data.rows);
  
  // Update stored session data
  const sessionData = activeSessions.get(data.sessionId);
  if (sessionData) {
    sessionData.session.cols = data.cols;
    sessionData.session.rows = data.rows;
    sessionStore.saveSession(data.sessionId, sessionData);
  }
  
  broadcastToSession(data.sessionId, {
    type: 'resize',
    sessionId: data.sessionId,
    cols: data.cols,
    rows: data.rows
  });
}

// Handle disconnect from session
function handleSessionDisconnect(clientId, ws, data) {
  if (data.sessionId) {
    sessionManager.removeClient(data.sessionId, clientId);
    ws.sessionId = undefined;
    console.log(`[WS] Disconnected client ${clientId} from session ${data.sessionId}`);
  }
}

// Broadcast message to all clients connected to a session
function broadcastToSession(sessionId, data) {
  clients.forEach((ws, clientId) => {
    if (ws.sessionId === sessionId && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(data));
    }
  });
}

// Restore sessions from disk
async function restoreExistingSessions() {
  console.log('Restoring saved sessions...');
  try {
    const sessionFiles = await fs.readdir(path.join(DATA_DIR, 'sessions')).catch(() => []);
    console.log(`Found ${sessionFiles.length} session files`);
    
    for (const file of sessionFiles) {
      if (file.endsWith('.json')) {
        try {
          const sessionId = file.replace('.json', '');
          const data = await fs.readFile(path.join(DATA_DIR, 'sessions', file), 'utf8');
          const sessionData = JSON.parse(data);
          
          activeSessions.set(sessionId, sessionData);
          
          // Calculate buffer size for logging
          const bufferSize = sessionData.buffer ? sessionData.buffer.length : 0;
          console.log(`Restored session ${sessionId} with ${bufferSize} bytes of history`);
        } catch (err) {
          console.error(`Error restoring session from ${file}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('Error restoring sessions:', error);
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    activeSessions: activeSessions.size,
    connectedClients: clients.size,
    port: PORT
  });
});

// Debug endpoint for WebSocket info
app.get('/debug/websocket', (req, res) => {
  const wsInfo = {
    port: PORT,
    wsServerExists: !!wss,
    sessionManagerExists: !!sessionManager,
    activeSessions: Array.from(activeSessions.keys()),
    activeSessionsCount: activeSessions.size,
    connectedClients: clients.size,
    wsUrl: `ws://localhost:${PORT}`,
    protocol: 'ws'
  };
  console.log('WebSocket debug info requested:', wsInfo);
  res.json(wsInfo);
});

// Create a new session via HTTP
app.post('/sessions', async (req, res) => {
  console.log('[Session Create] Request received:', JSON.stringify(req.body));
  try {
    let { id, name, command = 'bash', cwd, env, metadata } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Check if session already exists
    const existingSession = sessionManager.getSession(id);
    if (existingSession) {
      return res.json({
        id: existingSession.id,
        name: name || `Session ${id}`,
        status: 'existing',
        created: false,
        websocketUrl: `ws://localhost:${PORT}?session=${id}`
      });
    }
    
    // Create session via SessionManager
    const session = await sessionManager.createSession({
      id,
      name: name || `Session ${id}`,
      command,
      cwd: cwd || process.env.HOME,
      env: {
        ...process.env,
        ...env
      }
    });
    
    // Set up data handler
    const pty = session.pty;
    if (pty) {
      pty.onData((data) => {
        bufferManager.addData(session.id, data);
        broadcastToSession(session.id, {
          type: 'output',
          sessionId: session.id,
          data: data
        });
      });
    }
    
    // Save session metadata
    const sessionData = {
      session: {
        id,
        name: name || `Session ${id}`,
        command,
        createdAt: new Date(),
        lastAccessedAt: new Date(),
        cols: 80,
        rows: 24
      },
      cwd: cwd || process.env.HOME,
      env,
      metadata,
      buffer: ''
    };
    
    await sessionStore.saveSession(id, sessionData);
    activeSessions.set(id, sessionData);
    
    res.json({
      id: session.id,
      status: 'active',
      created: true,
      websocketUrl: `ws://localhost:${PORT}?session=${id}`
    });
    
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session info
app.get('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = activeSessions.get(sessionId);
    
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const activeSession = sessionManager.getSession(sessionId);
    
    res.json({
      id: sessionId,
      name: sessionData.session.name,
      status: activeSession ? 'active' : 'inactive',
      createdAt: sessionData.session.createdAt,
      lastAccessedAt: sessionData.session.lastAccessedAt,
      metadata: sessionData.metadata
    });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List all sessions
app.get('/sessions', async (req, res) => {
  try {
    const sessions = Array.from(activeSessions.entries()).map(([id, data]) => {
      const activeSession = sessionManager.getSession(id);
      return {
        id,
        name: data.session.name,
        status: activeSession ? 'active' : 'inactive',
        createdAt: data.session.createdAt,
        lastAccessedAt: data.session.lastAccessedAt,
        metadata: data.metadata
      };
    });
    
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete session
app.delete('/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    // Close active session if exists
    const activeSession = sessionManager.getSession(sessionId);
    if (activeSession) {
      // sessionManager doesn't have closeSession in v0.4.4, use removeSession
      sessionManager.removeSession(sessionId);
    }
    
    // Remove from store
    await sessionStore.deleteSession(sessionId);
    activeSessions.delete(sessionId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the service
async function start() {
  try {
    // Initialize Shelltender
    await initializeShelltender();
    
    // Start unified HTTP/WebSocket server
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`Shelltender Unified Service listening on port ${PORT}`);
      console.log(`HTTP API: http://localhost:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('Failed to start Shelltender service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down Shelltender service...');
  
  try {
    // Close all active sessions
    for (const [sessionId] of activeSessions) {
      const activeSession = sessionManager.getSession(sessionId);
      if (activeSession) {
        sessionManager.removeSession(sessionId);
      }
    }
    
    // Close WebSocket server
    if (wss) {
      wss.close();
    }
    
    // Close HTTP server
    server.close();
    
    console.log('Shelltender service stopped');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the service
start();