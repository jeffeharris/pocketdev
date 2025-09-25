import config from '../config/index.js';

/**
 * Get current settings
 */
export async function getSettings(req, res, next) {
  try {
    const settingsService = req.services.SettingsService;
    const settings = await settingsService.getSettings();
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
    const settingsService = req.services.SettingsService;
    const result = await settingsService.updateSettings(req.body);
    
    // Update GitHub instance
    const github = await settingsService.createGitHubAPIInstance();
    if (github) {
      req.services.github = github;
    }
    
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Test GitHub token
 */
export async function testGithubToken(req, res, next) {
  try {
    const settingsService = req.services.SettingsService;
    const result = await settingsService.testGitHubConnection();
    res.json(result);
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