import express from 'express';
import cors from 'cors';
import { spawn, exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { mkdir, access } from 'fs/promises';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
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

// SSE clients for streaming updates
const sseClients = new Map();

// Send SSE event to a specific task
function sendSSE(taskId, data) {
  console.log(`[SSE] Attempting to send to task ${taskId}:`, data.type);
  const client = sseClients.get(taskId);
  if (client) {
    console.log(`[SSE] Client found, sending event`);
    client.write(`data: ${JSON.stringify(data)}\n\n`);
  } else {
    console.log(`[SSE] No client connected for task ${taskId}`);
  }
}

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

// SSE endpoint for streaming task updates
app.get('/api/stream/:taskId', (req, res) => {
  const { taskId } = req.params;
  
  // Set headers for SSE
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  // Store client
  sseClients.set(taskId, res);
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', taskId })}\n\n`);
  
  // Handle client disconnect
  req.on('close', () => {
    sseClients.delete(taskId);
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

    // Store task info immediately so client can connect
    const taskInfo = {
      taskId,
      task,
      branchName,
      worktreePath,
      status: 'starting',
      createdAt: new Date().toISOString()
    };
    
    tasks.set(taskId, taskInfo);
    
    // Return immediately so client can connect to SSE
    res.json(taskInfo);
    
    // Execute Claude asynchronously
    console.log('Executing Claude...');
    executeClaudeTask(worktreePath, task, null, taskId)
      .then(result => {
        // Update task info with result
        taskInfo.sessionId = result.sessionId;
        taskInfo.result = result.result;
        taskInfo.status = 'review';
        console.log(`Task ${taskId} completed successfully`);
      })
      .catch(error => {
        console.error(`Task ${taskId} failed:`, error);
        taskInfo.status = 'error';
        taskInfo.error = error.message;
      });
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
    // Pass the taskId so streaming works
    const result = await executeClaudeTask(task.worktreePath, prompt, task.sessionId, taskId);
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
    // Check if there are uncommitted changes
    const { stdout: statusOut } = await exec('git status --porcelain', { cwd: task.worktreePath });
    
    if (statusOut.trim()) {
      // There are uncommitted changes, ask Claude to commit
      console.log('Uncommitted changes found, asking Claude to commit...');
      await executeClaudeTask(
        task.worktreePath, 
        'Clean up the code and commit all changes with a clear commit message',
        task.sessionId,
        taskId  // Pass taskId for streaming
      );
    } else {
      console.log('No uncommitted changes, proceeding to push...');
    }

    // Push branch
    console.log(`Pushing branch ${task.branchName}...`);
    const { stdout: pushOut } = await exec(`git push -u origin ${task.branchName}`, { cwd: task.worktreePath });
    console.log('Push output:', pushOut);
    
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
function executeClaudeTask(worktreePath, prompt, sessionId = null, taskId = null) {
  return new Promise((resolve, reject) => {
    console.log('\n=== CLAUDE EXECUTION ===');
    console.log('Prompt length:', prompt.length);
    console.log('Prompt:', prompt);
    console.log('Session ID:', sessionId || 'none');
    console.log('Task ID:', taskId || 'none');
    
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose', '--allowedTools', 'Write,Edit,Read,Bash', '--model', 'claude-3-5-sonnet-20241022'];
    
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    console.log('Claude args:', args);

    console.log('Spawning claude in:', worktreePath);
    console.log('With environment:', { ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET' : 'NOT SET' });
    
    // Spawn claude directly without shell wrapper for better control
    const claude = spawn('claude', args, {
      cwd: worktreePath,
      env: { ...process.env },
      stdio: ['pipe', 'pipe', 'pipe']  // pipe stdin so we can close it
    });
    
    console.log('Process spawned with PID:', claude.pid);
    
    // Immediately close stdin to prevent hanging
    claude.stdin.end();
    console.log('Closed stdin');

    let error = '';
    let hasResponded = false;
    let dataReceived = 0;
    let resultMessage = null;
    let currentSessionId = sessionId;
    let messageCount = 0;
    
    // Create readline interface for parsing JSON lines
    const rl = readline.createInterface({
      input: claude.stdout,
      crlfDelay: Infinity
    });

    // Add a timeout (5 minutes for complex tasks)
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        console.error('Claude timeout after 5 minutes');
        console.error(`Total data received: ${dataReceived} bytes`);
        console.error(`Messages received: ${messageCount}`);
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

    // Parse each line as streaming JSON
    rl.on('line', (line) => {
      hasResponded = true;
      dataReceived += line.length;
      messageCount++;
      
      try {
        const message = JSON.parse(line);
        
        console.log(`\n[${new Date().toISOString()}] Stream message #${messageCount}: ${message.type}${message.subtype ? ` (${message.subtype})` : ''}`);
        
        // Log the full message for certain types
        if (messageCount <= 5 || message.type === 'result' || message.type === 'system') {
          console.log(`  Full message structure:`, JSON.stringify(message, null, 2));
        }
        
        switch (message.type) {
          case 'system':
            if (message.subtype === 'init') {
              currentSessionId = message.session_id;
              console.log(`  Session initialized: ${currentSessionId}`);
              console.log(`  Available tools: ${message.tools.join(', ')}`);
              if (taskId) {
                sendSSE(taskId, {
                  type: 'init',
                  sessionId: currentSessionId,
                  tools: message.tools,
                  timestamp: new Date().toISOString()
                });
              }
            }
            break;
            
          case 'user':
            console.log(`  User message received (${message.message?.content?.length || 0} chars)`);
            break;
            
          case 'assistant':
            console.log(`  Assistant response in progress...`);
            
            // Log full message structure
            console.log('  Full assistant message:', JSON.stringify(message, null, 2));
            
            // Handle preview text
            if (message.message?.preview) {
              console.log(`  Preview: ${message.message.preview.substring(0, 100)}${message.message.preview.length > 100 ? '...' : ''}`);
              
              if (taskId && message.message.preview) {
                // Send assistant's thinking/explanation from preview
                sendSSE(taskId, {
                  type: 'thinking',
                  text: message.message.preview.substring(0, 200),
                  timestamp: new Date().toISOString()
                });
              }
            }
            
            // Check for tool use in content array
            if (message.message?.content && Array.isArray(message.message.content)) {
              console.log(`  Content items: ${message.message.content.length}`);
              message.message.content.forEach((item, index) => {
                if (item.type === 'tool_use' && taskId) {
                  console.log(`  Found tool_use: ${item.name}`);
                  let activity = '';
                  let icon = '🔧';
                  
                  // Determine activity type based on tool
                  switch (item.name) {
                    case 'Read':
                      icon = '📖';
                      activity = `Reading ${item.input?.file_path || 'file'}`;
                      break;
                    case 'Write':
                      icon = '📝';
                      activity = `Writing ${item.input?.file_path || 'file'}`;
                      break;
                    case 'Edit':
                    case 'MultiEdit':
                      icon = '✏️';
                      activity = `Editing ${item.input?.file_path || 'file'}`;
                      break;
                    case 'Bash':
                      icon = '🔧';
                      activity = `Running: ${item.input?.command || 'command'}`;
                      break;
                    case 'Grep':
                    case 'Glob':
                      icon = '🔍';
                      activity = `Searching for: ${item.input?.pattern || 'pattern'}`;
                      break;
                    default:
                      activity = `Using ${item.name}`;
                  }
                  
                  sendSSE(taskId, {
                    type: 'activity',
                    icon,
                    activity,
                    tool: item.name,
                    timestamp: new Date().toISOString()
                  });
                }
              });
            }
            break;
            
          case 'tool_use':
            console.log(`  Tool use: ${message.tool_name}`);
            if (message.tool_input) {
              console.log(`  Tool input preview:`, JSON.stringify(message.tool_input).substring(0, 200));
            }
            
            if (taskId) {
              let activity = '';
              let icon = '🔧';
              
              // Determine activity type based on tool
              switch (message.tool_name) {
                case 'Read':
                  icon = '📖';
                  activity = `Reading ${message.tool_input?.file_path || 'file'}`;
                  break;
                case 'Write':
                  icon = '📝';
                  activity = `Writing ${message.tool_input?.file_path || 'file'}`;
                  break;
                case 'Edit':
                case 'MultiEdit':
                  icon = '✏️';
                  activity = `Editing ${message.tool_input?.file_path || 'file'}`;
                  break;
                case 'Bash':
                  icon = '🔧';
                  activity = `Running: ${message.tool_input?.command || 'command'}`;
                  break;
                case 'Grep':
                case 'Glob':
                  icon = '🔍';
                  activity = `Searching for: ${message.tool_input?.pattern || 'pattern'}`;
                  break;
                default:
                  activity = `Using ${message.tool_name}`;
              }
              
              sendSSE(taskId, {
                type: 'activity',
                icon,
                activity,
                tool: message.tool_name,
                timestamp: new Date().toISOString()
              });
            }
            break;
            
          case 'result':
            resultMessage = message;
            console.log(`  Result: ${message.subtype}`);
            console.log(`  Cost: $${message.cost_usd}`);
            console.log(`  Duration: ${message.duration_ms}ms`);
            console.log(`  Turns: ${message.num_turns}`);
            if (message.result) {
              console.log(`  Output: ${message.result.substring(0, 200)}${message.result.length > 200 ? '...' : ''}`);
            }
            
            if (taskId) {
              sendSSE(taskId, {
                type: 'complete',
                result: message.subtype,
                cost: message.cost_usd,
                duration: message.duration_ms,
                turns: message.num_turns,
                output: message.result,
                timestamp: new Date().toISOString()
              });
            }
            break;
        }
      } catch (e) {
        console.error(`Failed to parse streaming JSON: ${e.message}`);
        console.error(`Raw line: ${line}`);
      }
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
    

    claude.on('close', (code) => {
      clearTimeout(timeout);
      rl.close();
      console.log(`\nClaude process exited with code ${code}`);
      console.log(`Total messages received: ${messageCount}`);
      
      // Use the streaming result message
      if (resultMessage) {
        if (resultMessage.is_error || resultMessage.subtype === 'error' || resultMessage.subtype === 'error_during_execution') {
          // Send error to SSE before rejecting
          if (taskId) {
            sendSSE(taskId, {
              type: 'error',
              error: resultMessage.result || 'Claude encountered an error during execution',
              timestamp: new Date().toISOString()
            });
          }
          reject(new Error(resultMessage.result || 'Claude encountered an error during execution'));
        } else if (code !== 0 && !resultMessage.result) {
          reject(new Error(`Claude exited with code ${code}`));
        } else {
          resolve({
            sessionId: resultMessage.session_id || currentSessionId,
            result: resultMessage.result,
            cost: resultMessage.cost_usd,
            success: resultMessage.subtype === 'success'
          });
        }
      } else {
        // No result message received
        if (error) {
          reject(new Error(error));
        } else if (code === 0) {
          // Sometimes Claude exits 0 without a result message
          reject(new Error('Claude completed but did not return a result'));
        } else {
          reject(new Error(`Claude exited with code ${code} with no result`));
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