/**
 * Claude Code SDK Stream Executor for PocketDev
 * Provides real-time streaming updates from Claude executions
 */

import { spawn } from 'child_process';
import { EventEmitter } from 'events';
import readline from 'readline';
import { v4 as uuidv4 } from 'uuid';

export class ClaudeStreamExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxTurns: 10,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'LS', 'Grep', 'Glob'],
      verbose: false,
      ...options
    };
  }

  /**
   * Execute a task with Claude Code SDK in streaming mode
   * @param {string} prompt - The task prompt
   * @param {Object} context - Additional context (apiKey, systemPrompt, etc)
   * @returns {Promise<Object>} - Execution result with all metadata
   */
  async executeStreamingTask(prompt, context = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const messages = [];
      const toolUses = [];
      let sessionId = null;
      let result = null;
      let costAccumulator = 0;

      // Build command arguments
      const args = [
        '-p', // Print mode (required for streaming)
        '--output-format', 'stream-json',
        '--verbose', // Required for stream-json with -p
        '--max-turns', this.options.maxTurns.toString()
      ];

      // Add allowed tools
      if (this.options.allowedTools?.length) {
        args.push('--allowedTools', this.options.allowedTools.join(','));
      }

      // Add system prompt if provided
      if (context.systemPrompt) {
        args.push('--append-system-prompt', context.systemPrompt);
      }

      // Resume session if provided
      if (context.sessionId) {
        args.push('--resume', context.sessionId);
      }

      // Add the prompt as the last argument
      args.push(prompt);

      // Debug logging
      console.log('[ClaudeStreamExecutor] Starting execution with args:', args.map(a => 
        a.length > 100 ? a.substring(0, 100) + '...' : a
      ));

      // Spawn Claude process
      const claude = spawn('claude', args, {
        cwd: context.workingDirectory || process.cwd(),
        env: {
          ...process.env,
          ANTHROPIC_API_KEY: context.apiKey || process.env.ANTHROPIC_API_KEY
        }
      });

      // Create readline interface for parsing JSON lines
      const rl = readline.createInterface({
        input: claude.stdout,
        crlfDelay: Infinity
      });

      // Parse each message as it arrives
      rl.on('line', (line) => {
        try {
          const message = JSON.parse(line);
          messages.push(message);

          // Extract session ID from first message
          if (!sessionId && message.session_id) {
            sessionId = message.session_id;
          }

          // Handle different message types
          this.handleStreamMessage(message, toolUses);

          // Track cost accumulation
          if (message.type === 'result' && message.cost_usd) {
            costAccumulator = message.cost_usd;
          }

        } catch (error) {
          console.error('[ClaudeStreamExecutor] Failed to parse JSON:', error.message);
          console.error('Raw line:', line);
          
          this.emit('parse_error', {
            error: error.message,
            line: line
          });
        }
      });

      // Handle stderr
      let stderrOutput = '';
      claude.stderr.on('data', (data) => {
        stderrOutput += data.toString();
        console.error('[ClaudeStreamExecutor] stderr:', data.toString());
        
        this.emit('error', {
          type: 'stderr',
          message: data.toString()
        });
      });

      // Handle process completion
      claude.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code !== 0 && !result) {
          // Find result message
          result = messages.find(m => m.type === 'result');
          
          if (!result) {
            reject(new Error(`Claude process exited with code ${code}. stderr: ${stderrOutput}`));
            return;
          }
        }

        // Find final result message
        const finalResult = messages.find(m => m.type === 'result') || {};

        resolve({
          success: finalResult.subtype === 'success',
          sessionId,
          exitCode: code,
          duration,
          messages,
          toolUses,
          cost: finalResult.cost_usd || costAccumulator,
          apiDuration: finalResult.duration_api_ms,
          numTurns: finalResult.num_turns,
          result: finalResult.result,
          stats: this.calculateStats(messages)
        });
      });

      // Handle process errors
      claude.on('error', (error) => {
        console.error('[ClaudeStreamExecutor] Process error:', error);
        reject(error);
      });
    });
  }

  /**
   * Handle individual streaming messages and emit appropriate events
   */
  handleStreamMessage(message, toolUses) {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          this.emit('init', {
            sessionId: message.session_id,
            tools: message.tools,
            model: message.model,
            cwd: message.cwd
          });
        }
        break;

      case 'user':
        this.emit('user_message', {
          sessionId: message.session_id,
          content: message.message
        });
        break;

      case 'assistant':
        // Extract tool uses from assistant messages
        if (message.message?.content && Array.isArray(message.message.content)) {
          message.message.content.forEach(item => {
            if (item.type === 'tool_use') {
              const toolUse = {
                name: item.name,
                id: item.id,
                input: item.input,
                timestamp: new Date()
              };
              toolUses.push(toolUse);
              
              this.emit('tool_use', {
                sessionId: message.session_id,
                ...toolUse
              });
            } else if (item.type === 'text' && item.text) {
              // Emit text updates for progress monitoring
              this.emit('assistant_text', {
                sessionId: message.session_id,
                text: item.text
              });
            }
          });
        }
        
        this.emit('assistant_message', {
          sessionId: message.session_id,
          content: message.message
        });
        break;

      case 'result':
        this.emit('complete', {
          sessionId: message.session_id,
          success: message.subtype === 'success',
          cost: message.cost_usd,
          duration: message.duration_ms,
          apiDuration: message.duration_api_ms,
          turns: message.num_turns,
          result: message.result,
          error: message.subtype === 'error_max_turns' ? 'Max turns reached' : null
        });
        break;
    }
  }

  /**
   * Calculate statistics from messages
   */
  calculateStats(messages) {
    const stats = {
      messageCount: messages.length,
      userMessages: 0,
      assistantMessages: 0,
      toolCalls: 0,
      messageTypes: {}
    };

    messages.forEach(msg => {
      // Count message types
      const typeKey = msg.type + (msg.subtype ? ':' + msg.subtype : '');
      stats.messageTypes[typeKey] = (stats.messageTypes[typeKey] || 0) + 1;

      // Count specific types
      if (msg.type === 'user') stats.userMessages++;
      if (msg.type === 'assistant') {
        stats.assistantMessages++;
        
        // Count tool uses
        if (msg.message?.content && Array.isArray(msg.message.content)) {
          stats.toolCalls += msg.message.content.filter(c => c.type === 'tool_use').length;
        }
      }
    });

    return stats;
  }
}

export default ClaudeStreamExecutor;