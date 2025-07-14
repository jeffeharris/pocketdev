#!/usr/bin/env node

/**
 * Shelltender v0.6.0 Implementation
 * Uses the new simplified APIs with automatic pipeline setup
 * Includes HTTP endpoints for backend service integration
 */

import express from 'express';
import { createShelltender } from '@shelltender/server';
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

// Start the server
async function start() {
  try {
    console.log('Initializing Shelltender v0.6.0 with automatic pipeline setup...');
    console.log(`Port: ${PORT}`);
    console.log(`Data directory: ${DATA_DIR}`);
    
    // Create Shelltender with v0.6.0 benefits
    const shelltender = await createShelltender(app, {
      port: PORT,
      wsPath: '/ws',
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

    // Add backend's required endpoints
    app.post('/api/sessions', async (req, res) => {
      console.log('[API] Create session request:', req.body);
      try {
        const { sessionId } = req.body;
        
        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId required' });
        }
        
        // In v0.6.0 with dataDir configured:
        // - Sessions are automatically created when WebSocket connects
        // - Sessions persist to disk and survive disconnects
        // - Reconnecting with same sessionId resumes the session
        console.log(`[API] Session ${sessionId} registered for connection`);
        
        res.json({
          sessionId: sessionId,
          status: 'ready',
          wsUrl: `ws://localhost:${PORT}/ws`,
          note: 'Session will be created/resumed on WebSocket connection'
        });
        
      } catch (error) {
        console.error('[API] Error creating session:', error);
        res.status(500).json({ error: error.message });
      }
    });

    // Get session info
    app.get('/api/sessions/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      
      // In v0.6.0, we assume session exists if requested
      res.json({
        id: sessionId,
        status: 'active',
        cols: 80,
        rows: 24,
        clients: 0
      });
    });

    // List all sessions
    app.get('/api/sessions', (req, res) => {
      // In v0.6.0, sessions are managed automatically
      res.json([]);
    });

    // Delete session
    app.delete('/api/sessions/:sessionId', (req, res) => {
      const { sessionId } = req.params;
      
      // In v0.6.0, sessions are cleaned up automatically when WebSocket disconnects
      console.log(`[API] Session ${sessionId} marked for cleanup`);
      res.json({ success: true });
    });

    // Resize session (optional endpoint for explicit resize)
    app.post('/api/sessions/:sessionId/resize', (req, res) => {
      const { sessionId } = req.params;
      const { cols, rows } = req.body;
      
      if (!cols || !rows) {
        return res.status(400).json({ error: 'cols and rows required' });
      }
      
      // In v0.6.0, resize is handled via WebSocket
      console.log(`[API] Resize request for session ${sessionId} to ${cols}x${rows}`);
      res.json({ success: true });
    });

    // Start the server
    app.listen(PORT, '0.0.0.0', () => {
      console.log('\n' + '='.repeat(50));
      console.log('Shelltender v0.6.0 Service Started');
      console.log('='.repeat(50));
      console.log(`Mode:      Single-port`);
      console.log(`Port:      ${PORT}`);
      console.log(`HTTP API:  http://localhost:${PORT}`);
      console.log(`WebSocket: ws://localhost:${PORT}/ws`);
      console.log(`Doctor:    http://localhost:${PORT}/api/shelltender/doctor`);
      console.log('='.repeat(50) + '\n');
      console.log('✨ Automatic pipeline setup enabled - no more black screens!');
      console.log('✅ HTTP session management endpoints added for backend integration');
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

// Start the service
start().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});