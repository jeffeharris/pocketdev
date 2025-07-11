import { promises as fs } from 'fs';
import config from '../config/index.js';
import { encrypt, decrypt } from '../utils/crypto.js';

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
      // Decrypt the token before sending
      const decryptedToken = decrypt(githubTokenSetting.value);
      if (decryptedToken) {
        settings.githubToken = decryptedToken;
        settings.hasGithubToken = true;
      } else {
        // Handle case where decryption fails (e.g., old unencrypted token)
        settings.githubToken = githubTokenSetting.value;
        settings.hasGithubToken = true;
      }
    } else {
      settings.hasGithubToken = false;
    }
    
    // Get Git user settings
    const gitUserName = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    settings.gitUserName = gitUserName?.value || '';
    settings.gitUserEmail = gitUserEmail?.value || '';
    
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
    const { githubToken, gitUserName, gitUserEmail } = req.body;
    
    if (!githubToken) {
      return res.status(400).json({ error: 'GitHub token is required' });
    }
    
    // Encrypt and save GitHub token to database
    const encryptedToken = encrypt(githubToken);
    await models.db.run(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      ['github_token', encryptedToken]
    );
    
    // Save Git user settings if provided
    if (gitUserName !== undefined) {
      await models.db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['git_user_name', gitUserName || '']
      );
    }
    
    if (gitUserEmail !== undefined) {
      await models.db.run(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        ['git_user_email', gitUserEmail || '']
      );
    }
    
    // Save to file for backward compatibility
    const settings = { githubToken };
    await fs.writeFile(config.settingsPath, JSON.stringify(settings, null, 2));
    
    // Update GitHub instance if available
    const GitHubAPI = (await import('../github.js')).default;
    const github = new GitHubAPI(githubToken);
    req.app.locals.github = github;
    
    res.json({ 
      message: 'Settings updated successfully',
      hasGithubToken: true,
      gitUserName: gitUserName || '',
      gitUserEmail: gitUserEmail || ''
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
      // Test the token using validateToken method
      const result = await github.validateToken();
      if (result.valid) {
        // Get more user info with a direct API call
        const userInfo = await github.request('/user');
        
        // Also get the primary email if the email field is null
        let email = userInfo.email;
        if (!email) {
          try {
            const emails = await github.request('/user/emails');
            const primaryEmail = emails.find(e => e.primary && e.verified);
            email = primaryEmail ? primaryEmail.email : '';
          } catch (e) {
            console.error('Failed to fetch user emails:', e);
          }
        }
        
        res.json({
          valid: true,
          user: {
            login: userInfo.login,
            name: userInfo.name || userInfo.login,
            email: email || '',
            avatarUrl: userInfo.avatar_url || ''
          }
        });
      } else {
        res.json({
          valid: false,
          error: result.error
        });
      }
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