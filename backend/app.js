import express from 'express';
import cors from 'cors';
import path from 'path';
import config from './config/index.js';
import { correlationIdMiddleware } from './middleware/correlation-id.js';
import { requestLoggerMiddleware } from './middleware/request-logger.js';

// Import routes
import createRoutes from './routes/index.js';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Add correlation ID to all requests for tracing
app.use(correlationIdMiddleware);

// Log all requests (after correlation ID is set)
if (process.env.LOG_REQUESTS !== 'false') {
  app.use(requestLoggerMiddleware);
}


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

// Service middleware will be added after service registry is initialized

export default app;

// Note: Error handling middleware is added dynamically after routes are mounted
// This ensures it catches errors from all routes
export function addErrorHandlers(app) {
  // Error handling middleware (should be last)
  app.use((err, req, res, next) => {
    const correlationId = req.correlationId || 'unknown';
    const duration = req.context?.startTime ? Date.now() - req.context.startTime : null;
    
    // Log structured error
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'error',
      correlationId,
      path: req.path,
      method: req.method,
      duration_ms: duration,
      error: err.message,
      stack: err.stack
    }));
    
    res.status(err.status || err.statusCode || 500).json({
      error: err.message || 'Internal server error',
      correlationId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  });

  // 404 handler
  app.use((req, res) => {
    const correlationId = req.correlationId || 'unknown';
    res.status(404).json({ 
      error: 'Not found',
      correlationId,
      path: req.path
    });
  });
}