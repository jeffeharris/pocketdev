#!/usr/bin/env node

// Remote Project Manager for Claude Code with SQLite Persistence
// Manages multiple repo branches with isolated Claude instances

import express from 'express';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import fsSync from 'fs';
import crypto from 'crypto';
import os from 'os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import GitHubAPI from './github.js';
import { getDatabase } from './db/index.js';
import Models from './db/models/index.js';
import multer from 'multer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const execAsync = promisify(exec);
const app = express();
app.use(express.json());

// Serve frontend files directly at root
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

const PORT = process.env.PORT || 3005;
const PROJECTS_DIR = process.env.PROJECTS_DIR || path.join(__dirname, '../projects');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Database and models
let db = null;
let models = null;

// GitHub API instance
let githubToken = GITHUB_TOKEN || '';
let github = null;

// Initialize GitHub API if token is available
if (githubToken) {
  github = new GitHubAPI(githubToken);
  console.log('GitHub integration enabled');
}

// Settings file path (for GitHub token)
const SETTINGS_PATH = path.join(process.env.HOME || '.', '.pocketdev-settings.json');

// Initialize database and models
async function initializeDatabase() {
  db = await getDatabase();
  models = new Models(db);
  console.log('Database initialized');
  
  // Run cleanup on startup
  await cleanupOrphanedWorktrees();
}

// Cleanup orphaned worktrees on startup
async function cleanupOrphanedWorktrees() {
  try {
    console.log('Checking for orphaned worktrees...');
    const orphans = await models.getOrphanedWorktrees();
    
    if (orphans.length > 0) {
      console.log(`Found ${orphans.length} orphaned worktrees`);
      for (const orphan of orphans) {
        if (fsSync.existsSync(orphan.path)) {
          console.log(`  - ${orphan.path} (${orphan.orphan_reason})`);
        }
      }
    }
  } catch (error) {
    console.error('Error during cleanup check:', error);
  }
}

// Load settings on startup
async function loadSettings() {
  try {
    // First check database
    const dbToken = await models.getSetting('github_token');
    if (dbToken && !githubToken) {
      githubToken = dbToken;
      github = new GitHubAPI(githubToken);
      console.log('GitHub token loaded from database');
      return;
    }
    
    // Fall back to file
    const data = await fs.readFile(SETTINGS_PATH, 'utf8');
    const settings = JSON.parse(data);
    if (settings.githubToken && !githubToken) {
      githubToken = settings.githubToken;
      github = new GitHubAPI(githubToken);
      // Save to database
      await models.setSetting('github_token', githubToken);
      console.log('GitHub token loaded from settings file and saved to database');
    }
  } catch (e) {
    // Settings don't exist yet
  }
}

// Save settings
async function saveSettings(settings) {
  // Save to database
  if (settings.githubToken) {
    await models.setSetting('github_token', settings.githubToken);
  }
  // Also save to file for backward compatibility
  await fs.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

// Ensure projects directory exists
async function ensureProjectsDir() {
  await fs.mkdir(PROJECTS_DIR, { recursive: true });
}

// Git operations helper
async function gitCommand(projectPath, command) {
  try {
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
    const { stdout: remoteUrl } = await execAsync('git remote get-url origin', { cwd: projectPath });
    
    if (remoteUrl.includes('github.com')) {
      // Configure git to use GitHub CLI as credential helper
      await execAsync(`git config credential.helper "!gh auth git-credential"`, { cwd: projectPath });
      
      // Make sure GH_TOKEN is set for the environment
      process.env.GH_TOKEN = githubToken;
      process.env.GITHUB_TOKEN = githubToken;
    }
  } catch (error) {
    console.error('Failed to configure git credentials:', error);
  }
}

// Create new project from repo
app.post('/api/projects', async (req, res) => {
  const { repoUrl, branch = 'main', projectName } = req.body;
  
  try {
    // Check if project already exists
    const existing = await models.projects.findByRepoUrl(repoUrl);
    if (existing) {
      return res.status(400).json({ 
        error: 'Project already exists', 
        project: existing 
      });
    }
    
    const projectId = models.projects.generateId();
    const projectPath = path.join(PROJECTS_DIR, projectId);
    
    // Clone repository with authentication if GitHub token is available
    let cloneUrl = repoUrl;
    
    if (githubToken && repoUrl.includes('github.com')) {
      if (repoUrl.startsWith('https://github.com/')) {
        cloneUrl = repoUrl.replace('https://github.com/', `https://${githubToken}@github.com/`);
      } else if (repoUrl.startsWith('git@github.com:')) {
        const repoPath = repoUrl.replace('git@github.com:', '').replace('.git', '');
        cloneUrl = `https://${githubToken}@github.com/${repoPath}.git`;
      }
    }
    
    await execAsync(`git clone ${cloneUrl} ${projectPath}`);
    
    if (cloneUrl !== repoUrl) {
      await execAsync(`git remote set-url origin ${repoUrl}`, { cwd: projectPath });
    }
    
    await execAsync(`git checkout ${branch}`, { cwd: projectPath });
    await configureGitCredentials(projectPath);
    
    // Create project in database
    const project = await models.projects.create({
      id: projectId,
      name: projectName || path.basename(repoUrl, '.git'),
      repoUrl,
      baseBranch: branch,
      localPath: projectPath
    });
    
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
  const { name, branch } = req.body;
  
  if (!name || !branch) {
    return res.status(400).json({ error: 'Task name and branch are required' });
  }
  
  try {
    const project = await models.projects.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const taskId = models.tasks.generateId();
    const worktreePath = path.join(PROJECTS_DIR, `${project.id}-task-${taskId}`);
    
    // Create worktree
    await execAsync(`git worktree add -b ${branch} ${worktreePath} ${project.base_branch}`, { 
      cwd: project.local_path 
    });
    
    await configureGitCredentials(worktreePath);
    
    // Create task in database
    const task = await models.tasks.create(project.id, {
      id: taskId,
      name,
      branch,
      worktree_path: worktreePath
    });
    
    // Update project last accessed
    await models.projects.updateLastAccessed(project.id);
    
    res.json({ 
      success: true, 
      task: {
        ...task,
        claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(worktreePath)}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all projects
app.get('/api/projects', async (req, res) => {
  try {
    const projects = await models.projects.findAll();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project details
app.get('/api/projects/:id', async (req, res) => {
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get current git status if local path exists
    let gitStatus = null;
    if (project.local_path && fsSync.existsSync(project.local_path)) {
      const status = await gitCommand(project.local_path, 'git status --porcelain');
      gitStatus = {
        status: status.output,
        hasChanges: status.output.trim().length > 0
      };
    }
    
    res.json({
      ...project,
      git: gitStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get tasks for a project
app.get('/api/projects/:projectId/tasks', async (req, res) => {
  try {
    const tasks = await models.tasks.findByProjectId(req.params.projectId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get task details
app.get('/api/projects/:projectId/tasks/:taskId', async (req, res) => {
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Verify task belongs to project
    if (task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found in this project' });
    }
    
    // Get git status for this task's worktree
    let gitInfo = null;
    if (fsSync.existsSync(task.worktree_path)) {
      const status = await gitCommand(task.worktree_path, 'git status --porcelain');
      const diff = await gitCommand(task.worktree_path, 'git diff --stat');
      
      gitInfo = {
        status: status.output,
        diff: diff.output,
        hasChanges: status.output.trim().length > 0
      };
      
      // Update task if uncommitted changes status changed
      if (gitInfo.hasChanges !== task.has_uncommitted_changes) {
        await models.tasks.update(task.id, {
          has_uncommitted_changes: gitInfo.hasChanges
        });
      }
    }
    
    res.json({
      ...task,
      git: gitInfo,
      claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(task.worktree_path)}`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Git operations on task
app.post('/api/projects/:projectId/tasks/:taskId/git', async (req, res) => {
  const { operation, message, files } = req.body;
  
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    await models.projects.updateLastAccessed(req.params.projectId);
    
    let result;
    
    switch (operation) {
      case 'status':
        result = await gitCommand(task.worktree_path, 'git status');
        break;
        
      case 'diff':
        result = await gitCommand(task.worktree_path, 'git diff');
        break;
        
      case 'add':
        const filesToAdd = files || '.';
        result = await gitCommand(task.worktree_path, `git add ${filesToAdd}`);
        break;
        
      case 'commit':
        if (!message) {
          return res.status(400).json({ error: 'Commit message required' });
        }
        result = await gitCommand(task.worktree_path, `git commit -m "${message}"`);
        break;
        
      case 'push':
        result = await gitCommand(task.worktree_path, `git push origin ${task.branch}`);
        break;
        
      case 'pr':
        const prTitle = message || `Updates from task: ${task.name}`;
        const project = await models.projects.findById(task.project_id);
        result = await gitCommand(task.worktree_path, 
          `gh pr create --title "${prTitle}" --body "Created by Claude Code - Task: ${task.name}" --base ${project.base_branch}`
        );
        break;
        
      case 'log':
        const logArgs = req.body.args || '--oneline -n 10';
        result = await gitCommand(task.worktree_path, `git log ${logArgs}`);
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
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Get sessions from database
    const dbSessions = await models.sessions.findByTaskId(task.id);
    
    // Also scan filesystem for any untracked sessions
    // Claude sessions in containers use the /projects path
    const worktreePath = task.worktree_path.startsWith('/') ? 
      task.worktree_path : 
      `/projects/${path.basename(task.worktree_path)}`;
    const encodedPath = worktreePath.replace(/\//g, '-');
    const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', encodedPath);
    
    const sessions = [];
    const ttydApiUrl = process.env.TTYD_SESSION_API_URL || 'http://claude-ttyd-server:3006';
    
    try {
      // First, try to get sessions from ttyd API
      console.log(`Fetching sessions from ttyd API: ${ttydApiUrl}/api/sessions/${encodedPath}`);
      const sessionsResponse = await fetch(`${ttydApiUrl}/api/sessions/${encodedPath}`);
      const sessionsData = await sessionsResponse.json();
      
      if (sessionsData.success && sessionsData.sessions.length > 0) {
        // Fetch detailed analytics for each session
        for (const sessionInfo of sessionsData.sessions) {
          const sessionId = sessionInfo.sessionId;
          
          // Check if we have this session in the database
          let dbSession = dbSessions.find(s => s.session_id === sessionId);
          
          // Get detailed session analytics from API
          const detailResponse = await fetch(`${ttydApiUrl}/api/sessions/${encodedPath}/${sessionId}`);
          const detailData = await detailResponse.json();
          
          if (detailData.success) {
            const sessionData = detailData.session;
            const analytics = sessionData.analytics;
            
            // Update or create session in database
            if (!dbSession) {
              dbSession = await models.sessions.create(task.id, {
                sessionId,
                messageCount: sessionData.lineCount,
                sizeBytes: sessionData.sizeBytes,
                tokenUsage: {
                  totalInputTokens: analytics.inputTokens,
                  totalOutputTokens: analytics.outputTokens,
                  totalCacheCreated: analytics.cacheCreationInputTokens,
                  totalCacheRead: analytics.cacheReadInputTokens
                },
                toolUsage: analytics.toolUsage,
                model: analytics.model,
                errorCount: analytics.errors,
                createdAt: sessionData.createdAt,
                lastActivity: sessionData.modifiedAt,
                isActive: sessions.length === 0 // First is active
              });
            } else {
              // Update existing session
              await models.sessions.update(dbSession.id, {
                messageCount: sessionData.lineCount,
                sizeBytes: sessionData.sizeBytes,
                tokenUsage: {
                  totalInputTokens: analytics.inputTokens,
                  totalOutputTokens: analytics.outputTokens,
                  totalCacheCreated: analytics.cacheCreationInputTokens,
                  totalCacheRead: analytics.cacheReadInputTokens
                },
                toolUsage: analytics.toolUsage,
                model: analytics.model,
                errorCount: analytics.errors,
                lastActivity: sessionData.modifiedAt
              });
            }
            
            sessions.push({
              sessionId,
              created: sessionData.createdAt,
              modified: sessionData.modifiedAt,
              lastActivity: sessionData.modifiedAt,
              messageCount: sessionData.lineCount,
              size: sessionData.sizeBytes,
              sizeFormatted: formatBytes(sessionData.sizeBytes),
              isActive: sessions.length === 0,
              analytics: {
                totalInputTokens: analytics.inputTokens,
                totalOutputTokens: analytics.outputTokens,
                totalCacheCreated: analytics.cacheCreationInputTokens,
                totalCacheRead: analytics.cacheReadInputTokens,
                toolUsage: analytics.toolUsage,
                errors: analytics.errors,
                model: analytics.model
              }
            });
          }
        }
      }
    } catch (apiError) {
      console.error('Error fetching from ttyd API, falling back to local filesystem:', apiError);
      
      // Fallback to local filesystem if API fails
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
          
          // Check if we have this session in the database
          let dbSession = dbSessions.find(s => s.session_id === sessionId);
          
          // Parse session file for analytics
          const content = fsSync.readFileSync(filePath, 'utf8');
          const lines = content.trim().split('\n').length;
          
          let analytics = {
            totalInputTokens: 0,
            totalOutputTokens: 0,
            totalCacheCreated: 0,
            totalCacheRead: 0,
            toolUsage: {},
            errors: 0,
            model: null
          };
          
          // Parse analytics
          try {
            const lineArray = content.trim().split('\n');
            for (const line of lineArray) {
              try {
                const entry = JSON.parse(line);
                
                if (entry.message && entry.message.usage) {
                  const usage = entry.message.usage;
                  analytics.totalInputTokens += usage.input_tokens || 0;
                  analytics.totalOutputTokens += usage.output_tokens || 0;
                  analytics.totalCacheCreated += usage.cache_creation_input_tokens || 0;
                  analytics.totalCacheRead += usage.cache_read_input_tokens || 0;
                  
                  if (!analytics.model && entry.message.model) {
                    analytics.model = entry.message.model;
                  }
                }
                
                if (entry.message && entry.message.content && Array.isArray(entry.message.content)) {
                  for (const content of entry.message.content) {
                    if (content.name) {
                      analytics.toolUsage[content.name] = (analytics.toolUsage[content.name] || 0) + 1;
                    }
                  }
                }
                
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
          
          // Update or create session in database
          if (!dbSession) {
            dbSession = await models.sessions.create(task.id, {
              sessionId,
              messageCount: lines,
              sizeBytes: stats.size,
              tokenUsage: analytics,
              toolUsage: analytics.toolUsage,
              model: analytics.model,
              errorCount: analytics.errors,
              createdAt: stats.birthtime,
              lastActivity: stats.mtime,
              isActive: sessions.length === 0 // First is active
            });
          } else {
            // Update existing session
            await models.sessions.update(dbSession.id, {
              messageCount: lines,
              sizeBytes: stats.size,
              tokenUsage: analytics,
              toolUsage: analytics.toolUsage,
              model: analytics.model,
              errorCount: analytics.errors,
              lastActivity: stats.mtime
            });
          }
          
          sessions.push({
            sessionId,
            created: stats.birthtime,
            modified: stats.mtime,
            lastActivity: stats.mtime,
            messageCount: lines,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            isActive: sessions.length === 0,
            analytics
          });
        }
      }
    }
    
    res.json({
      success: true,
      sessions,
      worktreePath: worktreePath,
      claudeProjectDir,
      debugInfo: {
        originalPath: task.worktree_path,
        encodedPath,
        dirExists: fsSync.existsSync(claudeProjectDir)
      }
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

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { projectId, taskId } = req.params;
    const task = await models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      return cb(new Error('Task not found'));
    }
    
    // Create .pocketdev/tmp/images directory
    const uploadDir = path.join(task.worktree_path, '.pocketdev', 'tmp', 'images');
    await fs.mkdir(uploadDir, { recursive: true });
    
    // Ensure .gitignore includes .pocketdev/tmp
    const gitignorePath = path.join(task.worktree_path, '.gitignore');
    try {
      const gitignoreContent = await fs.readFile(gitignorePath, 'utf8');
      if (!gitignoreContent.includes('.pocketdev/tmp/')) {
        await fs.appendFile(gitignorePath, '\n# PocketDev temporary files\n.pocketdev/tmp/\n');
      }
    } catch (e) {
      // Create .gitignore if it doesn't exist
      await fs.writeFile(gitignorePath, '# PocketDev temporary files\n.pocketdev/tmp/\n');
    }
    
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename and add timestamp
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9-_]/g, '-')
      .substring(0, 50);
    const timestamp = Date.now();
    cb(null, `${name}-${timestamp}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept only image files
    const allowedTypes = /jpeg|jpg|png|gif|webp|svg/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Upload image to task
app.post('/api/projects/:projectId/tasks/:taskId/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const task = await models.tasks.findById(req.params.taskId);
    await models.projects.updateLastAccessed(req.params.projectId);
    
    res.json({
      success: true,
      filename: req.file.filename,
      size: req.file.size,
      path: `.pocketdev/tmp/images/${req.file.filename}`,
      referencePath: `@.pocketdev/tmp/images/${req.file.filename}`
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// List images in task
app.get('/api/projects/:projectId/tasks/:taskId/images', async (req, res) => {
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const imagesDir = path.join(task.worktree_path, '.pocketdev', 'tmp', 'images');
    
    // Check if directory exists
    try {
      await fs.access(imagesDir);
    } catch (e) {
      return res.json({ images: [] });
    }
    
    const files = await fs.readdir(imagesDir);
    const images = await Promise.all(
      files
        .filter(file => /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file))
        .map(async (filename) => {
          const filePath = path.join(imagesDir, filename);
          const stats = await fs.stat(filePath);
          return {
            filename,
            size: stats.size,
            sizeFormatted: formatBytes(stats.size),
            created: stats.mtime,
            path: `.pocketdev/tmp/images/${filename}`,
            referencePath: `@.pocketdev/tmp/images/${filename}`
          };
        })
    );
    
    // Sort by creation date, newest first
    images.sort((a, b) => b.created - a.created);
    
    res.json({ images });
  } catch (error) {
    console.error('Error listing images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve image file
app.get('/api/projects/:projectId/tasks/:taskId/images/:filename', async (req, res) => {
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const imagePath = path.join(task.worktree_path, '.pocketdev', 'tmp', 'images', req.params.filename);
    
    // Check if file exists
    await fs.access(imagePath);
    
    // Send the file
    res.sendFile(imagePath);
  } catch (error) {
    res.status(404).json({ error: 'Image not found' });
  }
});

// Delete image
app.delete('/api/projects/:projectId/tasks/:taskId/images/:filename', async (req, res) => {
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const imagePath = path.join(task.worktree_path, '.pocketdev', 'tmp', 'images', req.params.filename);
    
    await fs.unlink(imagePath);
    await models.projects.updateLastAccessed(req.params.projectId);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check git status before deletion
app.get('/api/projects/:projectId/tasks/:taskId/check-delete', async (req, res) => {
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    // Check for uncommitted changes
    const status = await gitCommand(task.worktree_path, 'git status --porcelain');
    const hasUncommittedChanges = status.output.trim().length > 0;
    
    // Check for unpushed commits
    let hasUnpushedCommits = false;
    try {
      const unpushed = await gitCommand(task.worktree_path, `git log origin/${task.branch}..${task.branch} --oneline`);
      hasUnpushedCommits = unpushed.output.trim().length > 0;
    } catch (e) {
      hasUnpushedCommits = true;
    }
    
    // Get diff summary if changes exist
    let diffSummary = '';
    if (hasUncommittedChanges) {
      const diff = await gitCommand(task.worktree_path, 'git diff --stat');
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

// Delete a task
app.delete('/api/projects/:projectId/tasks/:taskId', async (req, res) => {
  const { force = false, softDelete = true } = req.query;
  
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const project = await models.projects.findById(task.project_id);
    
    if (softDelete && !force) {
      // Soft delete - archive the task
      await models.tasks.archive(task.id);
      
      // Move worktree to archived location
      const archivePath = path.join(PROJECTS_DIR, '.archived', `${project.id}-task-${task.id}-${Date.now()}`);
      await fs.mkdir(path.dirname(archivePath), { recursive: true });
      await execAsync(`mv "${task.worktree_path}" "${archivePath}"`, { cwd: project.local_path });
      
      res.json({ 
        success: true, 
        softDeleted: true,
        message: 'Task archived. Can be restored within 30 days.' 
      });
    } else {
      // Hard delete
      await execAsync(`git worktree remove --force ${task.worktree_path}`, { cwd: project.local_path });
      await models.tasks.delete(task.id);
      
      res.json({ success: true, hardDeleted: true });
    }
    
    await models.projects.updateLastAccessed(project.id);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List orphaned worktrees
app.get('/api/orphaned-worktrees', async (req, res) => {
  try {
    const orphans = await models.getOrphanedWorktrees();
    
    // Get size for each orphan
    const orphansWithSize = [];
    for (const orphan of orphans) {
      if (fsSync.existsSync(orphan.path)) {
        const size = await getDirectorySize(orphan.path);
        orphansWithSize.push({
          ...orphan,
          size,
          sizeFormatted: formatBytes(size),
          exists: true
        });
      } else {
        orphansWithSize.push({
          ...orphan,
          size: 0,
          sizeFormatted: '0 B',
          exists: false
        });
      }
    }
    
    res.json({
      orphans: orphansWithSize,
      totalSize: orphansWithSize.reduce((sum, o) => sum + o.size, 0),
      count: orphansWithSize.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup orphaned worktrees
app.post('/api/cleanup', async (req, res) => {
  const { paths, dryRun = true } = req.body;
  
  try {
    const cleaned = [];
    let totalFreed = 0;
    
    // If no paths specified, get all orphans
    const targetPaths = paths || (await models.getOrphanedWorktrees()).map(o => o.path);
    
    for (const worktreePath of targetPaths) {
      if (fsSync.existsSync(worktreePath)) {
        const size = await getDirectorySize(worktreePath);
        
        if (!dryRun) {
          await execAsync(`rm -rf "${worktreePath}"`);
          await models.removeWorktreeRegistration(worktreePath);
        }
        
        cleaned.push({
          path: worktreePath,
          size,
          sizeFormatted: formatBytes(size)
        });
        totalFreed += size;
      }
    }
    
    res.json({
      success: true,
      dryRun,
      cleaned: cleaned.length,
      totalFreed,
      totalFreedFormatted: formatBytes(totalFreed),
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

// Get base branch sync status
app.get('/api/projects/:id/base-branch-status', async (req, res) => {
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fsSync.existsSync(project.local_path)) {
      return res.json({ behind: 0, ahead: 0, error: 'Project directory not found' });
    }
    
    try {
      // Check if base branch is behind its remote
      const behindResult = await gitCommand(project.local_path, 
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`);
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      // Check if base branch has unpushed commits
      const aheadResult = await gitCommand(project.local_path, 
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`);
      const ahead = parseInt(aheadResult.output.trim()) || 0;
      
      res.json({ behind, ahead, branch: project.base_branch });
    } catch (error) {
      // Remote might not be set up or branch might not exist
      res.json({ behind: 0, ahead: 0, error: error.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pull base branch updates
app.post('/api/projects/:id/pull-base-branch', async (req, res) => {
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await configureGitCredentials(project.local_path);
    
    // Check for uncommitted changes in base branch
    const statusResult = await gitCommand(project.local_path, 'git status --porcelain');
    if (statusResult.output && statusResult.output.trim()) {
      return res.status(400).json({ 
        error: 'Cannot pull: Base branch has uncommitted changes',
        hasUncommitted: true 
      });
    }
    
    // Pull updates for base branch
    const result = await gitCommand(project.local_path, 
      `git pull origin ${project.base_branch}`);
    
    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Pull failed',
        output: result.output 
      });
    }
    
    await models.projects.updateLastAccessed(project.id);
    
    res.json({ 
      success: true, 
      output: result.output,
      message: `Successfully pulled updates to ${project.base_branch}`
    });
  } catch (error) {
    console.error('Pull error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Push base branch changes
app.post('/api/projects/:id/push-base-branch', async (req, res) => {
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await configureGitCredentials(project.local_path);
    
    // Push base branch
    const result = await gitCommand(project.local_path, 
      `git push origin ${project.base_branch}`);
    
    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Push failed',
        output: result.output 
      });
    }
    
    await models.projects.updateLastAccessed(project.id);
    
    res.json({ 
      success: true, 
      output: result.output,
      message: `Successfully pushed ${project.base_branch} to origin`
    });
  } catch (error) {
    console.error('Push error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch remote updates for project
app.post('/api/projects/:id/fetch', async (req, res) => {
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await configureGitCredentials(project.local_path);
    
    // Fetch with git (will use gh credential helper if configured)
    const result = await gitCommand(project.local_path, 'git fetch --all --prune --tags');
    
    // Get updated branch info
    const branchResult = await gitCommand(project.local_path, 'git branch -r');
    const branches = branchResult.output
      .split('\n')
      .filter(b => b.trim())
      .map(b => b.trim().replace('origin/', ''));
    
    await models.projects.updateLastAccessed(project.id);
    
    res.json({ 
      success: result.success, 
      output: result.output,
      branches: branches
    });
  } catch (error) {
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check update status for all tasks
app.get('/api/projects/:id/update-status', async (req, res) => {
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const tasks = await models.tasks.findByProjectId(project.id);
    const updateStatus = [];
    
    for (const task of tasks) {
      if (!fsSync.existsSync(task.worktree_path)) continue;
      
      try {
        // Check if branch is behind origin/base_branch
        const behindResult = await gitCommand(task.worktree_path, 
          `git rev-list --count HEAD..origin/${project.base_branch}`);
        const behind = parseInt(behindResult.output.trim()) || 0;
        
        // Check if branch has unpushed commits
        const aheadResult = await gitCommand(task.worktree_path, 
          `git rev-list --count origin/${project.base_branch}..HEAD`);
        const ahead = parseInt(aheadResult.output.trim()) || 0;
        
        // Check for uncommitted changes
        const statusResult = await gitCommand(task.worktree_path, 'git status --porcelain');
        const hasUncommitted = statusResult.output.trim().length > 0;
        
        updateStatus.push({
          taskId: task.id,
          taskName: task.name,
          branch: task.branch,
          behind,
          ahead,
          hasUncommitted,
          needsUpdate: behind > 0
        });
      } catch (error) {
        // Task might not have tracking set up
        updateStatus.push({
          taskId: task.id,
          taskName: task.name,
          branch: task.branch,
          behind: 0,
          ahead: 0,
          hasUncommitted: false,
          needsUpdate: false,
          error: error.message
        });
      }
    }
    
    res.json({ updateStatus });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a task with remote changes
app.post('/api/projects/:projectId/tasks/:taskId/update', async (req, res) => {
  const { method = 'merge', withClaude = false } = req.body; // 'merge' or 'rebase', with or without Claude assistance
  
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const project = await models.projects.findById(task.project_id);
    
    // Check for uncommitted changes
    const statusResult = await gitCommand(task.worktree_path, 'git status --porcelain');
    if (statusResult.output.trim()) {
      return res.status(400).json({ 
        error: 'Cannot update: You have uncommitted changes',
        hasUncommitted: true,
        changes: statusResult.output
      });
    }
    
    if (withClaude) {
      // Create a special merge task that uses the same worktree
      const operation = method === 'rebase' ? 'rebase' : 'merge';
      const mergeTaskName = `${operation} ${project.base_branch} into ${task.name}`;
      const prompt = `Help me ${operation} the branch '${project.base_branch}' into this task branch '${task.branch}'. ` +
        `Please guide me through the process and help resolve any conflicts that may arise. ` +
        `Start by checking the current status and then perform the ${operation}.`;
      
      // Create a temporary merge task in the database
      const mergeTaskId = models.tasks.generateId();
      const mergeTask = await models.tasks.create(project.id, {
        id: mergeTaskId,
        name: mergeTaskName,
        branch: task.branch, // Same branch as original task
        worktree_path: task.worktree_path // Use the SAME worktree (use snake_case for DB field)
      });
      
      // Update metadata to mark this as a merge task
      await db.run(`
        UPDATE tasks 
        SET metadata = json_object('isMergeTask', true, 'parentTaskId', ?, 'operation', ?)
        WHERE id = ?
      `, [task.id, operation, mergeTaskId]);
      
      // Write prompt to a file in the worktree
      const promptFile = path.join(task.worktree_path, '.claude-prompt');
      await fs.writeFile(promptFile, prompt);
      
      // Return the merge task info so UI can open it
      res.json({ 
        success: true,
        claudeAssisted: true,
        mergeTask: {
          id: mergeTask.id,
          name: mergeTask.name,
          claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(task.worktree_path)}`
        },
        message: `Created merge task with Claude assistance`
      });
    } else {
      // Perform update directly
      let result;
      if (method === 'rebase') {
        result = await gitCommand(task.worktree_path, `git rebase origin/${project.base_branch}`);
      } else {
        result = await gitCommand(task.worktree_path, `git merge origin/${project.base_branch}`);
      }
      
      await models.projects.updateLastAccessed(project.id);
      
      res.json({ 
        success: result.success, 
        output: result.output,
        method
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Check merge conflicts for a task
app.post('/api/projects/:projectId/tasks/:taskId/check-merge-conflicts', async (req, res) => {
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const project = await models.projects.findById(task.project_id);
    
    // Save current branch state
    await gitCommand(task.worktree_path, 'git add -A');
    await gitCommand(task.worktree_path, 'git stash');
    
    try {
      // Attempt a dry-run merge to check for conflicts
      const mergeResult = await gitCommand(task.worktree_path, 
        `git merge --no-commit --no-ff origin/${project.base_branch}`);
      
      // Check if there are conflicts
      const statusResult = await gitCommand(task.worktree_path, 'git status --porcelain');
      const conflicts = statusResult.output
        .split('\n')
        .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
        .map(line => line.substring(3).trim());
      
      // Abort the merge
      await gitCommand(task.worktree_path, 'git merge --abort');
      
      res.json({
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts,
        canMerge: conflicts.length === 0
      });
    } finally {
      // Restore original state
      await gitCommand(task.worktree_path, 'git stash pop');
    }
  } catch (error) {
    // If stash pop fails, try to recover
    try {
      await gitCommand(task.worktree_path, 'git merge --abort');
      await gitCommand(task.worktree_path, 'git stash drop');
    } catch (e) {
      // Ignore cleanup errors
    }
    res.status(500).json({ error: error.message });
  }
});

// Merge task into base branch
app.post('/api/projects/:projectId/tasks/:taskId/merge-to-base', async (req, res) => {
  const { withClaude = false } = req.body;
  
  try {
    const task = await models.tasks.findById(req.params.taskId);
    if (!task || task.project_id !== req.params.projectId) {
      return res.status(404).json({ error: 'Task not found' });
    }
    
    const project = await models.projects.findById(task.project_id);
    
    if (withClaude) {
      // Create a merge task for Claude assistance
      const mergeTaskName = `merge ${task.branch} into ${project.base_branch}`;
      const mergeTaskId = models.tasks.generateId();
      
      // Switch to base branch in main repo
      await gitCommand(project.local_path, `git checkout ${project.base_branch}`);
      await gitCommand(project.local_path, `git pull origin ${project.base_branch}`);
      
      // Create a new branch for the merge
      const mergeBranch = `merge/${task.branch}-into-${project.base_branch}`.replace(/[^a-zA-Z0-9-]/g, '-');
      const mergeWorktreePath = path.join(PROJECTS_DIR, `${project.id}-merge-${mergeTaskId}`);
      
      // Create worktree from base branch
      await execAsync(`git worktree add -b ${mergeBranch} ${mergeWorktreePath} ${project.base_branch}`, {
        cwd: project.local_path
      });
      
      // Attempt merge in the new worktree
      const mergeResult = await gitCommand(mergeWorktreePath, `git merge origin/${task.branch}`);
      
      // Create merge task in database
      const mergeTask = await models.tasks.create(project.id, {
        id: mergeTaskId,
        name: mergeTaskName,
        branch: mergeBranch,
        worktree_path: mergeWorktreePath
      });
      
      // Add metadata to indicate this is a merge task
      await db.run(`
        UPDATE tasks 
        SET metadata = json_object(
          'isMergeTask', true, 
          'sourceBranch', ?, 
          'targetBranch', ?,
          'originalTaskId', ?
        )
        WHERE id = ?
      `, [task.branch, project.base_branch, task.id, mergeTaskId]);
      
      // Write instructions for Claude
      const promptFile = path.join(mergeWorktreePath, '.claude-prompt');
      const prompt = `Help me complete the merge of branch '${task.branch}' into '${project.base_branch}'.

There are merge conflicts that need to be resolved. Please:
1. Check the current git status to see conflicting files
2. Resolve all conflicts by choosing the appropriate changes
3. Make sure the code still works after merging
4. Commit the merge with an appropriate message

Original task: ${task.name}`;
      
      await fs.writeFile(promptFile, prompt);
      
      res.json({
        success: true,
        mergeTask: {
          id: mergeTask.id,
          name: mergeTask.name,
          branch: mergeTask.branch,
          claudeUrl: `http://${req.hostname}:7681/?arg=${encodeURIComponent(mergeWorktreePath)}`
        }
      });
      
    } else {
      // Direct merge without Claude
      // First ensure we're on the base branch and up to date
      await gitCommand(project.local_path, `git checkout ${project.base_branch}`);
      await gitCommand(project.local_path, `git pull origin ${project.base_branch}`);
      
      // Merge the task branch
      const mergeResult = await gitCommand(project.local_path, 
        `git merge origin/${task.branch} -m "Merge branch '${task.branch}' into ${project.base_branch}"`);
      
      if (!mergeResult.success) {
        return res.status(500).json({ 
          error: 'Merge failed', 
          details: mergeResult.error 
        });
      }
      
      // Update task status
      await models.tasks.update(task.id, { 
        status: 'merged',
        completed_at: new Date().toISOString()
      });
      
      // Update project last accessed
      await models.projects.updateLastAccessed(project.id);
      
      res.json({
        success: true,
        message: `Successfully merged ${task.branch} into ${project.base_branch}`,
        output: mergeResult.output
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete project
app.delete('/api/projects/:id', async (req, res) => {
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all tasks
    const tasks = await models.tasks.findByProjectId(project.id, true);
    
    // Remove all task worktrees
    for (const task of tasks) {
      try {
        if (fsSync.existsSync(task.worktree_path)) {
          await execAsync(`git worktree remove ${task.worktree_path}`, { cwd: project.local_path });
        }
      } catch (e) {
        // Ignore errors, worktree might already be gone
      }
    }
    
    // Optional: cleanup main repo
    if (req.body.cleanup && project.local_path && fsSync.existsSync(project.local_path)) {
      await execAsync(`rm -rf ${project.local_path}`);
    }
    
    // Delete from database (cascades to tasks and sessions)
    await models.projects.delete(project.id);
    
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
app.get('/api/health', async (req, res) => {
  try {
    const stats = await models.getStats();
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      ...stats,
      uptime: process.uptime(),
      githubEnabled: !!github
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      error: error.message 
    });
  }
});

// Start server
async function start() {
  try {
    await ensureProjectsDir();
    await initializeDatabase();
    await loadSettings();
    
    app.listen(PORT, () => {
      console.log(`Project Manager API (SQLite) running on port ${PORT}`);
      console.log(`Projects directory: ${PROJECTS_DIR}`);
      console.log(`Database: ${path.join(__dirname, '../data/pocketdev.db')}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Cleanup on exit
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  if (db) {
    await db.close();
  }
  process.exit();
});

// Export for ES modules
export default app;

// Start the server
start();