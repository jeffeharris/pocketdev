#!/usr/bin/env node

/**
 * Shelltender v0.5.0 Proper Implementation
 * Uses Shelltender's WebSocketServer correctly instead of reimplementing everything
 */

import { 
  SessionManager, 
  BufferManager, 
  SessionStore, 
  WebSocketServer,
  EventManager,
  TerminalDataPipeline,
  PipelineIntegration
} from '@shelltender/server';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const PORT = process.env.SHELLTENDER_PORT || process.env.PORT || 8080;
const DATA_DIR = process.env.SHELLTENDER_DATA_DIR || path.join(__dirname, '../data/shelltender-sessions');

// Express app for HTTP API
const app = express();
app.use(express.json());
app.use(cors());

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Create HTTP server
const httpServer = createServer(app);

// Global instances
let sessionManager = null;
let bufferManager = null;
let sessionStore = null;
let wsServer = null;
let eventManager = null;
let pipeline = null;
let integration = null;

// Initialize Shelltender components
async function initializeShelltender() {
  console.log('Initializing Shelltender v0.5.0 (WITH PIPELINE INTEGRATION)...');
  console.log(`Port: ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  
  try {
    // Initialize SessionStore with persistence
    sessionStore = new SessionStore(DATA_DIR);
    await sessionStore.initialize();
    console.log('✓ SessionStore initialized');
    
    // Initialize BufferManager for scrollback
    bufferManager = new BufferManager({
      maxBufferSize: 1024 * 1024 // 1MB per session
    });
    console.log('✓ BufferManager initialized');
    
    // Initialize EventManager
    eventManager = new EventManager();
    console.log('✓ EventManager initialized');
    
    // Initialize SessionManager
    sessionManager = new SessionManager(sessionStore);
    console.log('✓ SessionManager initialized');
    
    // Create WebSocketServer using v0.5.0 API - static create method
    wsServer = WebSocketServer.create(
      { 
        server: httpServer,
        path: '/ws'
      },
      sessionManager,
      bufferManager,
      eventManager  // v0.5.0 requires eventManager as 4th parameter
    );
    
    console.log('✓ WebSocketServer attached to HTTP server at /ws');
    
    // Initialize pipeline
    pipeline = new TerminalDataPipeline();
    console.log('✓ TerminalDataPipeline initialized');
    
    // THIS IS THE CRITICAL MISSING PIECE!
    // Set up integration to connect SessionManager → Pipeline → WebSocket
    integration = new PipelineIntegration(
      pipeline,
      sessionManager,
      bufferManager,
      wsServer,
      sessionStore,
      eventManager
    );
    integration.setup();
    console.log('✓ PipelineIntegration setup complete - PTY output will now be sent to WebSocket clients');
    
  } catch (error) {
    console.error('Failed to initialize Shelltender:', error);
    throw error;
  }
}

// NOTE: This function is no longer needed after adding PipelineIntegration
// Keeping it here commented out for reference
/*
function setupPTYDataHandlers() {
  console.log('[PTY Fix] Setting up PTY data handlers...');
  
  // Log existing sessions to debug
  const existingSessions = sessionManager.getAllSessions();
  console.log(`[PTY Fix] Found ${existingSessions.length} existing sessions`);
  
  // Hook into existing sessions
  existingSessions.forEach(session => {
    if (session.pty && !ptyDataHandlers.has(session.id)) {
      console.log(`[PTY Fix] Connecting existing session: ${session.id}`);
      connectPTYToWebSocket(session);
    }
  });
  
  // Override SessionManager's createSession to hook PTY data
  const originalCreateSession = sessionManager.createSession.bind(sessionManager);
  
  sessionManager.createSession = async function(options) {
    console.log(`[PTY Fix] Creating session with ID: ${options.id || 'auto-generated'}`);
    
    // Call original method
    const session = await originalCreateSession(options);
    
    // Connect PTY output to WebSocket
    if (session && session.pty) {
      console.log(`[PTY Fix] Connecting PTY output for session: ${session.id}`);
      connectPTYToWebSocket(session);
    }
    
    return session;
  };
  
  // Also hook into session restoration
  const originalGetSession = sessionManager.getSession.bind(sessionManager);
  
  sessionManager.getSession = function(sessionId) {
    const session = originalGetSession(sessionId);
    
    // If session exists with PTY but no handler, connect it
    if (session && session.pty && !ptyDataHandlers.has(sessionId)) {
      console.log(`[PTY Fix] Connecting restored session: ${sessionId}`);
      connectPTYToWebSocket(session);
    }
    
    return session;
  };
  
  // Also hook into killSession for cleanup
  const originalKillSession = sessionManager.killSession.bind(sessionManager);
  
  sessionManager.killSession = function(sessionId) {
    console.log(`[PTY Fix] Killing session: ${sessionId}`);
    
    // Remove data handler
    if (ptyDataHandlers.has(sessionId)) {
      ptyDataHandlers.delete(sessionId);
    }
    
    // Call original method
    return originalKillSession(sessionId);
  };
}

// Extract the PTY connection logic to reuse
function connectPTYToWebSocket(session) {
  if (!session || !session.pty || ptyDataHandlers.has(session.id)) {
    return;
  }
  
  // Create data handler for this session
  const dataHandler = (data) => {
    console.log(`[PTY Fix] Received output for session ${session.id}: ${data.substring(0, 50)}...`);
    
    // Add to buffer
    bufferManager.addData(session.id, data);
    
    // Send to all connected WebSocket clients
    // TODO: This entire data broadcasting logic should be handled by WebSocketServer
    // In v0.5.1+, the WebSocketServer should automatically route PTY output to clients
    const message = JSON.stringify({
      type: 'output',
      sessionId: session.id,
      data: data
    });
    
    // Access the underlying WebSocket server
    // TODO: Remove this manual broadcasting when WebSocketServer.create() is fixed
    if (wsServer && wsServer.wss) {
      console.log(`[PTY Fix] Broadcasting to ${wsServer.wss.clients.size} WebSocket clients`);
      wsServer.wss.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(message);
        }
      });
    } else {
      console.error(`[PTY Fix] ERROR: Cannot broadcast - wsServer.wss is not available!`);
    }
  };
  
  // Store handler reference for cleanup
  ptyDataHandlers.set(session.id, dataHandler);
  
  // Connect PTY output to handler
  session.pty.onData(dataHandler);
  
  // Also handle PTY exit
  session.pty.onExit(() => {
    console.log(`[PTY Fix] PTY exited for session: ${session.id}`);
    ptyDataHandlers.delete(session.id);
  });
}
*/

// API Routes - These support the frontend operations

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'single-port',
    port: PORT,
    wsPath: '/ws',
    activeSessions: sessionManager ? sessionManager.getAllSessions().length : 0,
    uptime: process.uptime()
  });
});

// Compatibility endpoint for frontend
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    mode: 'single-port',
    wsPath: '/ws'
  });
});

// Create session endpoint - used by frontend before WebSocket connection
app.post('/api/sessions', async (req, res) => {
  console.log('[API] Create session request:', req.body);
  try {
    const { sessionId } = req.body;
    
    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId required' });
    }
    
    // Check if session already exists
    const existingSession = sessionManager.getSession(sessionId);
    if (existingSession) {
      console.log(`[API] Session ${sessionId} already exists`);
      return res.json({ 
        sessionId,
        status: 'existing',
        wsUrl: `ws://localhost:${PORT}/ws`
      });
    }
    
    // Create new session with PTY
    const session = await sessionManager.createSession({
      id: sessionId,
      cols: req.body.cols || 80,
      rows: req.body.rows || 24,
      cwd: req.body.cwd || process.cwd(),
      command: req.body.command || process.env.SHELL || 'bash',
      env: {
        ...process.env,
        ...req.body.env,
        TERM: 'xterm-256color'
      }
    });
    
    console.log(`[API] Created session ${sessionId}`);
    
    res.json({
      sessionId: session.id,
      status: 'created',
      wsUrl: `ws://localhost:${PORT}/ws`
    });
    
  } catch (error) {
    console.error('[API] Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session info
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessionManager.getSession(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    id: session.id,
    status: 'active',
    cols: session.cols || 80,
    rows: session.rows || 24,
    clients: session.clients ? session.clients.size : 0
  });
});

// List all sessions
app.get('/api/sessions', (req, res) => {
  const sessions = sessionManager.getAllSessions().map(session => ({
    id: session.id,
    status: 'active',
    clients: session.clients ? session.clients.size : 0
  }));
  
  res.json(sessions);
});

// Delete session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // In v0.5.0, use killSession instead of removeSession
    sessionManager.killSession(sessionId);
    console.log(`[API] Deleted session ${sessionId}`);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resize session (optional endpoint for explicit resize)
app.post('/api/sessions/:sessionId/resize', (req, res) => {
  const { sessionId } = req.params;
  const { cols, rows } = req.body;
  
  if (!cols || !rows) {
    return res.status(400).json({ error: 'cols and rows required' });
  }
  
  try {
    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    sessionManager.resizeSession(sessionId, cols, rows);
    console.log(`[API] Resized session ${sessionId} to ${cols}x${rows}`);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the unified server
async function start() {
  try {
    // Initialize Shelltender components
    await initializeShelltender();
    
    // Start the unified HTTP/WebSocket server
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(50));
      console.log('Shelltender v0.5.0 Service Started');
      console.log('='.repeat(50));
      console.log(`Mode:      Single-port`);
      console.log(`Port:      ${PORT}`);
      console.log(`HTTP API:  http://localhost:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws`);
      console.log('='.repeat(50) + '\n');
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown() {
  console.log('\nShutting down gracefully...');
  
  try {
    // Close WebSocket server
    if (wsServer && wsServer.close) {
      console.log('Closing WebSocket server...');
      wsServer.close();
    }
    
    // Close all sessions
    if (sessionManager) {
      console.log('Closing all sessions...');
      const sessions = sessionManager.getAllSessions();
      sessions.forEach(session => {
        try {
          sessionManager.killSession(session.id);
        } catch (err) {
          console.error(`Error closing session ${session.id}:`, err);
        }
      });
    }
    
    // Close HTTP server
    console.log('Closing HTTP server...');
    httpServer.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
    
    // Force exit after 5 seconds
    setTimeout(() => {
      console.error('Forced shutdown after timeout');
      process.exit(1);
    }, 5000);
    
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the service
start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});