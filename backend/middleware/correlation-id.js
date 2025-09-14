/**
 * Correlation ID middleware for request tracing
 * Adds a unique ID to each request for debugging and observability
 */
import crypto from 'crypto';

export function correlationIdMiddleware(req, res, next) {
  // Generate or use existing correlation ID
  const correlationId = req.headers['x-correlation-id'] || 
                        req.headers['x-request-id'] || 
                        crypto.randomUUID();
  
  // Attach to request and response
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  
  // Add to request context for logging
  req.context = {
    ...req.context,
    correlationId,
    startTime: Date.now(),
    path: req.path,
    method: req.method
  };
  
  next();
}