import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

class ProjectConfig {
  constructor() {
    this.configCache = new Map();
  }

  /**
   * Initialize a new project with .pocketdev structure
   */
  async initializeProject(projectPath) {
    // If no project path provided, use the current repository root
    if (!projectPath) {
      // Go up from local-backend/lib to find the repo root
      projectPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
    }
    const pocketdevPath = path.join(projectPath, '.pocketdev');
    
    // Create directory structure
    await fs.mkdir(path.join(pocketdevPath, 'engineers'), { recursive: true });
    await fs.mkdir(path.join(pocketdevPath, 'workspaces', 'frontend'), { recursive: true });
    await fs.mkdir(path.join(pocketdevPath, 'workspaces', 'backend'), { recursive: true });
    await fs.mkdir(path.join(pocketdevPath, 'workspaces', 'devops'), { recursive: true });
    
    // Check for existing CLAUDE.md
    let teamMemoryContent = `# Team Memory - ${path.basename(projectPath)}

Last updated: ${new Date().toISOString().split('T')[0]}

## Project Overview
This is the shared knowledge base for all AI engineers working on this project.

## Architecture
<!-- Add architecture details as discovered -->

## Conventions
<!-- Add coding conventions as discovered -->

## Recent Discoveries
<!-- AI engineers will add learnings here -->
`;

    try {
      const claudeMd = await fs.readFile(path.join(projectPath, 'CLAUDE.md'), 'utf8');
      // Extract key sections
      teamMemoryContent = `# Team Memory - ${path.basename(projectPath)}

Last updated: ${new Date().toISOString().split('T')[0]}

## Imported from CLAUDE.md
See [CLAUDE.md](../CLAUDE.md) for detailed project instructions.

### Key Points
${this.extractKeyPoints(claudeMd)}

## Recent Discoveries
<!-- AI engineers will add learnings here -->
`;
    } catch (error) {
      // No CLAUDE.md found, use default
    }

    // Create team memory
    await fs.writeFile(
      path.join(pocketdevPath, 'team-memory.md'),
      teamMemoryContent
    );

    // Create initial config
    const config = {
      version: 1,
      project: {
        name: path.basename(projectPath),
        repository: '',
        default_branch: 'main'
      },
      credentials: {
        profile: ''
      },
      settings: {
        workspace_root: path.dirname(projectPath),
        host_agent_mode: 'auto'
      },
      initialized: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };

    await this.saveConfig(projectPath, config);
    return config;
  }

  /**
   * Get project configuration
   */
  async getConfig(projectPath) {
    // Check cache first
    if (this.configCache.has(projectPath)) {
      return this.configCache.get(projectPath);
    }

    const configPath = path.join(projectPath, '.pocketdev', 'config.json');
    
    try {
      const configJson = await fs.readFile(configPath, 'utf8');
      const config = JSON.parse(configJson);
      this.configCache.set(projectPath, config);
      return config;
    } catch (error) {
      return null;
    }
  }

  /**
   * Save project configuration
   */
  async saveConfig(projectPath, config) {
    const configPath = path.join(projectPath, '.pocketdev', 'config.json');
    
    // Update timestamp
    config.last_updated = new Date().toISOString();
    
    // Save to file with pretty formatting
    const configJson = JSON.stringify(config, null, 2);
    
    await fs.writeFile(configPath, configJson);
    
    // Update cache
    this.configCache.set(projectPath, config);
    
    return config;
  }

  /**
   * Update project configuration
   */
  async updateConfig(projectPath, updates) {
    const config = await this.getConfig(projectPath) || {};
    
    // Deep merge updates
    const updatedConfig = this.deepMerge(config, updates);
    
    return await this.saveConfig(projectPath, updatedConfig);
  }

  /**
   * Get credentials for the current profile
   */
  getCredentials(config) {
    if (!config?.credentials?.profile) {
      return null;
    }

    const profile = config.credentials.profile;
    const usernameKey = `${profile.toUpperCase()}_USERNAME`;
    const tokenKey = `${profile.toUpperCase()}_TOKEN`;

    const username = process.env[usernameKey];
    const token = process.env[tokenKey];

    if (!username || !token) {
      return null;
    }

    return { username, token };
  }

  /**
   * Validate GitHub token and fetch user info
   */
  async validateGitHubToken(token) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) {
        throw new Error('Invalid token');
      }

      return await response.json();
    } catch (error) {
      throw new Error(`GitHub token validation failed: ${error.message}`);
    }
  }

  /**
   * Fetch user's repositories
   */
  async fetchGitHubRepos(token) {
    try {
      const repos = [];
      let page = 1;
      
      while (true) {
        const response = await fetch(
          `https://api.github.com/user/repos?per_page=100&page=${page}&sort=pushed`,
          {
            headers: {
              'Authorization': `token ${token}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch repositories');
        }

        const pageRepos = await response.json();
        if (pageRepos.length === 0) break;
        
        repos.push(...pageRepos);
        page++;
        
        // Limit to 300 repos for performance
        if (repos.length >= 300) break;
      }

      return repos.map(repo => ({
        name: repo.name,
        full_name: repo.full_name,
        url: repo.clone_url,
        private: repo.private,
        default_branch: repo.default_branch,
        description: repo.description,
        updated_at: repo.updated_at
      }));
    } catch (error) {
      throw new Error(`Failed to fetch repositories: ${error.message}`);
    }
  }

  /**
   * Fetch branches for a repository
   */
  async fetchGitHubBranches(token, repoFullName) {
    try {
      const response = await fetch(
        `https://api.github.com/repos/${repoFullName}/branches?per_page=100`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch branches');
      }

      const branches = await response.json();
      return branches.map(branch => branch.name);
    } catch (error) {
      throw new Error(`Failed to fetch branches: ${error.message}`);
    }
  }

  // Helper methods
  extractKeyPoints(claudeMd) {
    // Simple extraction of headers and first paragraph
    const lines = claudeMd.split('\n');
    const keyPoints = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.startsWith('## ')) {
        keyPoints.push(`- ${line.substring(3)}`);
        // Get first paragraph after header
        for (let j = i + 1; j < lines.length && j < i + 5; j++) {
          if (lines[j].trim() && !lines[j].startsWith('#')) {
            keyPoints.push(`  - ${lines[j].trim()}`);
            break;
          }
        }
      }
    }
    
    return keyPoints.join('\n');
  }

  deepMerge(target, source) {
    const output = { ...target };
    
    for (const key in source) {
      if (source[key] instanceof Object && key in target) {
        output[key] = this.deepMerge(target[key], source[key]);
      } else {
        output[key] = source[key];
      }
    }
    
    return output;
  }
}

export default ProjectConfig;