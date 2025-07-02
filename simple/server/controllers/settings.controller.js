import { promises as fs } from 'fs';
import config from '../config/index.js';

/**
 * Get current settings
 */
export async function getSettings(req, res, next) {
  try {
    const models = req.app.locals.models;
    
    // Get settings from database
    const settings = {};
    
    // Get GitHub token
    const githubTokenSetting = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['github_token']
    );
    
    if (githubTokenSetting) {
      settings.githubToken = githubTokenSetting.value;
      settings.hasGithubToken = true;
    } else {
      settings.hasGithubToken = false;
    }
    
    // Check if settings file exists
    try {
      const fileSettings = await fs.readFile(config.settingsPath, 'utf8');
      const parsed = JSON.parse(fileSettings);
      settings.fileExists = true;
      settings.fileHasToken = !!parsed.githubToken;
    } catch (error) {
      settings.fileExists = false;
      settings.fileHasToken = false;
    }
    
    res.json(settings);
  } catch (error) {
    next(error);
  }
}

/**
 * Update settings
 */
export async function updateSettings(req, res, next) {
  try {
    const models = req.app.locals.models;
    const { githubToken } = req.body;
    
    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }
    
    // Save to database
    await models.db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['github_token', githubToken]
    );
    
    // Save to file for backward compatibility
    const settings = { githubToken };
    await fs.writeFile(config.settingsPath, JSON.stringify(settings, null, 2));
    
    // Update GitHub instance if available
    const GitHubAPI = (await import('../github.js')).default;
    const github = new GitHubAPI(githubToken);
    req.app.locals.github = github;
    
    res.json({ 
      message: 'Settings updated successfully',
      hasGithubToken: true 
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Test GitHub token
 */
export async function testGithubToken(req, res, next) {
  try {
    const github = req.app.locals.github;
    
    if (!github) {
      return res.status(400).json({ 
        error: 'No GitHub token configured',
        valid: false 
      });
    }
    
    try {
      // Test the token by getting user info
      const user = await github.getCurrentUser();
      res.json({
        valid: true,
        user: {
          login: user.login,
          name: user.name,
          email: user.email
        }
      });
    } catch (error) {
      res.json({
        valid: false,
        error: error.message
      });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Get system info
 */
export async function getSystemInfo(req, res, next) {
  try {
    const info = {
      projectsDir: config.projectsDir,
      dbPath: config.dbPath,
      shelltenderApiUrl: config.shelltenderApiUrl,
      shelltenderWsUrl: config.shelltenderWsUrl,
      nodeVersion: process.version,
      platform: process.platform,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage()
    };
    
    res.json(info);
  } catch (error) {
    next(error);
  }
}