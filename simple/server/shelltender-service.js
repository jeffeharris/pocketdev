#!/usr/bin/env node

/**
 * Shelltender Service
 * Standalone service for managing terminal sessions
 * Runs independently from the frontend server
 */

import { 
  SessionManager, 
  BufferManager, 
  SessionStore, 
  WebSocketServer,
  TerminalDataPipeline,
  PipelineIntegration,
  EventManager
} from '@shelltender/server';
import express from 'express';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import cors from 'cors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration
const SHELLTENDER_PORT = process.env.SHELLTENDER_PORT || 8080;
const SHELLTENDER_DATA_DIR = process.env.SHELLTENDER_DATA_DIR || path.join(__dirname, '../data/shelltender-sessions');
const API_PORT = process.env.SHELLTENDER_API_PORT || 8081;

// Global instances
let sessionManager = null;
let bufferManager = null;
let sessionStore = null;
let wsServer = null;
let pipeline = null;
let pipelineIntegration = null;
let eventManager = null;
let activeSessions = new Map();

// Express app for HTTP API
const app = express();
app.use(express.json());
app.use(cors());

// Initialize Shelltender
async function initializeShelltender() {
  console.log('Starting Shelltender Service...');
  console.log(`Data directory: ${SHELLTENDER_DATA_DIR}`);
  
  try {
    // Create data directory
    await fs.mkdir(SHELLTENDER_DATA_DIR, { recursive: true });
    
    // Initialize components
    bufferManager = new BufferManager();
    
    // Initialize SessionStore
    const sessionStorePath = path.join(SHELLTENDER_DATA_DIR, 'sessions');
    sessionStore = new SessionStore(sessionStorePath);
    await sessionStore.initialize();
    
    // Initialize SessionManager
    sessionManager = new SessionManager(sessionStore);
    
    // Create event manager
    eventManager = new EventManager();
    
    // Create data pipeline
    pipeline = new TerminalDataPipeline();
    
    // Create WebSocket server
    wsServer = new WebSocketServer(SHELLTENDER_PORT, sessionManager, bufferManager, eventManager);
    
    // Set up pipeline integration
    pipelineIntegration = new PipelineIntegration(
      pipeline,
      sessionManager,
      bufferManager,
      wsServer,
      sessionStore,
      eventManager
    );
    pipelineIntegration.setup();
    
    // Restore existing sessions
    await restoreExistingSessions();
    
    console.log(`Shelltender WebSocket server listening on port ${SHELLTENDER_PORT}`);
    console.log(`Shelltender API server listening on port ${API_PORT}`);
    console.log('Session persistence enabled - sessions will be restored automatically');
    
  } catch (error) {
    console.error('Failed to initialize Shelltender:', error);
    throw error;
  }
}

// Restore sessions from disk
async function restoreExistingSessions() {
  try {
    const sessions = await sessionStore.getAllSessions();
    console.log(`Found ${sessions.length} existing sessions to restore`);
    
    for (const sessionData of sessions) {
      if (sessionData.session && sessionData.session.id) {
        activeSessions.set(sessionData.session.id, sessionData);
        console.log(`Restored session: ${sessionData.session.id}`);
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
    websocketPort: SHELLTENDER_PORT,
    apiPort: API_PORT
  });
});

// Create a new session
app.post('/sessions', async (req, res) => {
  try {
    const { id, name, command = 'bash', cwd, env, metadata } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: 'Session ID is required' });
    }
    
    // Check if session already exists
    if (activeSessions.has(id)) {
      const existingSession = activeSessions.get(id);
      return res.json({
        id: existingSession.session.id,
        name: existingSession.session.name,
        status: 'existing',
        created: false
      });
    }
    
    // Create new session
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
    
    // Emit event
    if (eventManager && eventManager.emit) {
      eventManager.emit('session-created', { id, session });
    }
    
    res.json({
      id: session.id,
      status: 'active',
      created: true,
      websocketUrl: `ws://localhost:${SHELLTENDER_PORT}?session=${id}`
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

// Execute command in session
app.post('/sessions/:sessionId/execute', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { command } = req.body;
    
    if (!command) {
      return res.status(400).json({ error: 'Command is required' });
    }
    
    const activeSession = sessionManager.getSession(sessionId);
    if (!activeSession || !activeSession.pty) {
      return res.status(404).json({ error: 'Active session not found' });
    }
    
    activeSession.pty.write(command + '\n');
    
    res.json({ success: true });
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
      await sessionManager.closeSession(sessionId);
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
    
    // Start API server
    const apiServer = createServer(app);
    apiServer.listen(API_PORT, () => {
      console.log(`Shelltender API server started on port ${API_PORT}`);
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
        await sessionManager.closeSession(sessionId);
      }
    }
    
    // Close WebSocket server
    if (wsServer) {
      wsServer.close();
    }
    
    console.log('Shelltender service stopped');
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

// Start the service
start();