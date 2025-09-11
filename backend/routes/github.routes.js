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
      const userInfo = await github.request('/user');
      return res.json({
        enabled: true,
        valid: true,
        username: userInfo.login
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
    
    // Get all repos (including private)
    const repos = await github.request('/user/repos', {
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
      affiliation: 'owner,collaborator,organization_member'
    });
    
    // Format for frontend
    const formattedRepos = repos.map(repo => ({
      fullName: repo.full_name,
      name: repo.name,
      url: repo.clone_url,
      private: repo.private,
      defaultBranch: repo.default_branch,
      updatedAt: repo.updated_at
    }));
    
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
    
    const branches = await github.request(`/repos/${owner}/${repo}/branches`, {
      per_page: 100
    });
    
    // Format for frontend
    const formattedBranches = branches.map(branch => ({
      name: branch.name,
      protected: branch.protected
    }));
    
    res.json(formattedBranches);
  } catch (error) {
    console.error('GitHub branches error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch branches' 
    });
  }
});

export default router;