#!/usr/bin/env node

// Simple Project Manager - Just manages git repos and branches
// No Docker spawning, no multiple ports, just git operations

import express from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import GitHubAPI from './server/github.js';

const execAsync = promisify(exec);
const app = express();
app.use(express.json());
app.use(express.static('.'));

const PORT = 3005;
const PROJECTS_DIR = './projects';
const SETTINGS_PATH = path.join(process.env.HOME || '.', '.pocketdev-settings.json');

// GitHub integration
let githubToken = process.env.GITHUB_TOKEN || '';
let github = null;

// Load settings on startup
async function loadSettings() {
  try {
    const data = await fs.readFile(SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(data);
    if (settings.githubToken) {
      githubToken = settings.githubToken;
      github = new GitHubAPI(githubToken);
    }
  } catch (e) {
    // No settings file yet
  }
}

await loadSettings();
await fs.mkdir(PROJECTS_DIR, { recursive: true });

// Settings endpoints
app.get('/api/settings', (req, res) => {
  res.json({
    githubToken: githubToken ? '***' + githubToken.slice(-4) : '',
    hasToken: !!githubToken
  });
});

app.post('/api/settings', async (req, res) => {
  const { githubToken: newToken } = req.body;
  
  if (newToken) {
    const testApi = new GitHubAPI(newToken);
    try {
      const validation = await testApi.validateToken();
      if (validation.valid) {
        githubToken = newToken;
        github = testApi;
        await fs.writeFile(SETTINGS_PATH, JSON.stringify({ githubToken }));
        res.json({ success: true, username: validation.username });
      } else {
        res.status(400).json({ success: false, error: 'Invalid token' });
      }
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  }
});

// GitHub endpoints
app.get('/api/github/status', async (req, res) => {
  if (!github) {
    return res.json({ enabled: false });
  }
  
  try {
    const validation = await github.validateToken();
    res.json({ enabled: true, valid: validation.valid, username: validation.username });
  } catch (error) {
    res.json({ enabled: true, valid: false });
  }
});

app.get('/api/github/repos', async (req, res) => {
  if (!github) {
    return res.status(400).json({ error: 'GitHub token not configured' });
  }
  
  try {
    const repos = await github.getRepositories();
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Simple project endpoints
app.post('/api/projects/setup', async (req, res) => {
  const { repoUrl, branch = 'main', projectName } = req.body;
  
  try {
    const repoName = projectName || path.basename(repoUrl, '.git');
    const projectPath = path.join(PROJECTS_DIR, repoName);
    
    // Clone if doesn't exist
    if (!await fs.access(projectPath).then(() => true).catch(() => false)) {
      await execAsync(`git clone ${repoUrl} ${projectPath}`);
    }
    
    // Create new branch
    const branchName = `claude-${branch}-${Date.now()}`;
    await execAsync(`git checkout -b ${branchName}`, { cwd: projectPath });
    
    res.json({
      success: true,
      project: {
        name: repoName,
        path: projectPath,
        branch: branchName,
        message: `Project ready at ${projectPath}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List projects (just directories)
app.get('/api/projects', async (req, res) => {
  try {
    const dirs = await fs.readdir(PROJECTS_DIR);
    const projects = [];
    
    for (const dir of dirs) {
      const projectPath = path.join(PROJECTS_DIR, dir);
      const stat = await fs.stat(projectPath);
      
      if (stat.isDirectory()) {
        try {
          // Get current branch
          const { stdout } = await execAsync('git branch --show-current', { cwd: projectPath });
          projects.push({
            name: dir,
            path: projectPath,
            branch: stdout.trim()
          });
        } catch (e) {
          // Not a git repo
        }
      }
    }
    
    res.json(projects);
  } catch (error) {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Simple Project Manager running on port ${PORT}`);
});