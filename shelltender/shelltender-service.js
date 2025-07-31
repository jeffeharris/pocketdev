#!/usr/bin/env node

/**
 * Shelltender v0.6.2 Implementation
 * Uses the new simplified createShelltender API with automatic pipeline setup
 * Includes HTTP endpoints for backend service integration
 */

import express from 'express';
import { createShelltender } from '@shelltender/server';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import fs from 'fs/promises';

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

// Serve admin UI manually since the automatic route doesn't seem to work
app.get('/admin', (req, res) => {
  const adminPath = path.join(__dirname, 'admin.html');
  res.sendFile(adminPath);
});

// Start the server
async function start() {
  try {
    console.log('Initializing Shelltender v0.6.0 with automatic pipeline setup...');
    console.log(`Port: ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
    
    // Create Shelltender with v0.6.0 benefits - follow the team's exact pattern
    const shelltender = await createShelltender(app, {
      port: PORT,
      wsPath: '/ws',
      apiRoutes: true,  // Enable admin UI routes (default is true)
      sessionOptions: {
        defaultCwd: process.cwd(),
        defaultEnv: {
          TERM: 'xterm-256color',
          ...process.env
        }
      },
      dataDir: DATA_DIR,
      enableSecurity: true
    });
    
    // Add backend's required endpoints using the shelltender object
    app.post('/api/sessions', async (req, res) => {
      console.log('[API] Create session request:', req.body);
      try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId required' });
        }
        
        // Add this check
        if (!shelltender || !shelltender.sessionManager) {
          console.error('[API] Shelltender not initialized');
          return res.status(503).json({ error: 'Service not ready' });
        }
        
        // Create session with error handling
        try {
          const session = shelltender.createSession({
            id: sessionId,
            cols: req.body.cols || 80,
            rows: req.body.rows || 24,
            command: req.body.command || '/bin/bash',
            args: req.body.args || ['--login'],  // Use login shell to load profile
            cwd: req.body.cwd || req.body.workdir,
            env: req.body.env ? { ...process.env, ...req.body.env } : undefined
          });
          
          console.log(`[API] Session ${session.id} created successfully`);
          
          res.json({
            id: session.id,
            sessionId: session.id,
            status: 'active',
            createdAt: session.createdAt,
            cols: session.cols,
            rows: session.rows,
            wsUrl: `ws://localhost:${PORT}/ws`
          });
          
        } catch (sessionError) {
          console.error('[API] Session creation failed:', sessionError);
          return res.status(500).json({ 
            error: 'Session creation failed',
            details: sessionError.message,
            stack: process.env.NODE_ENV === 'development' ? sessionError.stack : undefined
          });
        }
        
      } catch (error) {
        console.error('[API] Unexpected error:', error);
        res.status(500).json({ 
          error: 'Internal server error',
          details: error.message 
        });
      }
    });

    // Get session info
    app.get('/api/sessions/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      
      // Use sessionManager directly since getSession isn't exposed
      const session = shelltender.sessionManager.getSession(sessionId);
      if (session) {
        res.json({
          id: sessionId,
          status: 'active',
          cols: session.cols,
          rows: session.rows,
          createdAt: session.createdAt,
          lastAccessedAt: session.lastAccessedAt
        });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    });

    // List all sessions
    app.get('/api/sessions', (req, res) => {
      // Use sessionManager directly since getAllSessions isn't exposed
      const sessions = shelltender.sessionManager.getAllSessions();
      res.json(sessions.map(s => ({
        id: s.id,
        createdAt: s.createdAt,
        lastAccessedAt: s.lastAccessedAt,
        cols: s.cols,
        rows: s.rows
      })));
    });

    // Delete session
    app.delete('/api/sessions/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      
      const killed = shelltender.killSession(sessionId);
      if (killed) {
        console.log(`[API] Session ${sessionId} terminated`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    });

    // Resize session
    app.post('/api/sessions/:sessionId/resize', (req, res) => {
      const { sessionId } = req.params;
      const { cols, rows } = req.body;
      
      if (!cols || !rows) {
        return res.status(400).json({ error: 'cols and rows required' });
      }
      
      // Use sessionManager directly since resizeSession isn't exposed
      const resized = shelltender.sessionManager.resizeSession(sessionId, cols, rows);
      if (resized) {
        console.log(`[API] Resized session ${sessionId} to ${cols}x${rows}`);
        res.json({ success: true });
      } else {
        res.status(404).json({ error: 'Session not found' });
      }
    });

    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(50));
      console.log('Shelltender v0.6.2 Service Started');
      console.log('='.repeat(50));
      console.log(`Mode:      Single-port`);
      console.log(`Port:      ${PORT}`);
      console.log(`HTTP API:  http://localhost:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`Health:    http://localhost:${PORT}/api/health`);
      console.log(`Doctor:    http://localhost:${PORT}/api/shelltender/doctor`);
      console.log(`Admin UI:  http://localhost:${PORT}/admin`);
      console.log('='.repeat(50) + '\n');
      console.log('✨ Automatic pipeline setup enabled - no more black screens!');
      console.log('✅ HTTP session management endpoints added for backend integration');
      console.log('🎛️  Admin dashboard available for session monitoring');
    });
    
    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('\nShutting down gracefully...');
      if (shelltender && shelltender.stop) {
        await shelltender.stop();
      }
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('\nShutting down gracefully...');
      if (shelltender && shelltender.stop) {
        await shelltender.stop();
      }
      process.exit(0);
    });
    
  } catch (error) {
    console.error('Failed to start service:', error);
    process.exit(1);
  }
}

// Add global error handlers
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the service
start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});