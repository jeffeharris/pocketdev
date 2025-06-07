import express from 'express';
import ProjectConfig from './lib/project-config.js';
import path from 'path';

const router = express.Router();
const projectConfig = new ProjectConfig();

// Store active project in memory (for session-based approach)
let activeProject = {
  path: null,
  config: null
};

// Initialize project
router.post('/api/project/initialize', async (req, res) => {
  try {
    const { projectPath } = req.body;
    
    // If no projectPath provided, initialize in current repository
    const targetPath = projectPath || null;
    
    const config = await projectConfig.initializeProject(targetPath);
    
    // Set as active project
    activeProject = {
      path: targetPath || config.settings.workspace_root,
      config
    };
    
    res.json({
      success: true,
      config,
      message: 'Project initialized successfully'
    });
  } catch (error) {
    console.error('Project initialization error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active project config
router.get('/api/project/config', async (req, res) => {
  try {
    if (!activeProject.path) {
      return res.json({ 
        active: false,
        message: 'No active project configured' 
      });
    }
    
    // Reload config from disk to get latest
    const config = await projectConfig.getConfig(activeProject.path);
    if (config) {
      activeProject.config = config;
    }
    
    res.json({
      active: true,
      path: activeProject.path,
      config: activeProject.config
    });
  } catch (error) {
    console.error('Config fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update project config
router.post('/api/project/config', async (req, res) => {
  try {
    const { projectPath, config: updates } = req.body;
    
    const targetPath = projectPath || activeProject.path;
    if (!targetPath) {
      return res.status(400).json({ error: 'No project path specified' });
    }
    
    const updatedConfig = await projectConfig.updateConfig(targetPath, updates);
    
    // Update active project if it's the same
    if (targetPath === activeProject.path) {
      activeProject.config = updatedConfig;
    }
    
    res.json({
      success: true,
      config: updatedConfig
    });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Set active project
router.post('/api/project/set-active', async (req, res) => {
  try {
    const { projectPath, repository, defaultBranch, credentialProfile } = req.body;
    
    if (!projectPath || !repository) {
      return res.status(400).json({ 
        error: 'Project path and repository required' 
      });
    }
    
    // Check if project exists, initialize if not
    let config = await projectConfig.getConfig(projectPath);
    
    if (!config) {
      config = await projectConfig.initializeProject(projectPath);
    }
    
    // Update with provided details
    const updates = {
      project: {
        repository,
        default_branch: defaultBranch || 'main'
      },
      credentials: {
        profile: credentialProfile
      }
    };
    
    config = await projectConfig.updateConfig(projectPath, updates);
    
    // Set as active
    activeProject = {
      path: projectPath,
      config
    };
    
    res.json({
      success: true,
      config,
      message: 'Project set as active'
    });
  } catch (error) {
    console.error('Set active project error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GitHub integration endpoints

// Validate token and get user info
router.post('/api/github/validate', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const userInfo = await projectConfig.validateGitHubToken(token);
    
    res.json({
      success: true,
      user: {
        login: userInfo.login,
        name: userInfo.name,
        avatar_url: userInfo.avatar_url
      }
    });
  } catch (error) {
    console.error('GitHub validation error:', error);
    res.status(401).json({ error: 'Invalid GitHub token' });
  }
});

// Fetch user's repositories
router.post('/api/github/repos', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: 'Token required' });
    }
    
    const repos = await projectConfig.fetchGitHubRepos(token);
    
    res.json({
      success: true,
      repos
    });
  } catch (error) {
    console.error('GitHub repos fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch branches for a repository
router.post('/api/github/branches', async (req, res) => {
  try {
    const { token, repoFullName } = req.body;
    
    if (!token || !repoFullName) {
      return res.status(400).json({ 
        error: 'Token and repository name required' 
      });
    }
    
    const branches = await projectConfig.fetchGitHubBranches(token, repoFullName);
    
    res.json({
      success: true,
      branches
    });
  } catch (error) {
    console.error('GitHub branches fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get credentials for active project
router.get('/api/project/credentials', (req, res) => {
  try {
    if (!activeProject.config) {
      return res.json({ 
        available: false,
        message: 'No active project' 
      });
    }
    
    const credentials = projectConfig.getCredentials(activeProject.config);
    
    if (!credentials) {
      return res.json({
        available: false,
        message: 'No credentials configured for active project profile'
      });
    }
    
    // Never send actual credentials to frontend
    res.json({
      available: true,
      profile: activeProject.config.credentials.profile,
      username: credentials.username
    });
  } catch (error) {
    console.error('Credentials fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Export both router and the activeProject getter for other modules
export default router;

export function getActiveProject() {
  return activeProject;
}

export function getProjectConfig() {
  return projectConfig;
}