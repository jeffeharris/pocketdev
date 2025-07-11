#!/usr/bin/env node

/**
 * Experiment to understand Claude Code SDK's stream-json output format
 * This script will:
 * 1. Execute claude with stream-json format
 * 2. Parse and analyze each message type
 * 3. Help us understand how to integrate this into PocketDev
 */

const { spawn } = require('child_process');
const readline = require('readline');

// Configuration
const TEST_PROMPT = "Create a simple JavaScript function that calculates the factorial of a number";

// Message type counters and storage
const messageStats = {
  system: { count: 0, messages: [] },
  user: { count: 0, messages: [] },
  assistant: { count: 0, messages: [] },
  result: { count: 0, messages: [] }
};

console.log('🧪 Testing Claude Code SDK stream-json output format\n');
console.log(`Prompt: "${TEST_PROMPT}"\n`);
console.log('=' .repeat(80));

// Spawn claude process with stream-json output
const claude = spawn('claude', [
  '-p',
  TEST_PROMPT,
  '--output-format', 'stream-json',
  '--verbose'  // Required for stream-json with --print
], {
  env: { ...process.env },
  stdio: ['pipe', 'pipe', 'pipe']
});

// Create readline interface for parsing JSON lines
const rl = readline.createInterface({
  input: claude.stdout,
  crlfDelay: Infinity
});

// Parse each line as it arrives
rl.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    
    // Store message and update stats
    if (messageStats[message.type]) {
      messageStats[message.type].count++;
      messageStats[message.type].messages.push(message);
    }
    
    // Display message with formatting
    console.log(`\n📨 Message Type: ${message.type}${message.subtype ? ` (${message.subtype})` : ''}`);
    console.log('-'.repeat(40));
    
    switch (message.type) {
      case 'system':
        if (message.subtype === 'init') {
          console.log(`Session ID: ${message.session_id}`);
          console.log(`Tools: ${message.tools.join(', ')}`);
          if (message.mcp_servers?.length) {
            console.log('MCP Servers:');
            message.mcp_servers.forEach(server => {
              console.log(`  - ${server.name}: ${server.status}`);
            });
          }
        }
        break;
        
      case 'user':
        console.log(`Session ID: ${message.session_id}`);
        console.log('User Message:', JSON.stringify(message.message, null, 2).substring(0, 200) + '...');
        break;
        
      case 'assistant':
        console.log(`Session ID: ${message.session_id}`);
        console.log('Assistant Message Preview:');
        // Show a preview of the assistant's response
        if (message.message?.content) {
          const content = Array.isArray(message.message.content) 
            ? message.message.content[0]?.text || ''
            : message.message.content;
          console.log(content.substring(0, 500) + (content.length > 500 ? '...' : ''));
        }
        break;
        
      case 'result':
        console.log(`Subtype: ${message.subtype}`);
        console.log(`Session ID: ${message.session_id}`);
        console.log(`Cost: $${message.cost_usd}`);
        console.log(`Duration: ${message.duration_ms}ms (API: ${message.duration_api_ms}ms)`);
        console.log(`Turns: ${message.num_turns}`);
        console.log(`Error: ${message.is_error}`);
        if (message.result) {
          console.log(`Result Preview: ${message.result.substring(0, 200)}...`);
        }
        break;
    }
    
  } catch (error) {
    console.error('❌ Failed to parse JSON:', error.message);
    console.error('Raw line:', line);
  }
});

// Handle process exit
claude.on('close', (code) => {
  console.log('\n' + '='.repeat(80));
  console.log('\n📊 Summary Statistics:\n');
  
  Object.entries(messageStats).forEach(([type, stats]) => {
    if (stats.count > 0) {
      console.log(`${type.toUpperCase()} messages: ${stats.count}`);
    }
  });
  
  console.log('\n💡 Analysis for PocketDev Integration:\n');
  
  // Analyze what we learned
  const initMessage = messageStats.system.messages.find(m => m.subtype === 'init');
  const resultMessage = messageStats.result.messages[0];
  
  if (initMessage) {
    console.log('1. Session Management:');
    console.log(`   - Each conversation has a unique session_id: ${initMessage.session_id}`);
    console.log(`   - Available tools: ${initMessage.tools.length} tools`);
  }
  
  if (resultMessage) {
    console.log('\n2. Execution Metrics:');
    console.log(`   - Total execution time: ${resultMessage.duration_ms}ms`);
    console.log(`   - API call time: ${resultMessage.duration_api_ms}ms`);
    console.log(`   - Cost tracking: $${resultMessage.cost_usd}`);
    console.log(`   - Number of turns: ${resultMessage.num_turns}`);
  }
  
  console.log('\n3. Message Flow:');
  console.log('   - Init -> User -> Assistant -> ... -> Result');
  console.log('   - Each message is a separate JSON object (newline-delimited)');
  console.log('   - Real-time streaming allows progress monitoring');
  
  console.log('\n4. Integration Benefits for PocketDev:');
  console.log('   - Real-time progress updates for mobile UI');
  console.log('   - Cost tracking per task');
  console.log('   - Session persistence for resuming tasks');
  console.log('   - Detailed execution metrics');
  
  console.log(`\nProcess exited with code: ${code}`);
});

// Handle errors
claude.stderr.on('data', (data) => {
  console.error('❌ Claude stderr:', data.toString());
});

// Handle process errors
claude.on('error', (error) => {
  console.error('❌ Failed to start Claude:', error);
  process.exit(1);
});