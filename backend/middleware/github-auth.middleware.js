/**
 * GitHub Authentication Middleware
 * Injects GitHub token into request object for use by controllers
 */

export async function githubTokenMiddleware(req, res, next) {
  try {
    // Skip if token already exists (cached for this request)
    if (req.githubToken !== undefined) {
      return next();
    }

    // Get token from service
    const githubTokenService = req.app.locals.githubTokenService;
    const token = await githubTokenService.getToken();
    
    // Inject into request object
    req.githubToken = token || '';
    
    next();
  } catch (error) {
    console.error('GitHub token middleware error:', error);
    // Continue without token - let individual operations handle missing token
    req.githubToken = '';
    next();
  }
}

// Selective middleware - only for routes that definitely need GitHub access
export function requireGitHubToken(req, res, next) {
  githubTokenMiddleware(req, res, (err) => {
    if (err) return next(err);
    
    if (!req.githubToken) {
      return res.status(401).json({
        error: 'GitHub token not configured',
        settingsUrl: '/settings',
        helpText: 'Please configure your GitHub token in settings'
      });
    }
    
    next();
  });
}