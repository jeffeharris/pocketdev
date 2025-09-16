#!/usr/bin/env node

// Comprehensive analysis of Claude stream-json format
const { exec } = require('child_process');
const readline = require('readline');
require('dotenv').config();

const testCases = [
  {
    name: "Simple function creation",
    prompt: "Write a function that returns 'Hello, World!'",
    expectedTools: []
  },
  {
    name: "File operation task",
    prompt: "Create a file called test.txt with the content 'Hello from Claude'",
    expectedTools: ['Write']
  },
  {
    name: "Multi-step task",
    prompt: "Read the package.json file and tell me the project name",
    expectedTools: ['Read']
  }
];

async function analyzeStreamFormat(testCase) {
  console.log(`\n📋 Test: ${testCase.name}`);
  console.log(`📝 Prompt: "${testCase.prompt}"`);
  console.log('-'.repeat(60));
  
  return new Promise((resolve) => {
    const messages = [];
    const toolUses = [];
    let sessionId = null;
    let startTime = Date.now();
    
    const claude = exec(
      `claude -p "${testCase.prompt}" --output-format stream-json --verbose`,
      { env: process.env }
    );
    
    const rl = readline.createInterface({
      input: claude.stdout,
      crlfDelay: Infinity
    });
    
    rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        messages.push(msg);
        
        // Extract session ID
        if (!sessionId && msg.session_id) {
          sessionId = msg.session_id;
        }
        
        // Track tool uses
        if (msg.type === 'assistant' && msg.message?.content) {
          const content = msg.message.content;
          if (Array.isArray(content)) {
            content.forEach(item => {
              if (item.type === 'tool_use') {
                toolUses.push({
                  name: item.name,
                  id: item.id,
                  input: item.input
                });
              }
            });
          }
        }
        
      } catch (e) {
        console.error('Parse error:', e.message);
      }
    });
    
    claude.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      const analysis = {
        testCase: testCase.name,
        sessionId,
        messageCount: messages.length,
        messageTypes: {},
        toolUses,
        duration,
        exitCode: code
      };
      
      // Count message types
      messages.forEach(msg => {
        const key = msg.type + (msg.subtype ? ':' + msg.subtype : '');
        analysis.messageTypes[key] = (analysis.messageTypes[key] || 0) + 1;
      });
      
      // Extract result details
      const resultMsg = messages.find(m => m.type === 'result');
      if (resultMsg) {
        analysis.result = {
          success: resultMsg.subtype === 'success',
          cost: resultMsg.cost_usd,
          duration: resultMsg.duration_ms,
          apiDuration: resultMsg.duration_api_ms,
          turns: resultMsg.num_turns
        };
      }
      
      // Extract init details
      const initMsg = messages.find(m => m.type === 'system' && m.subtype === 'init');
      if (initMsg) {
        analysis.init = {
          tools: initMsg.tools,
          model: initMsg.model,
          cwd: initMsg.cwd
        };
      }
      
      resolve(analysis);
    });
  });
}

async function runAnalysis() {
  console.log('🔬 Claude Code SDK Stream-JSON Format Analysis');
  console.log('=' .repeat(60));
  
  const results = [];
  
  for (const testCase of testCases) {
    const analysis = await analyzeStreamFormat(testCase);
    results.push(analysis);
    
    // Display results
    console.log('\n📊 Results:');
    console.log(`   Session ID: ${analysis.sessionId}`);
    console.log(`   Messages: ${analysis.messageCount}`);
    console.log(`   Message breakdown:`, analysis.messageTypes);
    if (analysis.toolUses.length > 0) {
      console.log(`   Tools used: ${analysis.toolUses.map(t => t.name).join(', ')}`);
    }
    if (analysis.result) {
      console.log(`   Cost: $${analysis.result.cost}`);
      console.log(`   API Duration: ${analysis.result.apiDuration}ms`);
      console.log(`   Turns: ${analysis.result.turns}`);
    }
  }
  
  console.log('\n\n📝 SUMMARY REPORT');
  console.log('=' .repeat(60));
  
  console.log('\n1. Message Flow Pattern:');
  console.log('   - Always starts with system:init message');
  console.log('   - Contains user/assistant message pairs');
  console.log('   - Always ends with result message');
  
  console.log('\n2. Key Data Points:');
  console.log('   - Session ID is consistent across all messages');
  console.log('   - Cost tracking in USD (very precise)');
  console.log('   - Detailed timing metrics (total vs API time)');
  console.log('   - Tool usage can be extracted from assistant messages');
  
  console.log('\n3. Integration Insights:');
  console.log('   - Each line is a complete JSON object (newline-delimited)');
  console.log('   - Real-time streaming allows progress tracking');
  console.log('   - Tool calls are embedded in assistant messages');
  console.log('   - Error states reported via result subtype');
  
  console.log('\n4. PocketDev Benefits:');
  console.log('   - Show real-time progress in mobile UI');
  console.log('   - Track costs per AI developer task');
  console.log('   - Monitor tool usage for security/permissions');
  console.log('   - Resume sessions using session_id');
  console.log('   - Measure performance and optimize');
}

runAnalysis().catch(console.error);