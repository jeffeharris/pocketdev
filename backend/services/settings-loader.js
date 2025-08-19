/**
 * SettingsLoader - Deep Module for Settings Management
 * 
 * Handles loading application settings from multiple sources with a simple interface.
 * Hides the complexity of source priority, decryption, and fallback logic.
 * 
 * Public API (3 methods):
 * - loadGitHubIntegration() - Load and configure GitHub integration
 * - loadAllSettings() - Load all application settings
 * - getSettings() - Get current loaded settings
 */

import { promises as fs } from 'fs';
import GitHubAPI from '../github.js';

export class SettingsLoader {
  constructor(db, config) {
    this.db = db;
    this.config = config;
    this.settings = {};
    this.github = null;
  }

  /**
   * Load and configure GitHub integration
   * Checks multiple sources in priority order: database, file, environment
   * @returns {Promise<Object|null>} Configured GitHub API instance or null
   */
  async loadGitHubIntegration() {
    console.log('[SettingsLoader] Loading GitHub integration settings...');
    
    // Priority 1: Database (encrypted)
    const githubFromDb = await this._loadGitHubFromDatabase();
    if (githubFromDb) {
      this.github = githubFromDb;
      this.settings.githubSource = 'database';
      console.log('[SettingsLoader] GitHub integration enabled from database');
      return this.github;
    }
    
    // Priority 2: Settings file
    const githubFromFile = await this._loadGitHubFromFile();
    if (githubFromFile) {
      this.github = githubFromFile;
      this.settings.githubSource = 'file';
      console.log('[SettingsLoader] GitHub integration enabled from settings file');
      return this.github;
    }
    
    // Priority 3: Environment variable
    const githubFromEnv = this._loadGitHubFromEnvironment();
    if (githubFromEnv) {
      this.github = githubFromEnv;
      this.settings.githubSource = 'environment';
      console.log('[SettingsLoader] GitHub integration enabled from environment');
      return this.github;
    }
    
    console.log('[SettingsLoader] No GitHub token found in any source');
    return null;
  }

  /**
   * Load all application settings from available sources
   * @returns {Promise<Object>} All loaded settings
   */
  async loadAllSettings() {
    // Load GitHub integration
    await this.loadGitHubIntegration();
    
    // Load other settings from file if available
    try {
      const fileSettings = await this._loadSettingsFile();
      this.settings = { ...this.settings, ...fileSettings };
    } catch (error) {
      // Settings file is optional
      console.log('[SettingsLoader] No settings file found or error loading:', error.message);
    }
    
    // Add environment settings
    this.settings.nodeEnv = process.env.NODE_ENV || 'development';
    this.settings.port = this.config.port;
    this.settings.projectsDir = this.config.projectsDir;
    
    return this.settings;
  }

  /**
   * Get current loaded settings
   * @returns {Object} Current settings object
   */
  getSettings() {
    return {
      settings: this.settings,
      github: this.github
    };
  }

  // Private methods (hidden complexity)
  
  async _loadGitHubFromDatabase() {
    try {
      const result = await this.db.get(
        'SELECT value FROM settings WHERE key = ?',
        ['github_token']
      );
      
      if (!result?.value) {
        return null;
      }
      
      // Decrypt the token
      const { decrypt } = await import('../utils/crypto.js');
      const decryptedToken = decrypt(result.value);
      const token = decryptedToken || result.value; // Fallback to raw value if decryption fails
      
      return new GitHubAPI(token);
    } catch (error) {
      console.error('[SettingsLoader] Error loading GitHub token from database:', error.message);
      return null;
    }
  }
  
  async _loadGitHubFromFile() {
    try {
      const settingsData = await fs.readFile(this.config.settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      if (settings.githubToken) {
        return new GitHubAPI(settings.githubToken);
      }
      
      return null;
    } catch (error) {
      // File might not exist, which is fine
      return null;
    }
  }
  
  _loadGitHubFromEnvironment() {
    if (this.config.githubToken) {
      return new GitHubAPI(this.config.githubToken);
    }
    return null;
  }
  
  async _loadSettingsFile() {
    try {
      const settingsData = await fs.readFile(this.config.settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      // Remove sensitive data before returning
      const { githubToken, ...safeSettings } = settings;
      return safeSettings;
    } catch (error) {
      return {};
    }
  }
}