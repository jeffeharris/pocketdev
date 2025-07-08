import express from 'express';
import cors from 'cors';
import path from 'path';
import config from './config/index.js';

// Import routes
import createRoutes from './routes/index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files are now served by the frontend build

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'pocketdev-project-manager'
  });
});

// Routes will be mounted after models are initialized in server.js
// This is handled by calling app.use('/api', createRoutes(app)) after initialization

export default app;

// Note: Error handling middleware is added dynamically after routes are mounted
// This ensures it catches errors from all routes
export function addErrorHandlers(app) {
  // Error handling middleware (should be last)
  app.use((err, req, res, next) => {
    console.error('Error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}