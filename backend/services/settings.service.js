import { promises as fs } from "fs";
import config from "../config/index.js";
import { encrypt, decrypt } from "../utils/crypto.js";
import GitHubService from "./github.service.js";

/**
 * SettingsService - Handles all settings-related operations
 *
 * This service provides a clean interface for settings management,
 * hiding the complexity of encryption, validation, credential storage,
 * and GitHub integration.
 *
 * Following deep module principles: simple interface (6 methods),
 * complex implementation handling encryption, validation, and persistence.
 */
export class SettingsService {
  constructor(models, eventEmitterService = null) {
    this.models = models;
    this.eventEmitterService = eventEmitterService;
  }

  /**
   * Get all settings with sensitive data properly masked
   * @returns {Promise<Object>} Settings object with masked sensitive data
   */
  async getSettings() {
    const settings = {};

    try {
      // Get GitHub token status (without exposing the actual token)
      const githubTokenSetting = await this.models.db.get(
        "SELECT value FROM settings WHERE key = ?",
        ["github_token"],
      );

      if (githubTokenSetting) {
        // SECURITY: Only indicate presence, never expose actual token
        settings.hasGithubToken = true;
        // Provide empty token for form compatibility (frontend doesn't use this value)
        settings.githubToken = "";
      } else {
        settings.hasGithubToken = false;
        settings.githubToken = "";
      }

      // Get Git user settings
      const gitUserName = await this.models.db.get(
        "SELECT value FROM settings WHERE key = ?",
        ["git_user_name"],
      );

      const gitUserEmail = await this.models.db.get(
        "SELECT value FROM settings WHERE key = ?",
        ["git_user_email"],
      );

      settings.gitUserName = gitUserName?.value || "";
      settings.gitUserEmail = gitUserEmail?.value || "";

      // Check file-based settings for backward compatibility
      try {
        const fileSettings = await fs.readFile(config.settingsPath, "utf8");
        const parsed = JSON.parse(fileSettings);
        settings.fileExists = true;
        settings.fileHasToken = !!parsed.githubToken;
      } catch (error) {
        settings.fileExists = false;
        settings.fileHasToken = false;
      }

      return settings;
    } catch (error) {
      throw new Error(`Failed to retrieve settings: ${error.message}`);
    }
  }

  /**
   * Update settings with validation and encryption
   * @param {Object} settingsData - Settings to update
   * @returns {Promise<Object>} Updated settings status
   */
  async updateSettings(settingsData) {
    const { githubToken, gitUserName, gitUserEmail } = settingsData;

    if (!githubToken) {
      throw new Error("GitHub token is required");
    }

    try {
      // Validate GitHub token before saving
      const validation = await this.validateGitHubToken(githubToken);
      if (!validation.valid) {
        throw new Error(`Invalid GitHub token: ${validation.error}`);
      }

      // Encrypt and save GitHub token to database
      const encryptedToken = encrypt(githubToken);
      await this.models.db.run(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ["github_token", encryptedToken],
      );

      // Save Git user settings if provided
      if (gitUserName !== undefined) {
        await this.models.db.run(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          ["git_user_name", gitUserName || ""],
        );
      }

      if (gitUserEmail !== undefined) {
        await this.models.db.run(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          ["git_user_email", gitUserEmail || ""],
        );
      }

      // Save to file for backward compatibility
      const fileSettings = { githubToken };
      await fs.writeFile(
        config.settingsPath,
        JSON.stringify(fileSettings, null, 2),
      );

      // Emit events for settings changes
      if (this.eventEmitterService) {
        this.eventEmitterService.emit("settings.updated", {
          hasGithubToken: true,
          gitUserName: gitUserName || "",
          gitUserEmail: gitUserEmail || "",
          timestamp: new Date().toISOString(),
        });

        this.eventEmitterService.emit("settings.github-token-changed", {
          valid: true,
          user: validation.user,
          timestamp: new Date().toISOString(),
        });

        if (gitUserName !== undefined || gitUserEmail !== undefined) {
          this.eventEmitterService.emit("settings.git-config-changed", {
            gitUserName: gitUserName || "",
            gitUserEmail: gitUserEmail || "",
            timestamp: new Date().toISOString(),
          });
        }
      }

      return {
        message: "Settings updated successfully",
        hasGithubToken: true,
        gitUserName: gitUserName || "",
        gitUserEmail: gitUserEmail || "",
        user: validation.user,
      };
    } catch (error) {
      throw new Error(`Failed to update settings: ${error.message}`);
    }
  }

  /**
   * Validate GitHub token and get user information
   * @param {string} token - GitHub token to validate
   * @returns {Promise<Object>} Validation result with user info
   */
  async validateGitHubToken(token) {
    if (!token) {
      return { valid: false, error: "No token provided" };
    }

    try {
      const github = new GitHubService(token);
      const result = await github.validateToken();

      if (result.valid) {
        // GitHubService.validateToken() now returns full user info
        return {
          valid: true,
          user: result.user,
        };
      } else {
        return { valid: false, error: result.error };
      }
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Get Git configuration for the current user
   * @returns {Promise<Object>} Git user configuration
   */
  async getGitConfig() {
    try {
      const gitUserName = await this.models.db.get(
        "SELECT value FROM settings WHERE key = ?",
        ["git_user_name"],
      );

      const gitUserEmail = await this.models.db.get(
        "SELECT value FROM settings WHERE key = ?",
        ["git_user_email"],
      );

      return {
        name: gitUserName?.value || "",
        email: gitUserEmail?.value || "",
      };
    } catch (error) {
      throw new Error(`Failed to get git configuration: ${error.message}`);
    }
  }

  /**
   * Update Git user configuration
   * @param {Object} gitConfig - Git configuration to update
   * @returns {Promise<Object>} Updated configuration
   */
  async updateGitConfig(gitConfig) {
    const { name, email } = gitConfig;

    try {
      if (name !== undefined) {
        await this.models.db.run(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          ["git_user_name", name || ""],
        );
      }

      if (email !== undefined) {
        await this.models.db.run(
          "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
          ["git_user_email", email || ""],
        );
      }

      // Emit event for git config changes
      if (this.eventEmitterService) {
        this.eventEmitterService.emit("settings.git-config-changed", {
          gitUserName: name || "",
          gitUserEmail: email || "",
          timestamp: new Date().toISOString(),
        });
      }

      return {
        name: name || "",
        email: email || "",
      };
    } catch (error) {
      throw new Error(`Failed to update git configuration: ${error.message}`);
    }
  }

  /**
   * Test GitHub connection and get current token status
   * @returns {Promise<Object>} Connection test result
   */
  async testGitHubConnection() {
    try {
      // Get current token from database
      const githubTokenSetting = await this.models.db.get(
        "SELECT value FROM settings WHERE key = ?",
        ["github_token"],
      );

      if (!githubTokenSetting?.value) {
        return {
          valid: false,
          error: "No GitHub token configured",
        };
      }

      // Decrypt token
      const decryptedToken = decrypt(githubTokenSetting.value);
      const token = decryptedToken || githubTokenSetting.value; // Fallback for unencrypted tokens

      // Validate token
      return await this.validateGitHubToken(token);
    } catch (error) {
      return {
        valid: false,
        error: `Connection test failed: ${error.message}`,
      };
    }
  }

  /**
   * Create a GitHub Service instance with the current token
   * @returns {Promise<GitHubService|null>} GitHub Service instance or null if no token
   */
  async createGitHubAPIInstance() {
    try {
      const token = await this._getDecryptedGitHubToken();
      if (!token) {
        return null;
      }
      return new GitHubService(token);
    } catch (error) {
      console.error("Failed to create GitHub Service instance:", error.message);
      return null;
    }
  }

  /**
   * Get decrypted GitHub token for internal use (NEVER expose to API)
   * @returns {Promise<string|null>} Decrypted token or null
   * @private
   */
  async _getDecryptedGitHubToken() {
    try {
      const githubTokenSetting = await this.models.db.get(
        "SELECT value FROM settings WHERE key = ?",
        ["github_token"],
      );

      if (!githubTokenSetting?.value) {
        return null;
      }

      const decryptedToken = decrypt(githubTokenSetting.value);
      return decryptedToken || githubTokenSetting.value; // Fallback for unencrypted tokens
    } catch (error) {
      console.error("Failed to decrypt GitHub token:", error.message);
      return null;
    }
  }
}
