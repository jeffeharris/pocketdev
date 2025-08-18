import { GitService } from '../services/git-core.service.js';
import { GitHubService } from '../services/github.service.js';

/**
 * Middleware to create request-scoped Git and GitHub service instances
 * 
 * This middleware instantiates GitService and GitHubService once per request
 * with the appropriate GitHub token, making them available to all downstream
 * services and controllers via req.services.
 * 
 * This eliminates the need for services to create their own GitService instances
 * and centralizes token management.
 */
export function gitServicesMiddleware(req, res, next) {
  // Only create services if we have a GitHub token
  if (req.githubToken) {
    // Initialize services object if it doesn't exist
    if (!req.services) {
      req.services = {};
    }
    
    // Create git service with token and default config
    const gitConfig = {
      name: req.app.locals.gitUserName || 'PocketDev User',
      email: req.app.locals.gitUserEmail || 'user@pocketdev.local'
    };
    
    req.services.git = new GitService(req.githubToken, gitConfig);
    req.services.github = new GitHubService(req.githubToken);
    
    // Log for debugging (can be removed in production)
    if (process.env.NODE_ENV === 'development') {
      console.log('[GitServices Middleware] Created request-scoped Git and GitHub services');
    }
  } else {
    // Even without a token, ensure services object exists
    if (!req.services) {
      req.services = {};
    }
    
    // Create services without token (some operations don't require auth)
    req.services.git = new GitService();
    req.services.github = new GitHubService();
  }
  
  next();
}

/**
 * Helper middleware to ensure git services are available
 * Use this for routes that absolutely require git services
 */
export function requireGitServices(req, res, next) {
  if (!req.services || !req.services.git || !req.services.github) {
    return res.status(500).json({
      error: 'Git services not initialized. This is likely a configuration error.'
    });
  }
  
  if (!req.githubToken) {
    return res.status(401).json({
      error: 'GitHub token required for this operation'
    });
  }
  
  next();
}

export default gitServicesMiddleware;