#!/usr/bin/env node

/**
 * Test script for pre-flight validation
 * Tests various failure scenarios to ensure proper error handling
 */

import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

async function testPreflightValidation() {
  console.log('🧪 Testing Pre-flight Validation System\n');

  // Test 1: Missing API Key
  console.log('Test 1: Missing API Key');
  const originalApiKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'test-engineer',
        repository: 'https://github.com/test/repo',
        description: 'Test task',
        acceptanceCriteria: ['Should work']
      })
    });
    
    const data = await response.json();
    if (data.preflightFailed && data.validationErrors.some(e => e.check === 'apiKey')) {
      console.log('✅ Correctly caught missing API key\n');
    } else {
      console.log('❌ Failed to catch missing API key\n');
    }
  } catch (error) {
    console.log('❌ Test error:', error.message, '\n');
  }
  
  // Restore API key
  if (originalApiKey) process.env.ANTHROPIC_API_KEY = originalApiKey;

  // Test 2: Invalid Repository
  console.log('Test 2: Invalid Repository URL');
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'test-engineer',
        repository: 'not-a-valid-url',
        description: 'Test task',
        acceptanceCriteria: ['Should work']
      })
    });
    
    const data = await response.json();
    if (data.preflightFailed && data.validationErrors.some(e => e.check === 'repository')) {
      console.log('✅ Correctly caught invalid repository URL\n');
    } else {
      console.log('❌ Failed to catch invalid repository URL\n');
    }
  } catch (error) {
    console.log('❌ Test error:', error.message, '\n');
  }

  // Test 3: Missing Task Description
  console.log('Test 3: Missing Task Description');
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'test-engineer',
        repository: 'https://github.com/test/repo',
        description: '',
        acceptanceCriteria: []
      })
    });
    
    const data = await response.json();
    if (data.preflightFailed && data.validationErrors.some(e => e.check === 'taskConfig')) {
      console.log('✅ Correctly caught missing task description\n');
    } else {
      console.log('❌ Failed to catch missing task description\n');
    }
  } catch (error) {
    console.log('❌ Test error:', error.message, '\n');
  }

  // Test 4: Invalid Git Credentials
  console.log('Test 4: Invalid Git Credentials');
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'test-engineer',
        repository: {
          url: 'https://github.com/private/repo',
          credentials: {
            username: 'test',
            token: 'invalid-token'
          }
        },
        description: 'Test private repo access',
        acceptanceCriteria: ['Should work']
      })
    });
    
    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.log('❌ Test error:', error.message, '\n');
  }

  console.log('✅ Pre-flight validation tests complete!');
}

// Run tests
testPreflightValidation().catch(console.error);