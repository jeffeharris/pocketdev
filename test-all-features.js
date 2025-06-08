#!/usr/bin/env node

/**
 * Comprehensive test suite for all features
 * Tests: Pre-flight validation, Progress monitoring, Task execution
 */

import fetch from 'node-fetch';
import { spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

const API_BASE = 'http://localhost:3001';
const TEST_RESULTS = [];

// Helper to add test result
function addResult(test, passed, details = '') {
  TEST_RESULTS.push({ test, passed, details });
  console.log(`${passed ? '✅' : '❌'} ${test}${details ? ': ' + details : ''}`);
}

// Helper to wait
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Test 1: Pre-flight Validation - Missing API Key
async function testPreflightMissingApiKey() {
  console.log('\n🧪 Test 1: Pre-flight Validation - Missing API Key');
  
  const originalKey = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  
  // Restart the server without API key
  console.log('Restarting server without API key...');
  const serverProcess = spawn('npm', ['run', 'server'], {
    cwd: '/home/jeffh/projects/pocketdev/local-backend',
    env: { ...process.env, ANTHROPIC_API_KEY: undefined }
  });
  
  await wait(3000); // Wait for server to start
  
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'frontend',
        repository: 'https://github.com/test/repo',
        description: 'Test task',
        acceptanceCriteria: ['Should work']
      })
    });
    
    const data = await response.json();
    
    if (data.preflightFailed && data.validationErrors?.some(e => e.check === 'apiKey')) {
      addResult('Pre-flight catches missing API key', true);
    } else {
      addResult('Pre-flight catches missing API key', false, 'Did not detect missing key');
    }
  } catch (error) {
    addResult('Pre-flight catches missing API key', false, error.message);
  }
  
  // Kill server and restore
  serverProcess.kill();
  if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
  await wait(1000);
}

// Test 2: Pre-flight Validation - Invalid Repository
async function testPreflightInvalidRepo() {
  console.log('\n🧪 Test 2: Pre-flight Validation - Invalid Repository');
  
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'frontend',
        repository: 'not-a-valid-url',
        description: 'Test invalid repo',
        acceptanceCriteria: ['Should fail validation']
      })
    });
    
    const data = await response.json();
    
    if (data.preflightFailed && data.validationErrors?.some(e => e.message.includes('Invalid repository URL format'))) {
      addResult('Pre-flight catches invalid repository', true);
    } else {
      addResult('Pre-flight catches invalid repository', false, 'Did not detect invalid URL');
    }
  } catch (error) {
    addResult('Pre-flight catches invalid repository', false, error.message);
  }
}

// Test 3: Pre-flight Validation - Missing Description
async function testPreflightMissingDescription() {
  console.log('\n🧪 Test 3: Pre-flight Validation - Missing Description');
  
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'frontend',
        repository: 'https://github.com/test/repo',
        description: '',
        acceptanceCriteria: []
      })
    });
    
    const data = await response.json();
    
    if (data.preflightFailed && data.validationErrors?.some(e => e.message.includes('description'))) {
      addResult('Pre-flight catches missing description', true);
    } else {
      addResult('Pre-flight catches missing description', false, 'Did not detect missing description');
    }
  } catch (error) {
    addResult('Pre-flight catches missing description', false, error.message);
  }
}

// Test 4: Progress Monitoring
async function testProgressMonitoring() {
  console.log('\n🧪 Test 4: Progress Monitoring');
  
  // Create a simple test task
  try {
    const assignResponse = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'frontend',
        repository: 'https://github.com/octocat/Hello-World',
        description: 'Add a simple test file that prints hello',
        acceptanceCriteria: ['Create hello.js that logs "Hello, World!"'],
        model: 'claude-3-haiku-20240307' // Use cheaper model for testing
      })
    });
    
    if (!assignResponse.ok) {
      const error = await assignResponse.json();
      addResult('Task assignment for progress test', false, error.error);
      return;
    }
    
    const assignData = await assignResponse.json();
    const taskId = assignData.task?.id;
    
    if (!taskId) {
      addResult('Task assignment for progress test', false, 'No task ID returned');
      return;
    }
    
    addResult('Task assignment for progress test', true, `Task ID: ${taskId}`);
    
    // Monitor progress for 30 seconds
    console.log('Monitoring progress for 30 seconds...');
    let progressFound = false;
    let checkpoints = [];
    
    for (let i = 0; i < 15; i++) {
      await wait(2000);
      
      try {
        const progressResponse = await fetch(`${API_BASE}/api/container/tasks/${taskId}/progress`);
        if (progressResponse.ok) {
          const progress = await progressResponse.json();
          
          if (progress.checkpoints && progress.checkpoints.length > 0) {
            progressFound = true;
            checkpoints = progress.checkpoints;
            console.log(`  Progress: ${progress.summary.message} (${progress.summary.elapsed})`);
          }
        }
      } catch (err) {
        console.error('Progress check error:', err);
      }
    }
    
    if (progressFound) {
      addResult('Progress monitoring works', true, `${checkpoints.length} checkpoints recorded`);
    } else {
      addResult('Progress monitoring works', false, 'No progress checkpoints found');
    }
    
    // Stop the task
    await fetch(`${API_BASE}/api/container/tasks/${taskId}/stop`, { method: 'POST' });
    
  } catch (error) {
    addResult('Progress monitoring test', false, error.message);
  }
}

// Test 5: Error Recovery (Verification Script)
async function testErrorRecovery() {
  console.log('\n🧪 Test 5: Error Recovery - Wrong Verification Script Name');
  
  try {
    // This task should create test.js instead of verify.js
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'backend',
        repository: 'https://github.com/octocat/Hello-World',
        description: 'Create a function that adds two numbers and a test file named test.js',
        acceptanceCriteria: [
          'Create add.js with function add(a, b) that returns a + b',
          'Create test.js (not verify.js) to test the function'
        ],
        model: 'claude-3-haiku-20240307'
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      addResult('Error recovery task assignment', false, error.error);
      return;
    }
    
    const data = await response.json();
    const taskId = data.task?.id;
    
    console.log('Waiting for task to complete (up to 2 minutes)...');
    let taskComplete = false;
    let finalResult = null;
    
    for (let i = 0; i < 60; i++) {
      await wait(2000);
      
      const statusResponse = await fetch(`${API_BASE}/api/container/tasks/${taskId}`);
      if (statusResponse.ok) {
        const task = await statusResponse.json();
        
        if (task.status === 'completed' || task.status === 'failed') {
          taskComplete = true;
          finalResult = task.result;
          break;
        }
      }
    }
    
    if (taskComplete && finalResult) {
      // Check if it recovered from wrong filename
      const logs = finalResult.logs || [];
      const foundAlternative = logs.some(log => 
        log.message.includes('Found test.js') || 
        log.message.includes('verification script')
      );
      
      if (foundAlternative) {
        addResult('Error recovery detects wrong filename', true);
      } else {
        addResult('Error recovery detects wrong filename', false, 'Did not detect alternative');
      }
    } else {
      addResult('Error recovery test', false, 'Task did not complete');
    }
    
  } catch (error) {
    addResult('Error recovery test', false, error.message);
  }
}

// Test 6: UI Error Display
async function testUIErrorDisplay() {
  console.log('\n🧪 Test 6: UI Error Display');
  
  // This is more of a manual test, but we can verify the API returns proper format
  try {
    const response = await fetch(`${API_BASE}/api/container/assign-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        engineerId: 'frontend',
        repository: 'https://github.com/private/repo',
        description: 'Test private repo without credentials',
        acceptanceCriteria: ['Should show warning about credentials']
      })
    });
    
    const data = await response.json();
    
    if (data.validationWarnings && data.validationWarnings.length > 0) {
      addResult('UI receives validation warnings', true, 'Warnings included in response');
    } else if (data.preflightFailed) {
      addResult('UI receives validation errors', true, 'Errors included in response');
    } else {
      addResult('UI error format', false, 'No validation feedback provided');
    }
  } catch (error) {
    addResult('UI error display test', false, error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🧪 PocketDev Feature Test Suite');
  console.log('================================\n');
  
  // Check if server is running
  try {
    const health = await fetch(`${API_BASE}/api/container/engineers`);
    if (!health.ok) throw new Error('Server not responding');
  } catch (error) {
    console.error('❌ Server is not running! Start it with: cd local-backend && npm start');
    process.exit(1);
  }
  
  // Run all tests
  await testPreflightMissingApiKey();
  await testPreflightInvalidRepo();
  await testPreflightMissingDescription();
  await testProgressMonitoring();
  await testErrorRecovery();
  await testUIErrorDisplay();
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('================');
  
  const passed = TEST_RESULTS.filter(r => r.passed).length;
  const failed = TEST_RESULTS.filter(r => !r.passed).length;
  
  console.log(`Total: ${TEST_RESULTS.length}`);
  console.log(`Passed: ${passed} ✅`);
  console.log(`Failed: ${failed} ❌`);
  
  if (failed > 0) {
    console.log('\nFailed tests:');
    TEST_RESULTS.filter(r => !r.passed).forEach(r => {
      console.log(`  ❌ ${r.test}: ${r.details}`);
    });
  }
  
  // Save detailed results
  await fs.writeFile(
    'test-results.json',
    JSON.stringify({ 
      timestamp: new Date().toISOString(),
      summary: { total: TEST_RESULTS.length, passed, failed },
      results: TEST_RESULTS 
    }, null, 2)
  );
  
  console.log('\nDetailed results saved to test-results.json');
  
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch(console.error);