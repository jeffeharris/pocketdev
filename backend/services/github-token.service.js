import config from '../config/index.js';

/**
 * Service for managing GitHub tokens
 */
class GitHubTokenService {
  constructor(db) {
    this.db = db;
    this._cachedToken = null;
    this._cacheExpiry = null;
  }

  /**
   * Get GitHub token from environment or database
   * @returns {Promise<string>} GitHub token or empty string
   */
  async getToken() {
    
    // Check cache first (5 minute cache)
    if (this._cachedToken && this._cacheExpiry && Date.now() < this._cacheExpiry) {
      return this._cachedToken;
    }

    // First try environment variable
    let githubToken = config.githubToken;
    
    // If no env token, try to get from database
    if (!githubToken && this.db) {
      try {
        const { decrypt } = await import('../utils/crypto.js');
        const githubTokenSetting = await this.db.get(
          'SELECT value FROM settings WHERE key = ?',
          ['github_token']
        );
        
        if (githubTokenSetting) {
          // Try to decrypt the token
          const decryptedToken = decrypt(githubTokenSetting.value);
          if (decryptedToken) {
            githubToken = decryptedToken;
            console.log('[GitHubTokenService] Using token from database (encrypted)');
          } else {
            // Handle case where token might not be encrypted (legacy)
            githubToken = githubTokenSetting.value;
            console.log('[GitHubTokenService] Using token from database (unencrypted)');
          }
        }
      } catch (e) {
        console.error('[GitHubTokenService] Failed to retrieve token from database:', e);
      }
    } else if (githubToken) {
      console.log('[GitHubTokenService] Using token from environment');
    }
    
    // Cache the token for 5 minutes
    this._cachedToken = githubToken || '';
    this._cacheExpiry = Date.now() + (5 * 60 * 1000);
    
    return this._cachedToken;
  }

  /**
   * Clear the token cache (useful after settings update)
   */
  clearCache() {
    this._cachedToken = null;
    this._cacheExpiry = null;
  }
}

// Export a singleton instance
let instance = null;

export function getGitHubTokenService(db) {
  if (!instance) {
    instance = new GitHubTokenService(db);
  }
  return instance;
}

export default GitHubTokenService;