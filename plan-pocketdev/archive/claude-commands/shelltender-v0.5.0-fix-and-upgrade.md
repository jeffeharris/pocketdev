#!/usr/bin/env node

<!-- Document Metadata
Created: 2025-07-11
Modified: 2025-07-11
Status: ????
-->


/**
 * Shelltender v0.5.0 Proper Implementation
 * Uses Shelltender's WebSocketServer correctly
 */

import { 
  SessionManager, 
  BufferManager, 
  SessionStore, 
  WebSocketServer
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

// Initialize Shelltender
async function initializeShelltender() {
  console.log('Starting Shelltender v0.5.0 Service...');
  console.log(`Port: ${PORT}`);
  console.log(`Data directory: ${DATA_DIR}`);
  
  try {
    // Initialize SessionStore
    sessionStore = new SessionStore(DATA_DIR);
    await sessionStore.initialize();
    console.log('SessionStore initialized');
    
    // Initialize BufferManager
    bufferManager = new BufferManager({
      maxBufferSize: 1024 * 1024 // 1MB per session
    });
    console.log('BufferManager initialized');
    
    // Initialize SessionManager
    sessionManager = new SessionManager(sessionStore);
    console.log('SessionManager initialized');
    
    // Create WebSocketServer using v0.5.0 API
    // This attaches to our HTTP server on the /ws path
    wsServer = WebSocketServer.create(
      { 
        server: httpServer,
        path: '/ws'
      },
      sessionManager,
      bufferManager
    );
    
    console.log('WebSocketServer created and attached to HTTP server');
    
    // The WebSocketServer handles all WebSocket communication internally
    // We just need to ensure our API creates sessions that it can connect to
    
  } catch (error) {
    console.error('Failed to initialize Shelltender:', error);
    throw error;
  }
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    mode: 'single-port',
    port: PORT,
    wsPath: '/ws',
    activeSessions: sessionManager ? sessionManager.getAllSessions().length : 0
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    mode: 'single-port',
    wsPath: '/ws'
  });
});

// Create session endpoint (for frontend)
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
    
    // Create new session
    const session = await sessionManager.createSession({
      id: sessionId,
      cols: req.body.cols || 80,
      rows: req.body.rows || 24,
      cwd: req.body.cwd || process.cwd(),
      env: req.body.env || {}
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
    cols: session.cols,
    rows: session.rows
  });
});

// List sessions
app.get('/api/sessions', (req, res) => {
  const sessions = sessionManager.getAllSessions().map(session => ({
    id: session.id,
    status: 'active'
  }));
  
  res.json(sessions);
});

// Delete session
app.delete('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  
  try {
    sessionManager.removeSession(sessionId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start the service
async function start() {
  try {
    // Initialize Shelltender components
    await initializeShelltender();
    
    // Start the unified HTTP/WebSocket server
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log('\n=================================');
      console.log('Shelltender v0.5.0 Service Started');
      console.log('=================================');
      console.log(`HTTP API: http://localhost:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws`);
      console.log('Mode: Single-port');
      console.log('=================================\n');
    });
    
    // Graceful shutdown
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
    
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

async function shutdown() {
  console.log('\nShutting down...');
  
  try {
    // Close WebSocket server
    if (wsServer) {
      wsServer.close();
    }
    
    // Close HTTP server
    httpServer.close();
    
    console.log('Service stopped');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the service
start();