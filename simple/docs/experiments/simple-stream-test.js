#!/usr/bin/env node

// Simple direct test of Claude stream-json format
const { execSync } = require('child_process');

console.log('🧪 Direct Claude Stream-JSON Test\n');

try {
  // Load environment
  require('dotenv').config();
  
  // Execute claude command and capture output
  const output = execSync(
    'claude -p "Write a simple add function" --output-format stream-json --verbose',
    { encoding: 'utf8' }
  );
  
  // Split into individual JSON messages
  const messages = output.trim().split('\n').map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.error('Failed to parse:', line);
      return null;
    }
  }).filter(Boolean);
  
  console.log(`📊 Received ${messages.length} messages:\n`);
  
  messages.forEach((msg, i) => {
    console.log(`${i + 1}. Type: ${msg.type}${msg.subtype ? ` (${msg.subtype})` : ''}`);
    
    if (msg.type === 'system' && msg.subtype === 'init') {
      console.log(`   - Session: ${msg.session_id}`);
      console.log(`   - Tools: ${msg.tools.length} available`);
      console.log(`   - Model: ${msg.model}`);
    } else if (msg.type === 'assistant') {
      const content = msg.message?.content?.[0]?.text || '';
      console.log(`   - Content: ${content.substring(0, 50)}...`);
    } else if (msg.type === 'result') {
      console.log(`   - Cost: $${msg.cost_usd}`);
      console.log(`   - Duration: ${msg.duration_ms}ms`);
      console.log(`   - Success: ${msg.subtype === 'success'}`);
    }
  });
  
  console.log('\n✅ Test completed successfully!');
  
} catch (error) {
  console.error('❌ Error:', error.message);
}