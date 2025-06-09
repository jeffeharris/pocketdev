import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

const CONFIG_DIR = path.join(homedir(), '.pocketdev');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

class Config {
  constructor() {
    this.config = {
      github: {
        token: process.env.GITHUB_TOKEN || '',
        username: process.env.GITHUB_USERNAME || '',
        repository: process.env.GITHUB_REPOSITORY || '',
        defaultBranch: process.env.DEFAULT_BRANCH || 'main'
      },
      localRepo: process.env.GIT_REPO || '/workspace'
    };
    this.loaded = false;
  }

  async load() {
    try {
      await mkdir(CONFIG_DIR, { recursive: true });
      const data = await readFile(CONFIG_FILE, 'utf8');
      const saved = JSON.parse(data);
      
      // Merge saved config with environment variables (env vars take precedence)
      this.config = {
        github: {
          token: process.env.GITHUB_TOKEN || saved.github?.token || '',
          username: process.env.GITHUB_USERNAME || saved.github?.username || '',
          repository: process.env.GITHUB_REPOSITORY || saved.github?.repository || '',
          defaultBranch: process.env.DEFAULT_BRANCH || saved.github?.defaultBranch || 'main'
        },
        localRepo: process.env.GIT_REPO || saved.localRepo || '/workspace'
      };
      
      this.loaded = true;
      console.log('Config loaded from:', CONFIG_FILE);
    } catch (error) {
      // Config file doesn't exist or is invalid, use defaults
      console.log('No config file found, using environment variables');
      this.loaded = true;
    }
  }

  async save() {
    try {
      await mkdir(CONFIG_DIR, { recursive: true });
      await writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
      console.log('Config saved to:', CONFIG_FILE);
    } catch (error) {
      console.error('Failed to save config:', error);
      throw error;
    }
  }

  async update(updates) {
    if (updates.github) {
      this.config.github = { ...this.config.github, ...updates.github };
    }
    if (updates.localRepo !== undefined) {
      this.config.localRepo = updates.localRepo;
    }
    await this.save();
  }

  get() {
    return this.config;
  }

  getGitCredentials() {
    const { token, username } = this.config.github;
    return { token, username };
  }

  getRepository() {
    return {
      url: this.config.github.repository,
      branch: this.config.github.defaultBranch,
      localPath: this.config.localRepo
    };
  }

  isConfigured() {
    const { token, username, repository } = this.config.github;
    return !!(token && username && repository);
  }
}

export default new Config();