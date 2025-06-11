#!/usr/bin/env node

// Remote Project Manager for Claude Code
// Manages multiple repo branches with isolated Claude instances

import express from 'express';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import crypto from 'crypto';
import os from 'os';
import GitHubAPI from './server/github.js';

const execAsync = promisify(exec);
const app = express();
app.use(express.json());
app.use(express.static('.'));

const PORT = 3005;
const PROJECTS_DIR = process.env.PROJECTS_DIR || '/workspace/projects';
const CLAUDE_BASE_PORT = 7700;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Store active projects
const projects = new Map();

// Store GitHub token and API instance
let githubToken = GITHUB_TOKEN || '';
let github = null;

// Initialize GitHub API if token is available
if (githubToken) {
  github = new GitHubAPI(githubToken);
  console.log('GitHub integration enabled');
}

// Settings file path
const SETTINGS_PATH = path.join(process.env.HOME || '.', '.pocketdev-settings.json');

// Load settings on startup
async function loadSettings() {
  try {
    const data = await fs.readFile(SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(data);
    if (settings.githubToken && !githubToken) {
      githubToken = settings.githubToken;
      github = new GitHubAPI(githubToken);
      console.log('GitHub token loaded from settings');
    }
  } catch (e) {
    // Settings file doesn't exist yet
  }
}

// Save settings
async function saveSettings(settings) {
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Load settings on startup
await loadSettings();

// Ensure projects directory exists
await fs.mkdir(PROJECTS_DIR, { recursive: true });

// Generate unique project ID
function generateProjectId() {
  return crypto.randomBytes(4).toString('hex');
}

// Git operations helper
async function gitCommand(projectPath, command) {
  try {
    // Set up environment with GitHub token if available
    const env = { ...process.env };
    if (githubToken) {
      env.GH_TOKEN = githubToken;
      env.GITHUB_TOKEN = githubToken;
    }
    
    const { stdout, stderr } = await execAsync(command, { 
      cwd: projectPath,
      env 
    });
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// Configure git credentials for a repository
async function configureGitCredentials(projectPath) {
  if (!githubToken) return;
  
  try {
    // Get the remote URL
    const { stdout: remoteUrl } = await execAsync('git remote get-url origin', { cwd: projectPath });
    
    if (remoteUrl.includes('github.com')) {
      // Configure git to use the token for this repository
      await execAsync(`git config credential.helper store`, { cwd: projectPath });
      
      // Create credentials file
      const credentialUrl = remoteUrl.trim()
        .replace('https://github.com/', `https://${githubToken}@github.com/`)
        .replace('git@github.com:', `https://${githubToken}@github.com/`)
        .replace('.git', '');
      
      // This will store the credentials for future use
      await execAsync(`echo "${credentialUrl}.git" | git credential-store store`, { cwd: projectPath });
    }
  } catch (error) {
    console.error('Failed to configure git credentials:', error);
  }
}

// Create new project from repo
app.post('/api/projects', async (req, res) => {
  const { repoUrl, branch = 'main', projectName } = req.body;
  
  const projectId = generateProjectId();
  const projectPath = path.join(PROJECTS_DIR, projectId);
  
  try {
    // Clone repository with authentication if GitHub token is available
    let cloneUrl = repoUrl;
    
    // If it's a GitHub URL and we have a token, add authentication
    if (githubToken && repoUrl.includes('github.com')) {
      // Convert HTTPS URL to include token
      if (repoUrl.startsWith('https://github.com/')) {
        cloneUrl = repoUrl.replace('https://github.com/', `https://${githubToken}@github.com/`);
      } else if (repoUrl.startsWith('git@github.com:')) {
        // Convert SSH URL to HTTPS with token
        const repoPath = repoUrl.replace('git@github.com:', '').replace('.git', '');
        cloneUrl = `https://${githubToken}@github.com/${repoPath}.git`;
      }
    }
    
    await execAsync(`git clone ${cloneUrl} ${projectPath}`);
    
    // Remove the token from the remote URL for security
    if (cloneUrl !== repoUrl) {
      await execAsync(`git remote set-url origin ${repoUrl}`, { cwd: projectPath });
    }
    
    // Checkout the base branch
    await execAsync(`git checkout ${branch}`, { cwd: projectPath });
    
    // Configure git credentials for push operations
    await configureGitCredentials(projectPath);
    
    const project = {
      id: projectId,
      name: projectName || path.basename(repoUrl, '.git'),
      repoUrl,
      baseBranch: branch,
      path: projectPath,
      tasks: [],
      status: 'active',
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    projects.set(projectId, project);
    
    res.json({
      success: true,
      project: {
        ...project,
        apiUrl: `http://${req.hostname}:${PORT}/api/projects/${projectId}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create a task (worktree) within a project
app.post('/api/projects/:projectId/tasks', async (req, res) => {
  const project = projects.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const { name, branch } = req.body;
  
  if (!name || !branch) {
    return res.status(400).json({ error: 'Task name and branch are required' });
  }
  
  const taskId = generateProjectId();
  
  try {
    // Create worktree for this task
    const worktreePath = path.join(PROJECTS_DIR, `${project.id}-task-${taskId}`);
    
    // Create worktree with the specified branch name
    await execAsync(`git worktree add -b ${branch} ${worktreePath} ${project.baseBranch}`, { 
      cwd: project.path 
    });
    
    // Configure git credentials for the worktree
    await configureGitCredentials(worktreePath);
    
    const task = {
      id: taskId,
      name: name,
      branch: branch,
      worktreePath: worktreePath,
      status: 'active',
      createdAt: new Date(),
      claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(worktreePath)}`
    };
    
    // Add task to project
    project.tasks.push(task);
    project.lastActivity = new Date();
    
    res.json({ success: true, task });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all projects
app.get('/api/projects', (req, res) => {
  const projectList = Array.from(projects.values());
  res.json(projectList);
});

// Get project details
app.get('/api/projects/:id', async (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  // Get current git status from main repo
  const status = await gitCommand(project.path, 'git status --porcelain');
  
  res.json({
    ...project,
    git: {
      status: status.output,
      hasChanges: status.output.trim().length > 0
    }
  });
});

// Get tasks for a project
app.get('/api/projects/:projectId/tasks', (req, res) => {
  const project = projects.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  res.json(project.tasks || []);
});

// Get task details
app.get('/api/projects/:projectId/tasks/:taskId', async (req, res) => {
  const project = projects.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const task = project.tasks.find(t => t.id === req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  // Get git status for this task's worktree
  const status = await gitCommand(task.worktreePath, 'git status --porcelain');
  const diff = await gitCommand(task.worktreePath, 'git diff --stat');
  
  res.json({
    ...task,
    git: {
      status: status.output,
      diff: diff.output,
      hasChanges: status.output.trim().length > 0
    }
  });
});

// Git operations on task
app.post('/api/projects/:projectId/tasks/:taskId/git', async (req, res) => {
  const project = projects.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const task = project.tasks.find(t => t.id === req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const { operation, message, files } = req.body;
  project.lastActivity = new Date();
  
  try {
    let result;
    
    switch (operation) {
      case 'status':
        result = await gitCommand(task.worktreePath, 'git status');
        break;
        
      case 'diff':
        result = await gitCommand(task.worktreePath, 'git diff');
        break;
        
      case 'add':
        const filesToAdd = files || '.';
        result = await gitCommand(task.worktreePath, `git add ${filesToAdd}`);
        break;
        
      case 'commit':
        if (!message) {
          return res.status(400).json({ error: 'Commit message required' });
        }
        result = await gitCommand(task.worktreePath, `git commit -m "${message}"`);
        break;
        
      case 'push':
        result = await gitCommand(task.worktreePath, `git push origin ${task.branch}`);
        break;
        
      case 'pr':
        // Create pull request using gh CLI if available
        const prTitle = message || `Updates from task: ${task.name}`;
        result = await gitCommand(task.worktreePath, 
          `gh pr create --title "${prTitle}" --body "Created by Claude Code - Task: ${task.name}" --base ${project.baseBranch}`
        );
        break;
        
      default:
        return res.status(400).json({ error: 'Invalid operation' });
    }
    
    res.json({ success: result.success, output: result.output, error: result.error });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get Claude sessions for a task
app.get('/api/projects/:projectId/tasks/:taskId/sessions', async (req, res) => {
  const project = projects.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const task = project.tasks.find(t => t.id === req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  try {
    const realPath = path.resolve(task.worktreePath);
    
    // Encode path like Claude does
    const encodedPath = realPath.replace(/\//g, '-');
    const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', encodedPath);
    
    const sessions = [];
    
    if (fsSync.existsSync(claudeProjectDir)) {
      const files = fsSync.readdirSync(claudeProjectDir)
        .filter(f => f.endsWith('.jsonl'))
        .sort((a, b) => {
          const statA = fsSync.statSync(path.join(claudeProjectDir, a));
          const statB = fsSync.statSync(path.join(claudeProjectDir, b));
          return statB.mtime - statA.mtime;
        });
      
      for (const file of files) {
        const sessionId = file.replace('.jsonl', '');
        const filePath = path.join(claudeProjectDir, file);
        const stats = fsSync.statSync(filePath);
        
        // Count lines (approximate message count)
        const content = fsSync.readFileSync(filePath, 'utf8');
        const lines = content.trim().split('\n').length;
        
        // Try to get last message timestamp
        let lastActivity = stats.mtime;
        try {
          const lastLine = content.trim().split('\n').pop();
          const lastEntry = JSON.parse(lastLine);
          if (lastEntry.timestamp) {
            lastActivity = new Date(lastEntry.timestamp);
          }
        } catch (e) {
          // Use file mtime if we can't parse
        }
        
        // Try to extract analytics from the session
        let analytics = {
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCacheCreated: 0,
          totalCacheRead: 0,
          toolUsage: {},
          errors: 0,
          model: null
        };
        
        try {
          const lines = content.trim().split('\n');
          for (const line of lines) {
            try {
              const entry = JSON.parse(line);
              
              // Track token usage
              if (entry.message && entry.message.usage) {
                const usage = entry.message.usage;
                analytics.totalInputTokens += usage.input_tokens || 0;
                analytics.totalOutputTokens += usage.output_tokens || 0;
                analytics.totalCacheCreated += usage.cache_creation_input_tokens || 0;
                analytics.totalCacheRead += usage.cache_read_input_tokens || 0;
                
                // Get model name
                if (!analytics.model && entry.message.model) {
                  analytics.model = entry.message.model;
                }
              }
              
              // Track tool usage
              if (entry.message && entry.message.content && Array.isArray(entry.message.content)) {
                for (const content of entry.message.content) {
                  if (content.name) {
                    analytics.toolUsage[content.name] = (analytics.toolUsage[content.name] || 0) + 1;
                  }
                }
              }
              
              // Count errors
              if (entry.isApiErrorMessage) {
                analytics.errors++;
              }
            } catch (e) {
              // Skip malformed lines
            }
          }
        } catch (e) {
          console.error('Error analyzing session:', e);
        }
        
        sessions.push({
          sessionId,
          created: stats.birthtime,
          modified: stats.mtime,
          lastActivity,
          messageCount: lines,
          size: stats.size,
          sizeFormatted: formatBytes(stats.size),
          isActive: sessions.length === 0, // First (most recent) is active
          analytics
        });
      }
    }
    
    res.json({
      success: true,
      sessions,
      worktreePath: task.worktreePath
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: error.message });
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Check git status before deletion
app.get('/api/projects/:projectId/tasks/:taskId/check-delete', async (req, res) => {
  const project = projects.get(req.params.projectId);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const task = project.tasks.find(t => t.id === req.params.taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  try {
    // Check for uncommitted changes
    const status = await gitCommand(task.worktreePath, 'git status --porcelain');
    const hasUncommittedChanges = status.output.trim().length > 0;
    
    // Check for unpushed commits
    let hasUnpushedCommits = false;
    try {
      const unpushed = await gitCommand(task.worktreePath, `git log origin/${task.branch}..${task.branch} --oneline`);
      hasUnpushedCommits = unpushed.output.trim().length > 0;
    } catch (e) {
      // Branch might not exist on remote yet
      hasUnpushedCommits = true;
    }
    
    // Get diff summary if changes exist
    let diffSummary = '';
    if (hasUncommittedChanges) {
      const diff = await gitCommand(task.worktreePath, 'git diff --stat');
      diffSummary = diff.output;
    }
    
    res.json({
      canDelete: !hasUncommittedChanges && !hasUnpushedCommits,
      hasUncommittedChanges,
      hasUnpushedCommits,
      diffSummary,
      warnings: []
        .concat(hasUncommittedChanges ? ['Task has uncommitted changes that will be lost'] : [])
        .concat(hasUnpushedCommits ? ['Task has commits that have not been pushed to remote'] : [])
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a task (with soft delete option)
app.delete('/api/projects/:projectId/tasks/:taskId', async (req, res) => {
  const { force = false, softDelete = true } = req.query;
  const project = projects.get(req.params.projectId);
  
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  const taskIndex = project.tasks.findIndex(t => t.id === req.params.taskId);
  if (taskIndex === -1) {
    return res.status(404).json({ error: 'Task not found' });
  }
  
  const task = project.tasks[taskIndex];
  
  try {
    if (softDelete && !force) {
      // Soft delete - just mark as deleted
      task.deletedAt = new Date();
      task.status = 'deleted';
      
      // Move worktree to archived location
      const archivePath = path.join(PROJECTS_DIR, '.archived', `${project.id}-task-${task.id}-${Date.now()}`);
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      await execAsync(`mv "${task.worktreePath}" "${archivePath}"`, { cwd: project.path });
      
      // Update task with archive info
      task.archivedPath = archivePath;
      task.worktreePath = archivePath;
      
      res.json({ 
        success: true, 
        softDeleted: true,
        message: 'Task archived. Can be restored within 30 days.' 
      });
    } else {
      // Hard delete - permanently remove
      await execAsync(`git worktree remove --force ${task.worktreePath}`, { cwd: project.path });
      
      // Remove task from project
      project.tasks.splice(taskIndex, 1);
      project.lastActivity = new Date();
      
      res.json({ success: true, hardDeleted: true });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List archived/deleted items
app.get('/api/archived', async (req, res) => {
  const archivePath = path.join(PROJECTS_DIR, '.archived');
  const archived = [];
  
  try {
    await fs.mkdir(archivePath, { recursive: true });
    const entries = await fs.readdir(archivePath);
    
    for (const entry of entries) {
      const fullPath = path.join(archivePath, entry);
      const stats = await fs.stat(fullPath);
      
      // Parse archived item info from directory name
      const match = entry.match(/^(.+)-task-(.+)-(\d+)$/);
      if (match) {
        const [_, projectId, taskId, timestamp] = match;
        archived.push({
          type: 'task',
          projectId,
          taskId,
          path: fullPath,
          archivedAt: new Date(parseInt(timestamp)),
          size: await getDirectorySize(fullPath),
          daysOld: Math.floor((Date.now() - parseInt(timestamp)) / (1000 * 60 * 60 * 24))
        });
      }
    }
    
    res.json({
      archived: archived.sort((a, b) => b.archivedAt - a.archivedAt),
      totalSize: archived.reduce((sum, item) => sum + item.size, 0)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup old archived items
app.post('/api/cleanup', async (req, res) => {
  const { daysOld = 30, dryRun = true } = req.body;
  const archivePath = path.join(PROJECTS_DIR, '.archived');
  const cleaned = [];
  let totalFreed = 0;
  
  try {
    const entries = await fs.readdir(archivePath);
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    
    for (const entry of entries) {
      const fullPath = path.join(archivePath, entry);
      const match = entry.match(/-(\d+)$/);
      
      if (match) {
        const timestamp = parseInt(match[1]);
        if (timestamp < cutoffTime) {
          const size = await getDirectorySize(fullPath);
          
          if (!dryRun) {
            await execAsync(`rm -rf "${fullPath}"`);
          }
          
          cleaned.push({
            path: entry,
            size,
            archivedAt: new Date(timestamp)
          });
          totalFreed += size;
        }
      }
    }
    
    res.json({
      success: true,
      dryRun,
      cleaned: cleaned.length,
      totalFreed,
      items: cleaned
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper to get directory size
async function getDirectorySize(dirPath) {
  try {
    const result = await execAsync(`du -sb "${dirPath}" | cut -f1`);
    return parseInt(result.stdout.trim()) || 0;
  } catch {
    return 0;
  }
}

// Stop and cleanup project
app.delete('/api/projects/:id', async (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }
  
  try {
    // Remove all task worktrees first
    for (const task of project.tasks) {
      try {
        await execAsync(`git worktree remove ${task.worktreePath}`, { cwd: project.path });
      } catch (e) {
        // Ignore errors, worktree might already be gone
      }
    }
    
    // Optional: cleanup main repo
    if (req.body.cleanup) {
      await execAsync(`rm -rf ${project.path}`);
    }
    
    projects.delete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Settings endpoints
app.get('/api/settings', async (req, res) => {
  res.json({
    githubToken: githubToken ? '***' + githubToken.slice(-4) : '',
    hasToken: !!githubToken
  });
});

app.post('/api/settings', async (req, res) => {
  const { githubToken: newToken } = req.body;
  
  if (newToken) {
    // Test the token first
    const testApi = new GitHubAPI(newToken);
    try {
      const validation = await testApi.validateToken();
      if (validation.valid) {
        githubToken = newToken;
        github = testApi;
        await saveSettings({ githubToken });
        res.json({ 
          success: true, 
          username: validation.username,
          message: 'GitHub token saved successfully' 
        });
      } else {
        res.status(400).json({ success: false, error: 'Invalid token' });
      }
    } catch (error) {
      res.status(400).json({ success: false, error: error.message });
    }
  } else {
    res.status(400).json({ success: false, error: 'Token required' });
  }
});

// GitHub endpoints
app.get('/api/github/status', async (req, res) => {
  if (!github) {
    return res.json({ enabled: false });
  }
  
  try {
    const validation = await github.validateToken();
    res.json({ 
      enabled: true, 
      valid: validation.valid,
      username: validation.username 
    });
  } catch (error) {
    res.json({ enabled: true, valid: false, error: error.message });
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

app.get('/api/github/repos/:owner/:repo/branches', async (req, res) => {
  if (!github) {
    return res.status(400).json({ error: 'GitHub token not configured' });
  }
  
  try {
    const branches = await github.getBranches(req.params.owner, req.params.repo);
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    activeProjects: projects.size,
    uptime: process.uptime(),
    githubEnabled: !!github
  });
});

// Restore projects from existing directories
app.post('/api/projects/restore', async (req, res) => {
  const { projects: restoredProjects } = req.body;
  
  if (!restoredProjects || !Array.isArray(restoredProjects)) {
    return res.status(400).json({ error: 'Invalid projects data' });
  }
  
  let projectsRestored = 0;
  let tasksRestored = 0;
  
  for (const projectData of restoredProjects) {
    // Restore project to memory
    const project = {
      id: projectData.id,
      name: projectData.name,
      repoUrl: projectData.repoUrl,
      baseBranch: projectData.baseBranch,
      path: projectData.path,
      createdAt: new Date(projectData.createdAt),
      lastActivity: new Date(),
      tasks: []
    };
    
    // Restore tasks
    if (projectData.tasks && Array.isArray(projectData.tasks)) {
      for (const taskData of projectData.tasks) {
        const task = {
          id: taskData.id,
          name: taskData.name,
          branch: taskData.branch,
          worktreePath: taskData.worktreePath,
          status: 'active',
          createdAt: new Date(taskData.createdAt),
          claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(taskData.worktreePath)}`
        };
        project.tasks.push(task);
        tasksRestored++;
      }
    }
    
    projects.set(project.id, project);
    projectsRestored++;
  }
  
  console.log(`✅ Restored ${projectsRestored} projects with ${tasksRestored} tasks`);
  
  res.json({
    success: true,
    projectsRestored,
    tasksRestored
  });
});

app.listen(PORT, () => {
  console.log(`Project Manager API running on port ${PORT}`);
  console.log(`Projects directory: ${PROJECTS_DIR}`);
});

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  process.exit();
});