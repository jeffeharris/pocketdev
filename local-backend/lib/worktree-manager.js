import { spawn, exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { mkdir, rm, access } from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

const exec = promisify(execCallback);

/**
 * Minimal worktree manager for PocketDev
 * Handles creation and management of git worktrees for isolated Claude executions
 */
export class WorktreeManager {
  constructor(config = {}) {
    this.baseRepo = config.baseRepo || process.cwd();
    this.worktreeDir = config.worktreeDir || '/tmp/pocketdev-worktrees';
    this.defaultBranch = config.defaultBranch || 'main';
  }

  /**
   * Initialize worktree directory
   */
  async init() {
    try {
      await mkdir(this.worktreeDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create worktree directory:', error);
      throw error;
    }
  }

  /**
   * Create a new worktree for a task
   * @param {Object} options
   * @param {string} options.taskId - Unique task identifier
   * @param {string} options.baseBranch - Branch to create from (defaults to defaultBranch)
   * @param {string} options.description - Task description for branch name
   * @returns {Object} Worktree info including path and branch name
   */
  async createWorktree({ taskId, baseBranch, description }) {
    const branchName = this.generateBranchName(taskId, description);
    const worktreePath = path.join(this.worktreeDir, taskId);

    try {
      // Ensure we're on the latest base branch
      const base = baseBranch || this.defaultBranch;
      
      // Check if origin exists
      let useOrigin = false;
      try {
        await exec('git remote get-url origin', { cwd: this.baseRepo });
        await exec(`git fetch origin ${base}`, { cwd: this.baseRepo });
        useOrigin = true;
      } catch (e) {
        // No origin, use local branch
        console.log('No origin remote, using local branch');
      }

      // Create new branch and worktree
      const baseRef = useOrigin ? `origin/${base}` : base;
      await exec(
        `git worktree add -b ${branchName} "${worktreePath}" ${baseRef}`,
        { cwd: this.baseRepo }
      );

      return {
        taskId,
        worktreePath,
        branchName,
        baseBranch: base,
        created: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to create worktree:', error);
      // Clean up if partial creation
      await this.cleanupWorktree(taskId).catch(() => {});
      throw error;
    }
  }

  /**
   * Execute Claude in a specific worktree
   * @param {Object} options
   * @param {string} options.worktreePath - Path to the worktree
   * @param {string} options.prompt - Prompt for Claude
   * @param {string} options.sessionId - Optional session ID for continuation
   * @param {boolean} options.stream - Whether to stream output
   * @returns {Object} Execution result
   */
  async executeClaudeInWorktree({ worktreePath, prompt, sessionId, stream = true }) {
    const args = ['-p', prompt];
    
    if (sessionId) {
      args.push('--resume', sessionId);
    }

    if (stream) {
      args.push('--output-format', 'stream-json');
    } else {
      args.push('--output-format', 'json');
    }

    console.log('Executing Claude with args:', args);
    console.log('In directory:', worktreePath);
    
    return new Promise((resolve, reject) => {
      const claude = spawn('claude', args, {
        cwd: worktreePath,
        env: { ...process.env }
      });

      const output = [];
      let error = '';

      claude.stdout.on('data', (data) => {
        const chunk = data.toString();
        output.push(chunk);
        
        if (stream) {
          // Parse and emit streaming JSON chunks
          const lines = chunk.split('\n').filter(line => line.trim());
          lines.forEach(line => {
            try {
              const message = JSON.parse(line);
              // Could emit to websocket here for real-time updates
              console.log('Stream message:', message.type);
            } catch (e) {
              // Not all lines are JSON
            }
          });
        }
      });

      claude.stderr.on('data', (data) => {
        error += data.toString();
      });

      claude.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`Claude exited with code ${code}: ${error}`));
        } else {
          const fullOutput = output.join('');
          
          if (stream) {
            // Parse all messages from stream
            const messages = fullOutput
              .split('\n')
              .filter(line => line.trim())
              .map(line => {
                try {
                  return JSON.parse(line);
                } catch (e) {
                  return null;
                }
              })
              .filter(Boolean);

            // Extract session ID and final result
            const initMessage = messages.find(m => m.type === 'system' && m.subtype === 'init');
            const resultMessage = messages.find(m => m.type === 'result');
            
            resolve({
              sessionId: initMessage?.session_id || resultMessage?.session_id,
              messages,
              result: resultMessage?.result,
              cost: resultMessage?.cost_usd,
              success: resultMessage?.subtype === 'success'
            });
          } else {
            // Non-streaming JSON output
            try {
              const result = JSON.parse(fullOutput);
              resolve(result);
            } catch (e) {
              reject(new Error('Failed to parse Claude output'));
            }
          }
        }
      });
    });
  }

  /**
   * Continue a conversation in a worktree
   */
  async continueConversation({ worktreePath, sessionId, prompt }) {
    return this.executeClaudeInWorktree({
      worktreePath,
      prompt,
      sessionId,
      stream: true
    });
  }

  /**
   * Accept changes and create PR
   */
  async acceptChanges({ taskId, worktreePath, sessionId }) {
    try {
      // First, have Claude clean up and commit
      const cleanupResult = await this.executeClaudeInWorktree({
        worktreePath,
        prompt: 'Clean up the branch and commit all changes with a clear commit message',
        sessionId,
        stream: false
      });

      // Push the branch
      const { stdout: branchName } = await exec('git branch --show-current', { cwd: worktreePath });
      await exec(`git push -u origin ${branchName.trim()}`, { cwd: worktreePath });

      // Create PR using gh CLI if available
      try {
        const prResult = await exec(
          `gh pr create --title "Fix: ${taskId}" --body "Automated fix via PocketDev" --base ${this.defaultBranch}`,
          { cwd: worktreePath }
        );
        return {
          success: true,
          prUrl: prResult.stdout.trim(),
          branch: branchName.trim()
        };
      } catch (ghError) {
        // gh CLI not available, return branch info
        return {
          success: true,
          branch: branchName.trim(),
          message: 'Branch pushed successfully. Please create PR manually.'
        };
      }
    } catch (error) {
      console.error('Failed to accept changes:', error);
      throw error;
    }
  }

  /**
   * Clean up a worktree
   */
  async cleanupWorktree(taskId) {
    const worktreePath = path.join(this.worktreeDir, taskId);
    
    try {
      // Remove worktree
      await exec(`git worktree remove "${worktreePath}" --force`, { cwd: this.baseRepo });
    } catch (error) {
      // Fallback to manual removal
      await rm(worktreePath, { recursive: true, force: true }).catch(() => {});
    }
  }

  /**
   * Generate a branch name from task info
   */
  generateBranchName(taskId, description) {
    const sanitized = description
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30);
    
    return `pocketdev/${sanitized}-${taskId.substring(0, 8)}`;
  }

  /**
   * List active worktrees
   */
  async listWorktrees() {
    try {
      const { stdout } = await exec('git worktree list --porcelain', { cwd: this.baseRepo });
      const worktrees = [];
      const lines = stdout.split('\n');
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].startsWith('worktree ')) {
          const worktreePath = lines[i].substring(9);
          if (worktreePath.includes('.pocketdev-worktrees')) {
            const taskId = path.basename(worktreePath);
            const branch = lines[i + 2]?.substring(7);
            worktrees.push({
              taskId,
              worktreePath,
              branch
            });
          }
        }
      }
      
      return worktrees;
    } catch (error) {
      console.error('Failed to list worktrees:', error);
      return [];
    }
  }
}