import express from 'express';
import cors from 'cors';
import { spawn, exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { mkdir } from 'fs/promises';
import path from 'path';

const exec = promisify(execCallback);
const app = express();

app.use(cors());
app.use(express.json());

// Configuration
const GIT_REPO = process.env.GIT_REPO || '/workspace';
const WORKTREE_DIR = process.env.WORKTREE_DIR || '/tmp/pocketdev-worktrees';
const DEFAULT_BRANCH = process.env.DEFAULT_BRANCH || 'main';

// In-memory task storage
const tasks = new Map();

// Initialize worktree directory
async function init() {
  await mkdir(WORKTREE_DIR, { recursive: true });
  console.log(`Worktree directory ready: ${WORKTREE_DIR}`);
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
  res.json({ status: 'ok', worktreeDir: WORKTREE_DIR, repo: GIT_REPO });
});

// Submit task
app.post('/api/task', async (req, res) => {
  const { task } = req.body;
  if (!task) {
    return res.status(400).json({ error: 'Task required' });
  }

  const taskId = Date.now().toString();
  const branchName = generateBranchName(taskId, task);
  const worktreePath = path.join(WORKTREE_DIR, taskId);

  console.log(`\n=== NEW TASK: ${taskId} ===`);
  console.log(`Task: ${task}`);
  console.log(`Branch: ${branchName}`);
  console.log(`Worktree: ${worktreePath}`);

  try {
    // Create worktree
    console.log('Creating worktree...');
    await exec(`git worktree add -b ${branchName} "${worktreePath}" ${DEFAULT_BRANCH}`, {
      cwd: GIT_REPO
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
    await exec(`git worktree remove "${task.worktreePath}" --force`, { cwd: GIT_REPO });
    
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
    console.log(`PocketDev Minimal Server running on port ${PORT}`);
    console.log(`Git repo: ${GIT_REPO}`);
    console.log(`Worktree dir: ${WORKTREE_DIR}`);
  });
});