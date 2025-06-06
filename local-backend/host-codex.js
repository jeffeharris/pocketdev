import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export class HostCodexManager {
  constructor() {
    this.workspacesPath = path.join(process.cwd(), '..', 'workspaces');
  }

  /**
   * Execute a task using host Codex in a specific workspace
   */
  async executeTask(engineerId, task, role, model = 'sonnet') {
    // Log to stderr so it shows in console
    console.error(`[HostCodexManager] Executing task for ${role} engineer`);
    console.error(`[HostCodexManager] Task: ${task}`);
    console.error(`[HostCodexManager] Model: ${model}`);
    
    const workspacePath = path.join(this.workspacesPath, role);
    console.error(`[HostCodexManager] Workspace path: ${workspacePath}`);
    
    // Add context to help Codex understand file creation is authorized
    const enhancedTask = `CONTEXT: You are an AI developer on the PocketDev platform. The user is explicitly requesting code/file content.
    
USER REQUEST: ${task}

INSTRUCTIONS: Provide the complete code/content requested. If asked for a file like README.md, provide the full markdown content in a code block.`;
    
    // Ensure workspace exists
    await fs.mkdir(workspacePath, { recursive: true });

    return new Promise((resolve, reject) => {
      console.error(`[HostCodexManager] Starting codex process...`);
      console.error(`[HostCodexManager] API Key present: ${!!process.env.OPENAI_API_KEY}`);
      
      // Use spawn for better control
      // Debug: log the exact command being run
      const args = [enhancedTask, '--model', model, '-q'];
      console.error(`[HostCodexManager] Using enhanced prompt with context`);
      console.error(`[HostCodexManager] Working directory: ${workspacePath}`);
      console.error(`[HostCodexManager] API Key: ${process.env.OPENAI_API_KEY?.substring(0, 10)}...`);
      
      const claudeProcess = spawn('codex', args, {
        cwd: workspacePath,
        env: {
          ...process.env,
          OPENAI_API_KEY: process.env.OPENAI_API_KEY
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
        console.error('[HostCodexManager] Process spawned successfully');
      });

      claudeProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        stdout += chunk;
        console.error(`[HostCodexManager] Stdout chunk (${chunk.length} chars): ${chunk.substring(0, 100)}...`);
      });

      claudeProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        stderr += chunk;
        console.error('[HostCodexManager] Codex stderr chunk:', chunk);
      });

      claudeProcess.on('error', (error) => {
        console.error('[HostCodexManager] Process error:', error);
        reject(error);
      });

      claudeProcess.on('close', (code) => {
        clearTimeout(timeout); // Clear the timeout since process finished
        console.error(`[HostCodexManager] Process exited with code ${code}`);
        console.error(`[HostCodexManager] Stdout length: ${stdout.length}`);
        
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
          console.error(`[HostCodexManager] Parsed result:`, result);
          
          resolve({
            success: true,
            result: result.result || result.content || result.text || stdout,
            sessionId: result.session_id || result.sessionId,
            cost: result.cost || result.total_cost,
            rawOutput: stdout
          });
        } catch (parseError) {
          console.error(`[HostCodexManager] Failed to parse JSON, returning raw output`);
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
        console.error(`[HostCodexManager] Timeout - killing process after ${timeoutMs/1000} seconds`);
        claudeProcess.kill();
        reject(new Error(`Codex process timed out after ${timeoutMs/1000} seconds`));
      }, timeoutMs);
    }).catch(error => {
      console.error('[HostCodexManager] Execution error:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    });
  }

  /**
   * Start interactive Codex session in a workspace
   */
  async startInteractiveSession(engineerId, role) {
    const workspacePath = path.join(this.workspacesPath, role);
    
    // Ensure workspace exists
    await fs.mkdir(workspacePath, { recursive: true });

    // Start Codex in the workspace
    const claudeProcess = spawn('codex', [], {
      cwd: workspacePath,
      stdio: 'pipe',
      env: {
        ...process.env,
        OPENAI_API_KEY: process.env.OPENAI_API_KEY
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
