import express from 'express';
import cors from 'cors';
import { spawn, exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { mkdir, access } from 'fs/promises';
import path from 'path';
import config from './config.js';
import GitHubAPI from './github.js';

const exec = promisify(execCallback);
const app = express();

app.use(cors());
app.use(express.json());

// Configuration
const WORKTREE_DIR = process.env.WORKTREE_DIR || '/tmp/pocketdev-worktrees';

// In-memory task storage
const tasks = new Map();

// Initialize
async function init() {
  await config.load();
  await mkdir(WORKTREE_DIR, { recursive: true });
  console.log(`Worktree directory ready: ${WORKTREE_DIR}`);
  
  // Check if we need to clone the repository
  const { localPath } = config.getRepository();
  if (config.isConfigured()) {
    await ensureRepository();
  }
}

// Ensure repository is cloned and up to date
async function ensureRepository() {
  const { url, branch, localPath } = config.getRepository();
  const { token, username } = config.getGitCredentials();
  
  try {
    // Check if repo exists
    await access(path.join(localPath, '.git'));
    console.log('Repository exists, updating...');
    
    // Configure credentials
    if (token && username) {
      const authUrl = url.replace('https://', `https://${username}:${token}@`);
      await exec(`git remote set-url origin "${authUrl}"`, { cwd: localPath });
    }
    
    // Fetch latest
    await exec(`git fetch origin ${branch}`, { cwd: localPath });
    console.log(`Repository updated: ${localPath}`);
  } catch (error) {
    // Repository doesn't exist, clone it
    console.log('Repository not found, cloning...');
    
    if (!url) {
      console.warn('No repository URL configured');
      return;
    }
    
    // Clone with credentials
    const authUrl = token && username 
      ? url.replace('https://', `https://${username}:${token}@`)
      : url;
      
    await mkdir(path.dirname(localPath), { recursive: true });
    await exec(`git clone "${authUrl}" "${localPath}"`);
    console.log(`Repository cloned: ${localPath}`);
  }
}

// Generate branch name
function generateBranchName(taskId, description) {
  const sanitized = description
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);
  return `pocketdev/${sanitized}-${taskId}`;
}

// API Routes

// Health check
app.get('/health', (req, res) => {
  const cfg = config.get();
  res.json({ 
    status: 'ok', 
    worktreeDir: WORKTREE_DIR, 
    configured: config.isConfigured(),
    repository: cfg.github.repository || 'Not configured'
  });
});

// Get configuration
app.get('/api/config', (req, res) => {
  const cfg = config.get();
  res.json({
    github: {
      username: cfg.github.username,
      repository: cfg.github.repository,
      defaultBranch: cfg.github.defaultBranch,
      hasToken: !!cfg.github.token
    },
    localRepo: cfg.localRepo
  });
});

// Update configuration
app.post('/api/config', async (req, res) => {
  try {
    await config.update(req.body);
    
    // If GitHub config changed, ensure repository is cloned/updated
    if (req.body.github && config.isConfigured()) {
      await ensureRepository();
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Validate GitHub token
app.post('/api/github/validate', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }
  
  const api = new GitHubAPI(token);
  const result = await api.validateToken();
  res.json(result);
});

// Get GitHub repositories
app.get('/api/github/repos', async (req, res) => {
  const { token } = config.getGitCredentials();
  if (!token) {
    return res.status(401).json({ error: 'GitHub token not configured' });
  }
  
  try {
    const api = new GitHubAPI(token);
    const repos = await api.getRepositories();
    res.json(repos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get repository branches
app.get('/api/github/branches/:owner/:repo', async (req, res) => {
  const { token } = config.getGitCredentials();
  if (!token) {
    return res.status(401).json({ error: 'GitHub token not configured' });
  }
  
  try {
    const api = new GitHubAPI(token);
    const branches = await api.getBranches(req.params.owner, req.params.repo);
    res.json(branches);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Submit task
app.post('/api/task', async (req, res) => {
  const { task } = req.body;
  if (!task) {
    return res.status(400).json({ error: 'Task required' });
  }

  if (!config.isConfigured()) {
    return res.status(400).json({ error: 'GitHub not configured. Please set up GitHub credentials first.' });
  }

  const taskId = Date.now().toString();
  const branchName = generateBranchName(taskId, task);
  const worktreePath = path.join(WORKTREE_DIR, taskId);
  const { branch: defaultBranch, localPath } = config.getRepository();

  console.log(`\n=== NEW TASK: ${taskId} ===`);
  console.log(`Task: ${task}`);
  console.log(`Branch: ${branchName}`);
  console.log(`Base: ${defaultBranch}`);
  console.log(`Worktree: ${worktreePath}`);

  try {
    // Ensure we have latest from remote
    await exec(`git fetch origin ${defaultBranch}`, { cwd: localPath });
    
    // Create worktree from remote tracking branch
    console.log('Creating worktree...');
    await exec(`git worktree add -b ${branchName} "${worktreePath}" origin/${defaultBranch}`, {
      cwd: localPath
    });

    // Execute Claude
    console.log('Executing Claude...');
    const result = await executeClaudeTask(worktreePath, task);
    
    // Store task info
    const taskInfo = {
      taskId,
      task,
      branchName,
      worktreePath,
      sessionId: result.sessionId,
      result: result.result,
      status: 'review',
      createdAt: new Date().toISOString()
    };
    
    tasks.set(taskId, taskInfo);
    console.log(`Task ${taskId} completed successfully`);
    
    res.json(taskInfo);
  } catch (error) {
    console.error(`Task ${taskId} failed:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Follow up
app.post('/api/task/:taskId/followup', async (req, res) => {
  const { taskId } = req.params;
  const { prompt } = req.body;
  
  const task = tasks.get(taskId);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  console.log(`\n=== FOLLOW-UP: ${taskId} ===`);
  console.log(`Prompt: ${prompt}`);

  try {
    const result = await executeClaudeTask(task.worktreePath, prompt, task.sessionId);
    task.sessionId = result.sessionId;
    
    res.json({
      taskId,
      result: result.result,
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error(`Follow-up failed:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Accept changes
app.post('/api/task/:taskId/accept', async (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);
  
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }

  console.log(`\n=== ACCEPTING: ${taskId} ===`);

  try {
    // Claude commits and cleans up
    await executeClaudeTask(
      task.worktreePath, 
      'Clean up the code and commit all changes with a clear commit message',
      task.sessionId
    );

    // Push branch
    await exec(`git push -u origin ${task.branchName}`, { cwd: task.worktreePath });
    
    // Clean up worktree
    const { localPath } = config.getRepository();
    await exec(`git worktree remove "${task.worktreePath}" --force`, { cwd: localPath });
    
    task.status = 'accepted';
    res.json({ success: true, branch: task.branchName });
  } catch (error) {
    console.error(`Accept failed:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Execute Claude
function executeClaudeTask(worktreePath, prompt, sessionId = null) {
  return new Promise((resolve, reject) => {
    const args = ['-p', prompt, '--output-format', 'json', '--allowedTools', 'Write,Edit,Read,Bash'];
    
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    console.log('Claude args:', args);

    console.log('Spawning claude in:', worktreePath);
    console.log('With environment:', { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET' });
    
    const claude = spawn('claude', args, {
      cwd: worktreePath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    // Close stdin immediately since we're not sending any input
    claude.stdin.end();

    let output = '';
    let error = '';
    let hasResponded = false;

    // Add a timeout
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        console.error('Claude timeout after 60 seconds');
        claude.kill('SIGTERM');
        reject(new Error('Claude execution timed out'));
      }
    }, 60000);

    claude.stdout.on('data', (data) => {
      hasResponded = true;
      output += data.toString();
      console.log('Claude stdout chunk:', data.toString());
    });

    claude.stderr.on('data', (data) => {
      hasResponded = true;
      error += data.toString();
      console.error('Claude stderr:', data.toString());
    });

    claude.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Claude spawn error:', err);
      reject(err);
    });

    claude.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`Claude process exited with code ${code}`);
      if (code !== 0) {
        reject(new Error(`Claude exited with code ${code}: ${error}`));
      } else {
        try {
          const result = JSON.parse(output);
          resolve({
            sessionId: result.session_id,
            result: result.result,
            cost: result.cost_usd,
            success: result.subtype === 'success'
          });
        } catch (e) {
          reject(new Error('Failed to parse Claude output'));
        }
      }
    });
  });
}

// Start server
const PORT = process.env.PORT || 3001;
init().then(() => {
  app.listen(PORT, () => {
    const cfg = config.get();
    console.log(`PocketDev Simple Server running on port ${PORT}`);
    console.log(`Repository: ${cfg.github.repository || 'Not configured'}`);
    console.log(`Local path: ${cfg.localRepo}`);
    console.log(`Worktree dir: ${WORKTREE_DIR}`);
  });
}).catch(error => {
  console.error('Failed to initialize:', error);
  process.exit(1);
});