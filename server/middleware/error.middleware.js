/**
 * Error handling middleware
 */
export function errorHandler(err, req, res, next) {
  // Log error details
  console.error('Error occurred:', {
    message: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  // Determine status code
  const status = err.status || err.statusCode || 500;

  // Build error response
  const response = {
    error: {
      message: err.message || 'Internal server error',
      status
    }
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    response.error.details = err;
  }

  // Send error response
  res.status(status).json(response);
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    error: {
      message: 'Resource not found',
      status: 404,
      path: req.path
    }
  });
}

/**
 * Async route handler wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}