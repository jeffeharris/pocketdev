#!/usr/bin/env node

/**
 * Test different Claude Code SDK output modes
 * Compare text, json, and stream-json formats
 */

const { spawn } = require('child_process');
const readline = require('readline');

const PROMPT = "Write a function to reverse a string";

async function testTextMode() {
  console.log('\n📝 Testing TEXT mode...\n');
  
  return new Promise((resolve) => {
    const claude = spawn('claude', ['-p', PROMPT], {
      env: process.env
    });
    
    let output = '';
    claude.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
    });
    
    claude.on('close', (code) => {
      console.log(`\n✅ Text mode completed (exit code: ${code})`);
      resolve({ mode: 'text', output, exitCode: code });
    });
  });
}

async function testJsonMode() {
  console.log('\n📊 Testing JSON mode...\n');
  
  return new Promise((resolve) => {
    const claude = spawn('claude', ['-p', PROMPT, '--output-format', 'json'], {
      env: process.env
    });
    
    let output = '';
    claude.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    claude.on('close', (code) => {
      try {
        const result = JSON.parse(output);
        console.log('JSON Result:', JSON.stringify(result, null, 2));
        console.log(`\n✅ JSON mode completed (exit code: ${code})`);
        resolve({ mode: 'json', output: result, exitCode: code });
      } catch (error) {
        console.error('Failed to parse JSON:', error);
        resolve({ mode: 'json', error: error.message, exitCode: code });
      }
    });
  });
}

async function testStreamJsonMode() {
  console.log('\n🌊 Testing STREAM-JSON mode...\n');
  
  return new Promise((resolve) => {
    const claude = spawn('claude', ['-p', PROMPT, '--output-format', 'stream-json', '--verbose'], {
      env: process.env
    });
    
    const messages = [];
    const rl = readline.createInterface({
      input: claude.stdout,
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      try {
        const message = JSON.parse(line);
        messages.push(message);
        console.log(`[${message.type}${message.subtype ? ':' + message.subtype : ''}]`, 
          message.type === 'assistant' ? '(content received)' : '');
      } catch (error) {
        console.error('Parse error:', error.message);
      }
    });
    
    claude.on('close', (code) => {
      console.log(`\n✅ Stream-JSON mode completed (exit code: ${code})`);
      console.log(`Total messages received: ${messages.length}`);
      resolve({ mode: 'stream-json', messages, exitCode: code });
    });
  });
}

async function runTests() {
  console.log('🧪 Claude Code SDK Output Format Comparison\n');
  console.log('=' .repeat(60));
  
  const results = [];
  
  // Test each mode
  results.push(await testTextMode());
  results.push(await testJsonMode());
  results.push(await testStreamJsonMode());
  
  // Compare results
  console.log('\n\n📋 COMPARISON SUMMARY');
  console.log('=' .repeat(60));
  
  results.forEach(result => {
    console.log(`\n${result.mode.toUpperCase()} Mode:`);
    
    switch (result.mode) {
      case 'text':
        console.log('- Simple text output');
        console.log('- No metadata or structure');
        console.log('- Best for simple CLI integration');
        break;
        
      case 'json':
        if (result.output) {
          console.log('- Single JSON object with all data');
          console.log(`- Cost: $${result.output.cost_usd}`);
          console.log(`- Duration: ${result.output.duration_ms}ms`);
          console.log(`- Session ID: ${result.output.session_id}`);
          console.log('- Best for batch processing');
        }
        break;
        
      case 'stream-json':
        if (result.messages) {
          const init = result.messages.find(m => m.type === 'system' && m.subtype === 'init');
          const resultMsg = result.messages.find(m => m.type === 'result');
          
          console.log('- Newline-delimited JSON stream');
          console.log(`- ${result.messages.length} total messages`);
          console.log(`- Session ID: ${init?.session_id}`);
          if (resultMsg) {
            console.log(`- Cost: $${resultMsg.cost_usd}`);
            console.log(`- Duration: ${resultMsg.duration_ms}ms`);
          }
          console.log('- Best for real-time progress monitoring');
          console.log('- Enables streaming UI updates');
        }
        break;
    }
  });
  
  console.log('\n\n🎯 Recommendation for PocketDev:');
  console.log('- Use stream-json for container tasks (real-time progress)');
  console.log('- Parse messages to show live updates in mobile UI');
  console.log('- Track costs and duration for each AI developer task');
  console.log('- Use session_id for task persistence/resume');
}

// Run all tests
runTests().catch(console.error);