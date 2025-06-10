import { readFile, writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { homedir } from 'os';

const CONFIG_DIR = path.join(homedir(), '.pocketdev');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

class Config {
  constructor() {
    this.config = {
      github: {
        token: '',
        username: '',
        repository: '',
        defaultBranch: 'main'
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
      
      // Use saved config
      this.config = {
        github: {
          token: saved.github?.token || '',
          username: saved.github?.username || '',
          repository: saved.github?.repository || '',
          defaultBranch: saved.github?.defaultBranch || 'main'
        },
        localRepo: saved.localRepo || process.env.GIT_REPO || '/workspace'
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
    // Reload current config first to avoid overwriting
    await this.load();
    
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