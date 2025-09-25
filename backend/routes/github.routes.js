import { Router } from 'express';

/**
 * GitHub API routes
 * Provides endpoints for GitHub integration
 */
const router = Router();

/**
 * GET /api/github/status
 * Check GitHub integration status
 */
router.get('/status', async (req, res) => {
  try {
    const github = req.services.github;
    
    if (!github) {
      return res.json({
        enabled: false,
        valid: false
      });
    }
    
    const validation = await github.validateToken();

    if (validation.valid) {
      return res.json({
        enabled: true,
        valid: true,
        username: validation.username
      });
    }
    
    res.json({
      enabled: true,
      valid: false
    });
  } catch (error) {
    console.error('GitHub status error:', error);
    res.json({
      enabled: false,
      valid: false,
      error: error.message
    });
  }
});

/**
 * GET /api/github/repos
 * Get list of user's repositories
 */
router.get('/repos', async (req, res) => {
  try {
    const github = req.services.github;
    
    if (!github) {
      return res.status(503).json({ 
        error: 'GitHub integration not configured' 
      });
    }
    
    // Get all repos using GitHubService
    const repos = await github.getRepositories();

    // GitHubService already formats the response correctly
    const formattedRepos = repos;
    
    res.json(formattedRepos);
  } catch (error) {
    console.error('GitHub repos error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch repositories' 
    });
  }
});

/**
 * GET /api/github/repos/:owner/:repo/branches
 * Get branches for a specific repository
 */
router.get('/repos/:owner/:repo/branches', async (req, res) => {
  try {
    const github = req.services.github;
    const { owner, repo } = req.params;
    
    if (!github) {
      return res.status(503).json({ 
        error: 'GitHub integration not configured' 
      });
    }
    
    // Get branches using GitHubService
    const branches = await github.getBranches(owner, repo);

    // GitHubService already formats the response correctly
    const formattedBranches = branches;
    
    res.json(formattedBranches);
  } catch (error) {
    console.error('GitHub branches error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch branches' 
    });
  }
});

export default router;