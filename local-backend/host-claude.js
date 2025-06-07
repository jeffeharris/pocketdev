import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class HostClaudeManager {
  constructor() {
    this.workspacesPath = path.join(process.cwd(), '..', 'workspaces');
  }

  /**
   * Execute a task using host Claude in a specific workspace
   */
  async executeTask(engineerId, task, role, model = 'sonnet') {
    // Log to stderr so it shows in console
    console.error(`[HostClaudeManager] Executing task for ${role} engineer`);
    console.error(`[HostClaudeManager] Task: ${task}`);
    console.error(`[HostClaudeManager] Model: ${model}`);
    
    const workspacePath = path.join(this.workspacesPath, role);
    console.error(`[HostClaudeManager] Workspace path: ${workspacePath}`);
    
    // Add context including memory system
    const projectRoot = path.resolve(process.cwd(), '..');
    const memoryContext = `
MEMORY SYSTEM:
You have access to project memory files in ${projectRoot}/.pocketdev/:
- Team memory: .pocketdev/team-memory.md (read this for project context)
- Your personal memory: .pocketdev/engineers/${role}-${engineerId}.md

At the start of your task, read the team memory to understand the project.
If your personal memory file doesn't exist, create it with your first learnings.
Update your memory file with important discoveries as you work.
Add significant findings to the team memory for other engineers.

WORKSPACE:
You are working in a LIMITED HOST MODE in the workspace: ${workspacePath}
This means you can read the main repository but can only write files in your workspace.
You cannot directly modify the main codebase - instead create examples and prototypes in your workspace.`;

    const enhancedTask = `CONTEXT: You are a ${role} AI developer on the PocketDev platform working in host mode.
${memoryContext}
    
USER REQUEST: ${task}

INSTRUCTIONS: 
1. First, read the team memory to understand the project context
2. Check if you have a personal memory file and read it
3. Complete the requested task
4. Update your memory files with any important learnings
5. If asked for files, provide complete code/content in code blocks`;
    
    // Ensure workspace exists
    await fs.mkdir(workspacePath, { recursive: true });

    return new Promise((resolve, reject) => {
      console.error(`[HostClaudeManager] Starting claude process...`);
      console.error(`[HostClaudeManager] API Key present: ${!!process.env.ANTHROPIC_API_KEY}`);
      
      // Use spawn for better control
      // Debug: log the exact command being run
      const args = ['-p', enhancedTask, '--output-format', 'json', '--model', model];
      console.error(`[HostClaudeManager] Using enhanced prompt with context`);
      console.error(`[HostClaudeManager] Working directory: ${workspacePath}`);
      console.error(`[HostClaudeManager] API Key: ${process.env.ANTHROPIC_API_KEY?.substring(0, 10)}...`);
      
      const claudeProcess = spawn('claude', args, {
        cwd: workspacePath,
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
        },
        stdio: ['pipe', 'pipe', 'pipe'] // Explicitly set stdio
      });
      
      // Close stdin immediately since we're not sending any input
      claudeProcess.stdin.end();

      let stdout = '';
      let stderr = '';
      let processStarted = false;

      claudeProcess.on('spawn', () => {
        processStarted = true;
        console.error('[HostClaudeManager] Process spawned successfully');
      });

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.error(`[HostClaudeManager] Stdout chunk (${chunk.length} chars): ${chunk.substring(0, 100)}...`);
      });

      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error('[HostClaudeManager] Claude stderr chunk:', chunk);
      });

      claudeProcess.on('error', (error) => {
        console.error('[HostClaudeManager] Process error:', error);
        reject(error);
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout); // Clear the timeout since process finished
        console.error(`[HostClaudeManager] Process exited with code ${code}`);
        console.error(`[HostClaudeManager] Stdout length: ${stdout.length}`);
        
        if (code !== 0) {
          resolve({
            success: false,
            error: stderr || `Process exited with code ${code}`
          });
          return;
        }

        // Parse JSON output
        try {
          const result = JSON.parse(stdout);
          console.error(`[HostClaudeManager] Parsed result:`, result);
          
          resolve({
            success: true,
            result: result.result || result.content || result.text || stdout,
            sessionId: result.session_id || result.sessionId,
            cost: result.cost || result.total_cost,
            rawOutput: stdout
          });
        } catch (parseError) {
          console.error(`[HostClaudeManager] Failed to parse JSON, returning raw output`);
          // If JSON parsing fails, return raw output
          resolve({
            success: true,
            result: stdout,
            output: stdout
          });
        }
      });

      // Add a timeout - 10 minutes should be enough for most tasks
      const timeoutMs = 10 * 60 * 1000; // 10 minutes
      const timeout = setTimeout(() => {
        console.error(`[HostClaudeManager] Timeout - killing process after ${timeoutMs/1000} seconds`);
        claudeProcess.kill();
        reject(new Error(`Claude process timed out after ${timeoutMs/1000} seconds`));
      }, timeoutMs);
    }).catch(error => {
      console.error('[HostClaudeManager] Execution error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    });
  }

  /**
   * Start interactive Claude session in a workspace
   */
  async startInteractiveSession(engineerId, role) {
    const workspacePath = path.join(this.workspacesPath, role);
    
    // Ensure workspace exists
    await fs.mkdir(workspacePath, { recursive: true });

    // Start Claude in the workspace
    const claudeProcess = spawn('claude', [], {
      cwd: workspacePath,
      stdio: 'pipe',
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY
      }
    });

    return {
      process: claudeProcess,
      workspacePath
    };
  }

  /**
   * List files in workspace
   */
  async listWorkspaceFiles(role) {
    const workspacePath = path.join(this.workspacesPath, role);
    try {
      const files = await fs.readdir(workspacePath);
      return files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Get workspace info
   */
  async getWorkspaceInfo(role) {
    const workspacePath = path.join(this.workspacesPath, role);
    const files = await this.listWorkspaceFiles(role);
    
    return {
      path: workspacePath,
      files: files,
      exists: files.length > 0
    };
  }
}