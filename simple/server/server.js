import express from 'express';
import cors from 'cors';
import { spawn, exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { mkdir, access } from 'fs/promises';
import fs from 'fs';
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
    console.log('Repository exists, checking remote...');
    
    // Get current remote URL
    let currentRemote = '';
    try {
      const { stdout } = await exec('git remote get-url origin', { cwd: localPath });
      currentRemote = stdout.trim();
    } catch (e) {
      // No remote set
    }
    
    // Configure credentials and update remote if needed
    if (token && username && url) {
      const authUrl = url.replace('https://', `https://${username}:${token}@`);
      if (currentRemote !== authUrl) {
        await exec(`git remote set-url origin "${authUrl}"`, { cwd: localPath });
        console.log('Updated remote URL with credentials');
      }
    }
    
    // Fetch latest
    await exec(`git fetch origin ${branch}`, { cwd: localPath });
    console.log(`Repository updated: ${localPath}`);
  } catch (error) {
    // Repository doesn't exist, need to handle non-empty directory
    console.log('Git repository not found in workspace');
    
    if (!url) {
      console.warn('No repository URL configured');
      return;
    }
    
    // Check if directory exists and is non-empty
    try {
      await access(localPath);
      const { stdout } = await exec(`ls -A "${localPath}"`);
      if (stdout.trim()) {
        console.warn(`Directory ${localPath} is not empty and not a git repo. Skipping clone.`);
        return;
      }
    } catch (e) {
      // Directory doesn't exist, we can clone
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
    console.log('Updating config with:', JSON.stringify(req.body, null, 2));
    await config.update(req.body);
    
    // If GitHub config changed, ensure repository is cloned/updated
    if (req.body.github && config.isConfigured()) {
      await ensureRepository();
    }
    
    console.log('Config after update:', JSON.stringify(config.get(), null, 2));
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
    console.log('\n=== CLAUDE EXECUTION ===');
    console.log('Prompt length:', prompt.length);
    console.log('Prompt:', prompt);
    console.log('Session ID:', sessionId || 'none');
    
    const args = ['-p', prompt, '--output-format', 'json', '--allowedTools', 'Write,Edit,Read,Bash', '--model', 'claude-3-5-sonnet-20241022'];
    
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    console.log('Claude args:', args);

    console.log('Spawning claude in:', worktreePath);
    console.log('With environment:', { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET' });
    
    // Go back to simple spawn with stdin redirect
    const claude = spawn('/bin/sh', ['-c', `claude ${args.map(arg => `'${arg.replace(/'/g, "'\"'\"'")}'`).join(' ')} < /dev/null`], {
      cwd: worktreePath,
      env: { ...process.env },
      stdio: ['inherit', 'pipe', 'pipe']
    });
    
    console.log('Process spawned with PID:', claude.pid);

    let output = '';
    let error = '';
    let hasResponded = false;
    let dataReceived = 0;

    // Add a timeout (5 minutes for complex tasks)
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        console.error('Claude timeout after 5 minutes');
        console.error(`Total data received: ${dataReceived} bytes`);
        console.error(`Output so far: ${output}`);
        console.error(`Error so far: ${error}`);
        
        // Try different kill signals
        console.log('Sending SIGTERM...');
        claude.kill('SIGTERM');
        
        setTimeout(() => {
          if (!claude.killed) {
            console.log('Process still alive, sending SIGKILL...');
            claude.kill('SIGKILL');
          }
        }, 5000);
        
        reject(new Error('Claude execution timed out'));
      }
    }, 300000); // 5 minutes

    claude.stdout.on('data', (data) => {
      hasResponded = true;
      const chunk = data.toString();
      dataReceived += data.length;
      output += chunk;
      console.log(`Claude stdout chunk (${data.length} bytes):`, chunk);
    });

    claude.stderr.on('data', (data) => {
      hasResponded = true;
      const chunk = data.toString();
      dataReceived += data.length;
      error += chunk;
      console.error(`Claude stderr chunk (${data.length} bytes):`, chunk);
    });

    claude.on('error', (err) => {
      clearTimeout(timeout);
      console.error('Claude spawn error:', err);
      reject(err);
    });
    
    // Monitor process state and network activity
    const stateInterval = setInterval(async () => {
      try {
        process.kill(claude.pid, 0); // Check if process exists
        console.log(`\n[${new Date().toISOString()}] === PROCESS MONITORING ===`);
        
        // Get all child processes
        try {
          const { stdout: pstree } = await exec(`pstree -p ${claude.pid} || ps --ppid ${claude.pid} -o pid,comm --no-headers`);
          console.log(`Process tree:\n${pstree.trim()}`);
        } catch (e) {
          console.log(`Process tree: Unable to get`);
        }
        
        // Check all processes in the tree for claude
        try {
          const { stdout: claudeProcs } = await exec(`ps aux | grep -E "(claude|anthropic)" | grep -v grep | head -5`);
          if (claudeProcs.trim()) {
            console.log(`Claude processes:\n${claudeProcs.trim()}`);
          }
        } catch (e) {}
        
        // Check CPU and memory for all related processes
        try {
          const { stdout: psOut } = await exec(`ps -p ${claude.pid} --ppid ${claude.pid} -o pid,%cpu,vsz,rss,state,comm --no-headers`);
          console.log(`CPU/Memory:\n${psOut.trim()}`);
        } catch (e) {}
        
        // Check all network connections (not just for specific PID)
        try {
          const { stdout: netOut } = await exec(`ss -tnp 2>/dev/null | grep -E "(anthropic|claude|443)" | head -5`);
          if (netOut.trim()) {
            console.log(`Network connections:\n${netOut.trim()}`);
          } else {
            // Try netstat as fallback
            const { stdout: netstatOut } = await exec(`netstat -tnp 2>/dev/null | grep -E "(anthropic|claude|443)" | head -5`);
            console.log(`Network (netstat): ${netstatOut.trim() || 'No active connections to Anthropic'}`);
          }
        } catch (e) {
          console.log(`Network: Unable to check connections`);
        }
        
        // Check if any process is making HTTPS connections
        try {
          const { stdout: httpsConns } = await exec(`lsof -i :443 2>/dev/null | grep -v LISTEN | head -5`);
          if (httpsConns.trim()) {
            console.log(`HTTPS connections:\n${httpsConns.trim()}`);
          }
        } catch (e) {}
        
        // Sample strace to see what's happening
        try {
          const { stdout: straceOut } = await exec(`timeout 1 strace -p ${claude.pid} 2>&1 | head -10`);
          if (straceOut.trim() && !straceOut.includes('Operation not permitted')) {
            console.log(`System calls:\n${straceOut.trim()}`);
          }
        } catch (e) {}
        
        // Check if Claude left any debug logs
        try {
          const { stdout: claudeLogs } = await exec(`find /tmp -name "*claude*" -type f -mmin -5 2>/dev/null | head -5`);
          if (claudeLogs.trim()) {
            console.log(`Recent Claude files: ${claudeLogs.trim()}`);
          }
        } catch (e) {}
        
      } catch (e) {
        console.log(`Process ${claude.pid} no longer exists`);
        clearInterval(stateInterval);
      }
    }, 5000); // Every 5 seconds

    claude.on('close', (code) => {
      clearInterval(stateInterval);
      clearTimeout(timeout);
      console.log(`Claude process exited with code ${code}`);
      
      // Try to parse output even if exit code is non-zero
      try {
        const result = JSON.parse(output);
        
        // Check if Claude returned an error in the JSON
        if (result.is_error || result.subtype === 'error') {
          reject(new Error(result.result || 'Claude encountered an error'));
        } else if (code !== 0) {
          reject(new Error(result.result || `Claude exited with code ${code}`));
        } else {
          resolve({
            sessionId: result.session_id,
            result: result.result,
            cost: result.cost_usd,
            success: result.subtype === 'success'
          });
        }
      } catch (e) {
        // If we can't parse output, return stderr or generic error
        if (error) {
          reject(new Error(error));
        } else if (output) {
          reject(new Error(`Failed to parse Claude output: ${output}`));
        } else {
          reject(new Error(`Claude exited with code ${code} with no output`));
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