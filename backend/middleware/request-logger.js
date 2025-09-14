/**
 * Request logging middleware
 * Logs all incoming requests and their responses
 */
import { logger } from '../utils/logger.js';

export function requestLoggerMiddleware(req, res, next) {
  const requestLogger = logger.child({ correlationId: req.correlationId });
  
  // Log incoming request
  requestLogger.info('Request received', {
    method: req.method,
    path: req.path,
    query: req.query,
    userAgent: req.headers['user-agent'],
    ip: req.ip
  });
  
  // Capture response details
  const originalSend = res.send;
  res.send = function(data) {
    const duration = req.context?.startTime ? Date.now() - req.context.startTime : null;
    
    // Log response
    requestLogger.info('Request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration_ms: duration
    });
    
    // Call original send
    originalSend.call(this, data);
  };
  
  next();
}