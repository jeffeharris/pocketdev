/**
 * Claude Code SDK Stream Integration for PocketDev
 * 
 * This demonstrates how we could integrate the stream-json format
 * into our containerized AI developer system for real-time updates
 */

const { spawn } = require('child_process');
const readline = require('readline');
const EventEmitter = require('events');

class ClaudeStreamExecutor extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      maxTurns: 10,
      allowedTools: ['Read', 'Write', 'Edit', 'Bash', 'LS'],
      verbose: false,
      ...options
    };
  }

  /**
   * Execute a task with Claude Code SDK in streaming mode
   * @param {string} prompt - The task prompt
   * @param {Object} context - Additional context (projectPath, etc)
   * @returns {Promise<Object>} - Execution result with all metadata
   */
  async executeTask(prompt, context = {}) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      const messages = [];
      let sessionId = null;
      let result = null;

      // Build command arguments
      const args = [
        '-p', prompt,
        '--output-format', 'stream-json',
        '--max-turns', this.options.maxTurns.toString()
      ];

      if (this.options.allowedTools?.length) {
        args.push('--allowedTools', this.options.allowedTools.join(','));
      }

      if (this.options.verbose) {
        args.push('--verbose');
      }

      // Spawn Claude process
      const claude = spawn('claude', args, {
        cwd: context.projectPath || process.cwd(),
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

          // Emit events based on message type
          this.handleMessage(message);

          // Store result message
          if (message.type === 'result') {
            result = message;
          }

        } catch (error) {
          this.emit('error', {
            type: 'parse_error',
            error: error.message,
            line: line
          });
        }
      });

      // Handle stderr
      claude.stderr.on('data', (data) => {
        this.emit('error', {
          type: 'stderr',
          message: data.toString()
        });
      });

      // Handle process completion
      claude.on('close', (code) => {
        const duration = Date.now() - startTime;

        if (code !== 0 && !result) {
          reject(new Error(`Claude process exited with code ${code}`));
          return;
        }

        resolve({
          sessionId,
          exitCode: code,
          duration,
          messages,
          result,
          stats: this.calculateStats(messages)
        });
      });

      // Handle process errors
      claude.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Handle individual messages and emit appropriate events
   */
  handleMessage(message) {
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          this.emit('init', {
            sessionId: message.session_id,
            tools: message.tools,
            mcpServers: message.mcp_servers
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
        // Parse assistant actions
        if (message.message?.content) {
          this.parseAssistantActions(message);
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
          result: message.result
        });
        break;
    }
  }

  /**
   * Parse assistant messages for tool usage
   */
  parseAssistantActions(message) {
    const content = message.message.content;
    
    if (Array.isArray(content)) {
      content.forEach(item => {
        if (item.type === 'tool_use') {
          this.emit('tool_use', {
            sessionId: message.session_id,
            toolName: item.name,
            toolId: item.id,
            input: item.input
          });
        }
      });
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
      toolCalls: 0
    };

    messages.forEach(msg => {
      if (msg.type === 'user') stats.userMessages++;
      if (msg.type === 'assistant') {
        stats.assistantMessages++;
        if (msg.message?.content && Array.isArray(msg.message.content)) {
          stats.toolCalls += msg.message.content.filter(c => c.type === 'tool_use').length;
        }
      }
    });

    return stats;
  }

  /**
   * Resume a previous session
   */
  async resumeSession(sessionId, prompt) {
    const args = [
      '-p',
      '--resume', sessionId,
      prompt,
      '--output-format', 'stream-json'
    ];

    // Similar implementation to executeTask but with resume flag
    // ... implementation details ...
  }
}

// Example usage for PocketDev integration
async function demonstrateIntegration() {
  console.log('🚀 Demonstrating Claude Stream Integration for PocketDev\n');

  const executor = new ClaudeStreamExecutor({
    maxTurns: 5,
    allowedTools: ['Read', 'Write', 'Edit', 'Bash'],
    verbose: false
  });

  // Set up event listeners for real-time updates
  executor.on('init', (data) => {
    console.log('✅ Session initialized:', data.sessionId);
    console.log('   Available tools:', data.tools.join(', '));
  });

  executor.on('tool_use', (data) => {
    console.log(`🔧 Tool used: ${data.toolName}`);
    // In PocketDev, we'd send this to the mobile app via WebSocket
  });

  executor.on('assistant_message', (data) => {
    console.log('💬 Assistant is working...');
    // In PocketDev, we'd update the task progress
  });

  executor.on('complete', (data) => {
    console.log('\n📊 Task completed!');
    console.log(`   Cost: $${data.cost}`);
    console.log(`   Duration: ${data.duration}ms`);
    console.log(`   Turns: ${data.turns}`);
  });

  executor.on('error', (error) => {
    console.error('❌ Error:', error);
  });

  try {
    // Execute a sample task
    const result = await executor.executeTask(
      'Create a simple TODO list component in React',
      { projectPath: '/tmp/test-project' }
    );

    console.log('\n📈 Execution Summary:');
    console.log(`   Session ID: ${result.sessionId}`);
    console.log(`   Total messages: ${result.stats.messageCount}`);
    console.log(`   Tool calls: ${result.stats.toolCalls}`);
    
    // This session ID can be stored in database for later resumption
    return result.sessionId;

  } catch (error) {
    console.error('Execution failed:', error);
  }
}

// Export for use in PocketDev
module.exports = { ClaudeStreamExecutor };

// Run demo if executed directly
if (require.main === module) {
  demonstrateIntegration().catch(console.error);
}