import express from 'express';
import cors from 'cors';
import { spawn } from 'child_process';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { DockerClaudeManager } from './docker-claude.js';
import { HostClaudeManager } from './host-claude.js';
import { HostCodexManager } from './host-codex.js';
import { CodeExtractor } from './lib/code-extractor.js';
import containerRoutes from './container-routes.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Add container routes
app.use(containerRoutes);

// Initialize Supabase (only if configured)
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const useSupabase = SUPABASE_URL && SUPABASE_URL !== 'your_supabase_url' && SUPABASE_SERVICE_KEY && SUPABASE_SERVICE_KEY !== 'your_service_key';

let supabase = null;
if (useSupabase) {
  supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// Track active Claude processes
const activeProcesses = new Map();

// Claude managers
const dockerManager = new DockerClaudeManager();
const hostManager = new HostClaudeManager();
const hostCodexManager = new HostCodexManager();
const codeExtractor = new CodeExtractor();

// In-memory mock data for local development
const mockEngineers = [
  {
    id: '1',
    name: 'Claude Frontend',
    role: 'frontend',
    engineType: 'claude',
    status: 'idle',
    last_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '2',
    name: 'Claude Backend',
    role: 'backend',
    engineType: 'claude',
    status: 'idle',
    last_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '3',
    name: 'Claude DevOps',
    role: 'devops',
    engineType: 'claude',
    status: 'idle',
    last_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  },
  {
    id: '4',
    name: 'Codex Engineer',
    role: 'fullstack',
    engineType: 'codex',
    status: 'idle',
    last_update: new Date().toISOString(),
    created_at: new Date().toISOString()
  }
];

const mockTasks = [];
const taskHistory = []; // Store all completed tasks

// Get engineers endpoint (for mock data)
app.get('/api/engineers', (req, res) => {
  res.json(mockEngineers);
});

// Get tasks endpoint (for mock data)
app.get('/api/tasks', (req, res) => {
  res.json(mockTasks);
});

// Get task history
app.get('/api/task-history', (req, res) => {
  // Return last 50 tasks, most recent first
  res.json(taskHistory.slice(-50).reverse());
});

// Reset engineer endpoint
app.post('/api/engineers/:id/reset', (req, res) => {
  const { id } = req.params;
  
  const engineer = mockEngineers.find(e => e.id === id);
  if (engineer) {
    engineer.status = 'idle';
    engineer.progress = 0;
    engineer.current_task = undefined;
    engineer.last_update = new Date().toISOString();
    res.json({ success: true, engineer });
  } else {
    res.status(404).json({ error: 'Engineer not found' });
  }
});

// Assign task endpoint
app.post('/api/assign-task', async (req, res) => {
  const { engineerId, task, mode = 'non-interactive', model = 'sonnet' } = req.body;

  try {
    let engineer;
    
    if (useSupabase) {
      // Get engineer details from Supabase
      const { data, error } = await supabase
        .from('engineers')
        .select('*')
        .eq('id', engineerId)
        .single();

      if (error || !data) {
        return res.status(404).json({ error: 'Engineer not found' });
      }
      engineer = data;

      // Update status to thinking
      await supabase
        .from('engineers')
        .update({ 
          status: 'thinking', 
          current_task: task,
          progress: 0,
          last_update: new Date().toISOString()
        })
        .eq('id', engineerId);
    } else {
      // Use mock data
      engineer = mockEngineers.find(e => e.id === engineerId);
      if (!engineer) {
        return res.status(404).json({ error: 'Engineer not found' });
      }
    }

    // For local development without Supabase, use mock data
    const useMockData = !useSupabase;
    
    if (useMockData) {
      // Update mock engineer
      const mockEngineer = mockEngineers.find(e => e.id === engineerId);
      if (mockEngineer) {
        mockEngineer.status = 'thinking';
        mockEngineer.current_task = task;
        mockEngineer.progress = 0;
        mockEngineer.last_update = new Date().toISOString();
      }
    }

    // For MVP, let's simulate the task execution
    // In production, this would actually run Claude Code
    console.error(`[API] Task assignment request - Mode: ${mode}, Execution Mode: ${process.env.CLAUDE_MODE || 'host'}`);
    
    if (mode === 'simulated') {
      console.error(`[API] Using simulated mode`);
      simulateTaskExecution(engineerId, task, useMockData);
      return res.json({ success: true, mode: 'simulated' });
    }

    // Real Claude Code execution
    const executionMode = process.env.CLAUDE_MODE || 'host'; // 'docker', 'host', or 'local'
    console.error(`[API] Executing real Claude task with mode: ${executionMode}, model: ${model}`);
    
    // Update engineer status to "working"
    if (useMockData) {
      const mockEngineer = mockEngineers.find(e => e.id === engineerId);
      if (mockEngineer) {
        mockEngineer.status = 'thinking';
        mockEngineer.current_task = task;
        mockEngineer.progress = 0;
        mockEngineer.last_update = new Date().toISOString();
      }
    }
    
    let result;
    if (executionMode === 'docker') {
      result = await dockerManager.executeTask(engineerId, task, engineer.role, model);
    } else if (executionMode === 'host') {
      if (engineer.engineType === 'codex') {
        result = await hostCodexManager.executeTask(engineerId, task, engineer.role, model);
      } else {
        result = await hostManager.executeTask(engineerId, task, engineer.role, model);
      }
    } else {
      // Local execution (original method)
      result = await executeClaudeTask(engineerId, task, engineer.role, model);
    }
    
    console.error(`[API] Task execution result:`, JSON.stringify(result, null, 2));
    
    // Extract and save code files if successful
    if (result.success && result.result) {
      try {
        const workspacePath = path.join(process.cwd(), '..', 'workspaces', engineer.role);
        const savedFiles = await codeExtractor.extractAndSaveFiles(result.result, workspacePath, task);
        result.savedFiles = savedFiles;
        console.error(`[API] Saved ${savedFiles.length} files to workspace`);
      } catch (error) {
        console.error(`[API] Failed to extract/save files:`, error);
      }
    }
    
    // Update status based on result
    const finalStatus = result.success ? 'complete' : 'error';
    
    // Add to task history
    const completedTask = {
      id: Date.now().toString(),
      engineerId: engineerId,
      engineerName: engineer.name,
      engineerRole: engineer.role,
      task: task,
      status: finalStatus,
      result: result.result,
      cost: result.cost || 0,
      duration: result.duration_ms || 0,
      sessionId: result.sessionId,
      filesCreated: result.savedFiles || [],
      completedAt: new Date().toISOString(),
      model: model
    };
    taskHistory.push(completedTask);
    
    // Update engineer status - set back to idle after completion
    if (useMockData) {
      const eng = mockEngineers.find(e => e.id === engineerId);
      if (eng) {
        if (result.success) {
          // Task completed successfully - back to idle
          eng.status = 'idle';
          eng.progress = 0;
          eng.current_task = undefined;
        } else {
          // Task failed - show error
          eng.status = 'error';
          eng.progress = 0;
          eng.current_task = task;
        }
        eng.last_update = new Date().toISOString();
      }
    } else if (supabase) {
      await supabase
        .from('engineers')
        .update({ 
          status: result.success ? 'idle' : 'error',
          progress: 0,
          current_task: result.success ? null : task,
          last_update: new Date().toISOString()
        })
        .eq('id', engineerId);
    }
    
    res.json({ ...result, taskId: completedTask.id });

  } catch (error) {
    console.error('Error assigning task:', error);
    res.status(500).json({ error: 'Failed to assign task' });
  }
});

// Execute Claude Code task
async function executeClaudeTask(engineerId, task, role) {
  const allowedTools = ['Read', 'Write', 'Edit', 'Bash', 'View'];
  
  // Build command
  const args = [
    '-p', task,
    '--output-format', 'json',
    ...allowedTools.flatMap(tool => ['--allowedTools', tool])
  ];

  return new Promise((resolve, reject) => {
    const claude = spawn('claude', args, {
      cwd: process.cwd(), // Or specific project directory
      env: { ...process.env }
    });

    let output = '';
    let error = '';

    claude.stdout.on('data', (data) => {
      output += data.toString();
    });

    claude.stderr.on('data', (data) => {
      error += data.toString();
    });

    claude.on('close', async (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output);
          
          // Update engineer status
          if (supabase) {
            await supabase
              .from('engineers')
              .update({
                status: 'complete',
                progress: 100,
                last_update: new Date().toISOString()
              })
              .eq('id', engineerId);

            // Store task result
            await supabase
              .from('tasks')
              .insert({
                description: task,
                assigned_to: engineerId,
                status: 'completed',
                output: result.result,
                completed_at: new Date().toISOString()
              });
          }

          resolve({ success: true, result: result.result });
        } catch (e) {
          reject({ error: 'Failed to parse Claude output' });
        }
      } else {
        // Update status to error
        await supabase
          .from('engineers')
          .update({
            status: 'error',
            last_update: new Date().toISOString()
          })
          .eq('id', engineerId);

        reject({ error: error || 'Claude Code failed' });
      }
    });
  });
}

// Simulate task execution (for testing without Claude)
async function simulateTaskExecution(engineerId, task, useMockData = false) {
  const steps = [
    { status: 'thinking', progress: 10, delay: 2000 },
    { status: 'coding', progress: 30, delay: 3000 },
    { status: 'coding', progress: 60, delay: 3000 },
    { status: 'testing', progress: 80, delay: 2000 },
    { status: 'complete', progress: 100, delay: 1000 }
  ];

  for (const step of steps) {
    await new Promise(resolve => setTimeout(resolve, step.delay));
    
    if (useMockData) {
      // Update mock data
      const engineer = mockEngineers.find(e => e.id === engineerId);
      if (engineer) {
        engineer.status = step.status;
        engineer.progress = step.progress;
        engineer.last_update = new Date().toISOString();
      }
    } else {
      await supabase
        .from('engineers')
        .update({
          status: step.status,
          progress: step.progress,
          last_update: new Date().toISOString()
        })
        .eq('id', engineerId);
    }
  }

  // Create a fake task completion
  const taskResult = {
    id: Date.now().toString(),
    description: task,
    assigned_to: engineerId,
    status: 'completed',
    output: `Simulated completion of: ${task}`,
    created_at: new Date().toISOString(),
    completed_at: new Date().toISOString()
  };

  if (useMockData) {
    mockTasks.push(taskResult);
    // Reset engineer to idle
    const engineer = mockEngineers.find(e => e.id === engineerId);
    if (engineer) {
      engineer.status = 'idle';
      engineer.current_task = undefined;
      engineer.progress = undefined;
    }
  } else {
    await supabase
      .from('tasks')
      .insert(taskResult);
  }
}

// Debug endpoint
app.get('/api/debug', (req, res) => {
  res.json({
    claudeMode: process.env.CLAUDE_MODE || 'host',
    apiKeyPresent: !!process.env.ANTHROPIC_API_KEY,
    workspacesPath: path.join(process.cwd(), '..', 'workspaces'),
    mockEngineersCount: mockEngineers.length,
    nodeVersion: process.version
  });
});

// Test endpoint for direct Claude execution
app.get('/api/test-claude', async (req, res) => {
  console.error('[API] Test Claude endpoint called');
  
  try {
    const testTask = "Create a new file called hello.js that exports a function that prints 'Hello World' to the console";
    const testModel = req.query.model || 'sonnet';
    const result = await hostManager.executeTask('test', testTask, 'frontend', testModel);
    
    res.json({
      success: true,
      task: testTask,
      result: result
    });
  } catch (error) {
    console.error('[API] Test Claude error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
  console.log('Mode: Local development');
  console.log('Claude Code integration: Ready');
});