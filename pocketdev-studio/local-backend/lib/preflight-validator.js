/**
 * Pre-flight Validator
 * Validates task requirements before spinning up expensive containers
 */

import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import path from 'path';
import https from 'https';
import { URL } from 'url';

export default class PreflightValidator {
  constructor() {
    this.validationResults = new Map();
  }

  /**
   * Run all pre-flight checks for a task
   * @param {Object} task - Task configuration
   * @returns {Promise<{valid: boolean, errors: Array, warnings: Array}>}
   */
  async validateTask(task) {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      checks: {}
    };

    // Run all checks in parallel for speed
    const checks = await Promise.allSettled([
      this.checkAPIKey(),
      this.checkDockerAvailable(),
      this.checkDiskSpace(),
      this.checkRepositoryAccess(task.repository),
      this.checkGitCredentials(task.repository),
      this.validateTaskConfiguration(task)
    ]);

    // Process results
    const checkNames = [
      'apiKey',
      'docker', 
      'diskSpace',
      'repository',
      'gitCredentials',
      'taskConfig'
    ];

    checks.forEach((result, index) => {
      const checkName = checkNames[index];
      if (result.status === 'fulfilled') {
        results.checks[checkName] = result.value;
        if (!result.value.valid) {
          results.valid = false;
          results.errors.push(...(result.value.errors || []));
        }
        if (result.value.warnings) {
          results.warnings.push(...result.value.warnings);
        }
      } else {
        results.valid = false;
        results.errors.push({
          check: checkName,
          message: `Check failed: ${result.reason.message}`
        });
      }
    });

    // Cache results
    this.validationResults.set(task.id || 'latest', results);

    return results;
  }

  /**
   * Check if API key is valid
   */
  async checkAPIKey() {
    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
    
    if (!apiKey) {
      return {
        valid: false,
        errors: [{
          check: 'apiKey',
          message: 'No API key found. Please set ANTHROPIC_API_KEY environment variable.',
          fix: 'export ANTHROPIC_API_KEY="your-api-key"'
        }]
      };
    }

    // Basic format validation
    if (!apiKey.startsWith('sk-')) {
      return {
        valid: false,
        errors: [{
          check: 'apiKey',
          message: 'API key format invalid. Anthropic keys should start with "sk-".',
          fix: 'Ensure you\'re using a valid Anthropic API key'
        }]
      };
    }

    // Test with a minimal API call
    try {
      const testResponse = await this.testAnthropicAPI(apiKey);
      if (!testResponse.success) {
        return {
          valid: false,
          errors: [{
            check: 'apiKey',
            message: 'API key validation failed. Key may be invalid or expired.',
            fix: 'Check your API key at console.anthropic.com'
          }]
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [{
          check: 'apiKey',
          message: `API key test failed: ${error.message}`,
          fix: 'Verify your API key and internet connection'
        }]
      };
    }

    return { valid: true };
  }

  /**
   * Test Anthropic API with minimal request
   */
  async testAnthropicAPI(apiKey) {
    return new Promise((resolve) => {
      const data = JSON.stringify({
        model: 'claude-3-haiku-20240307',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10
      });

      const options = {
        hostname: 'api.anthropic.com',
        port: 443,
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        }
      };

      const req = https.request(options, (res) => {
        if (res.statusCode === 200) {
          resolve({ success: true });
        } else if (res.statusCode === 401) {
          resolve({ success: false, error: 'Invalid API key' });
        } else {
          resolve({ success: false, error: `API returned ${res.statusCode}` });
        }
        // Drain response
        res.on('data', () => {});
      });

      req.on('error', (error) => {
        resolve({ success: false, error: error.message });
      });

      req.write(data);
      req.end();
    });
  }

  /**
   * Check Docker availability
   */
  async checkDockerAvailable() {
    try {
      // Check if Docker daemon is running
      await new Promise((resolve, reject) => {
        const dockerCheck = spawn('docker', ['version'], { timeout: 5000 });
        
        dockerCheck.on('error', () => {
          reject(new Error('Docker command not found'));
        });
        
        dockerCheck.on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(new Error(`Docker check failed with code ${code}`));
          }
        });
      });

      // Check if our image exists
      const imageExists = await this.checkDockerImage();
      if (!imageExists) {
        return {
          valid: false,
          errors: [{
            check: 'docker',
            message: 'Docker image pocketdev/ai-developer:latest not found',
            fix: 'Run: npm run docker:build'
          }]
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        errors: [{
          check: 'docker',
          message: `Docker not available: ${error.message}`,
          fix: 'Ensure Docker Desktop is running'
        }]
      };
    }
  }

  /**
   * Check if Docker image exists
   */
  async checkDockerImage() {
    return new Promise((resolve) => {
      const imageCheck = spawn('docker', ['image', 'inspect', 'pocketdev/ai-developer:latest']);
      imageCheck.on('close', (code) => {
        resolve(code === 0);
      });
    });
  }

  /**
   * Check available disk space
   */
  async checkDiskSpace() {
    try {
      const stats = await fs.statfs('/tmp');
      const availableGB = (stats.bavail * stats.bsize) / (1024 * 1024 * 1024);
      
      if (availableGB < 1) {
        return {
          valid: false,
          errors: [{
            check: 'diskSpace',
            message: `Insufficient disk space: ${availableGB.toFixed(2)}GB available`,
            fix: 'Free up at least 1GB of disk space'
          }]
        };
      }

      if (availableGB < 5) {
        return {
          valid: true,
          warnings: [{
            check: 'diskSpace',
            message: `Low disk space: ${availableGB.toFixed(2)}GB available`,
            suggestion: 'Consider freeing up space for optimal performance'
          }]
        };
      }

      return { valid: true };
    } catch (error) {
      // Non-fatal - just warn
      return {
        valid: true,
        warnings: [{
          check: 'diskSpace',
          message: 'Could not check disk space',
          suggestion: 'Ensure you have at least 1GB free'
        }]
      };
    }
  }

  /**
   * Check repository access
   */
  async checkRepositoryAccess(repository) {
    if (!repository) {
      return {
        valid: false,
        errors: [{
          check: 'repository',
          message: 'No repository URL provided',
          fix: 'Provide a valid repository URL'
        }]
      };
    }

    const repoUrl = typeof repository === 'string' ? repository : repository.url;
    
    if (!repoUrl) {
      return {
        valid: false,
        errors: [{
          check: 'repository',
          message: 'Invalid repository configuration',
          fix: 'Provide repository as string URL or {url: "..."} object'
        }]
      };
    }

    // Validate URL format
    try {
      const url = new URL(repoUrl);
      // Check if it's a valid git repository URL
      if (!url.protocol || !['http:', 'https:', 'git:'].includes(url.protocol)) {
        return {
          valid: false,
          errors: [{
            check: 'repository',
            message: 'Invalid repository URL protocol',
            fix: 'Use http://, https://, or git:// protocol'
          }]
        };
      }
    } catch (error) {
      return {
        valid: false,
        errors: [{
          check: 'repository',
          message: 'Invalid repository URL format',
          fix: 'Provide a valid URL (e.g., https://github.com/owner/repo)'
        }]
      };
    }

    // Check if it's a GitHub URL and if it's public
    if (repoUrl.includes('github.com')) {
      try {
        const isPublic = await this.checkGitHubRepoPublic(repoUrl);
        if (isPublic) {
          return { valid: true };
        }
        // Private repo - will need credentials
        return {
          valid: true,
          warnings: [{
            check: 'repository',
            message: 'Repository appears to be private',
            suggestion: 'Ensure Git credentials are configured'
          }]
        };
      } catch (error) {
        return {
          valid: true,
          warnings: [{
            check: 'repository',
            message: 'Could not verify repository accessibility',
            suggestion: 'Ensure repository URL is correct'
          }]
        };
      }
    }

    return { valid: true };
  }

  /**
   * Check if GitHub repo is public
   */
  async checkGitHubRepoPublic(repoUrl) {
    try {
      // Extract owner/repo from URL
      const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (!match) return false;

      const [, owner, repo] = match;
      
      return new Promise((resolve) => {
        https.get(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { 'User-Agent': 'PocketDev' }
        }, (res) => {
          resolve(res.statusCode === 200);
          res.on('data', () => {}); // Drain
        }).on('error', () => resolve(false));
      });
    } catch {
      return false;
    }
  }

  /**
   * Check Git credentials if needed
   */
  async checkGitCredentials(repository) {
    if (!repository || typeof repository === 'string') {
      return { valid: true }; // No credentials provided
    }

    const { credentials } = repository;
    if (!credentials) {
      return { valid: true }; // No credentials needed
    }

    if (!credentials.username || !credentials.token) {
      return {
        valid: false,
        errors: [{
          check: 'gitCredentials',
          message: 'Incomplete Git credentials provided',
          fix: 'Provide both username and token for private repositories'
        }]
      };
    }

    // Test credentials by checking GitHub API
    try {
      const testResult = await new Promise((resolve) => {
        const options = {
          hostname: 'api.github.com',
          path: '/user',
          method: 'GET',
          headers: {
            'Authorization': `token ${credentials.token}`,
            'User-Agent': 'PocketDev',
            'Accept': 'application/vnd.github.v3+json'
          }
        };

        https.get(options, (res) => {
          if (res.statusCode === 200) {
            // Token is valid
            resolve(true);
          } else if (res.statusCode === 401) {
            // Invalid token
            resolve(false);
          } else {
            // Other errors - assume token might still work
            resolve(true);
          }
          res.on('data', () => {}); // Drain response
        }).on('error', () => resolve(true)); // Network errors shouldn't fail validation
      });

      if (!testResult) {
        return {
          valid: false,
          errors: [{
            check: 'gitCredentials',
            message: 'GitHub token validation failed',
            fix: 'Check your GitHub fine-grained personal access token is valid and has these permissions: Contents (Read/Write), Pull requests (Read/Write), and Metadata (Read).'
          }]
        };
      }
    } catch {
      // Non-fatal - credentials will be tested during clone
    }

    return { valid: true };
  }

  /**
   * Validate task configuration
   */
  async validateTaskConfiguration(task) {
    const errors = [];

    if (!task.description || task.description.trim().length < 10) {
      errors.push({
        check: 'taskConfig',
        message: 'Task description too short or missing',
        fix: 'Provide a clear description of what needs to be implemented'
      });
    }

    if (!task.acceptanceCriteria || task.acceptanceCriteria.length === 0) {
      errors.push({
        check: 'taskConfig',
        message: 'No acceptance criteria provided',
        fix: 'Add at least one acceptance criterion to verify implementation'
      });
    }

    // Warn about overly complex tasks
    const warnings = [];
    if (task.description && task.description.length > 1000) {
      warnings.push({
        check: 'taskConfig',
        message: 'Task description is very long',
        suggestion: 'Consider breaking into smaller, focused tasks'
      });
    }

    if (task.acceptanceCriteria && task.acceptanceCriteria.length > 10) {
      warnings.push({
        check: 'taskConfig',
        message: 'Many acceptance criteria specified',
        suggestion: 'Consider splitting into multiple tasks for better results'
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Format validation results for display
   */
  formatResults(results) {
    const lines = [];
    
    if (results.valid) {
      lines.push('✅ All pre-flight checks passed');
    } else {
      lines.push('❌ Pre-flight validation failed');
      lines.push('');
      lines.push('Errors:');
      results.errors.forEach(error => {
        lines.push(`  ❌ ${error.message}`);
        if (error.fix) {
          lines.push(`     Fix: ${error.fix}`);
        }
      });
    }

    if (results.warnings && results.warnings.length > 0) {
      lines.push('');
      lines.push('Warnings:');
      results.warnings.forEach(warning => {
        lines.push(`  ⚠️  ${warning.message}`);
        if (warning.suggestion) {
          lines.push(`     ${warning.suggestion}`);
        }
      });
    }

    return lines.join('\n');
  }
}

export { PreflightValidator };