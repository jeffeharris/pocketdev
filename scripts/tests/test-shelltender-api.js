#!/usr/bin/env node

/**
 * Test script for Shelltender API integration
 * Run with: node test-shelltender-api.js
 */

const API_BASE = 'http://localhost:3005/api';

// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

async function makeRequest(url, options = {}) {
    try {
        log(`\n→ ${options.method || 'GET'} ${url}`, 'cyan');
        if (options.body) {
            log(`  Body: ${options.body}`, 'cyan');
        }
        
        const response = await fetch(API_BASE + url, {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        });

        const text = await response.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${JSON.stringify(data)}`);
        }

        log(`✓ Success: ${JSON.stringify(data, null, 2)}`, 'green');
        return data;
    } catch (error) {
        log(`✗ Error: ${error.message}`, 'red');
        throw error;
    }
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testBasicEndpoints() {
    log('\n=== Testing Basic Endpoints ===', 'yellow');
    
    try {
        // Test listing sessions
        log('\n1. Listing all sessions:', 'blue');
        const sessions = await makeRequest('/sessions');
        
        // Find an existing task session to use
        const existingTaskSession = sessions.find(s => s.id.startsWith('task-'));
        if (existingTaskSession) {
            log(`\nFound existing task session: ${existingTaskSession.id}`, 'green');
            return { sessionId: existingTaskSession.id };
        }
        
        // If no task sessions exist, try to use a test session
        log('\n2. No task sessions found, creating a test session directly with Shelltender:', 'blue');
        
        // First check if we can create sessions directly
        try {
            const response = await fetch('http://localhost:8080/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: `test-api-${Date.now()}`,
                    name: 'API Test Session',
                    command: 'bash',
                    cwd: '/tmp'
                })
            });
            
            if (response.ok) {
                const session = await response.json();
                log(`Created test session: ${session.id}`, 'green');
                return { sessionId: session.id };
            }
        } catch (error) {
            log('Could not create test session directly', 'yellow');
        }
        
        log('\nNo suitable session found or created', 'red');
        return null;
    } catch (error) {
        log('Basic endpoint test failed', 'red');
        return null;
    }
}

async function testCommandExecution(sessionId) {
    log('\n=== Testing Command Execution ===', 'yellow');
    
    try {
        // Test executing a simple command
        log('\n1. Executing echo command:', 'blue');
        await makeRequest(`/sessions/${sessionId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ command: 'echo "Hello from API test"' })
        });
        
        // Test executing empty command (newline)
        log('\n2. Sending newline:', 'blue');
        await makeRequest(`/sessions/${sessionId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ command: '' })
        });
        
        return true;
    } catch (error) {
        log('Command execution test failed', 'red');
        return false;
    }
}

async function testClaudeLaunch(sessionId) {
    log('\n=== Testing Claude Launch ===', 'yellow');
    
    try {
        log('Waiting 2 seconds for terminal to be ready...', 'blue');
        await sleep(2000);
        
        log('Sending newline to ensure prompt...', 'blue');
        await makeRequest(`/sessions/${sessionId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ command: '' })
        });
        
        await sleep(500);
        
        log('Launching Claude...', 'blue');
        await makeRequest(`/sessions/${sessionId}/execute`, {
            method: 'POST',
            body: JSON.stringify({ command: 'claude' })
        });
        
        log('\n✓ Claude launch sequence completed!', 'green');
        return true;
    } catch (error) {
        log('Claude launch test failed', 'red');
        return false;
    }
}

async function runAllTests() {
    log('=== PocketDev Shelltender API Test Suite ===', 'yellow');
    log('Make sure the PocketDev backend is running on port 3005\n', 'cyan');
    
    try {
        // Test basic endpoints and create a session
        const session = await testBasicEndpoints();
        if (!session || !session.sessionId) {
            log('\nCannot continue without a valid session', 'red');
            return;
        }
        
        log(`\nUsing session ID: ${session.sessionId}`, 'cyan');
        
        // Test command execution
        const commandOk = await testCommandExecution(session.sessionId);
        if (!commandOk) {
            log('\nCommand execution failed, skipping Claude launch test', 'red');
            return;
        }
        
        // Test Claude launch
        await testClaudeLaunch(session.sessionId);
        
        log('\n=== All tests completed ===', 'green');
        log(`\nCheck the terminal at http://localhost:8080 to see if commands were executed`, 'cyan');
        log(`Session ID: ${session.sessionId}`, 'cyan');
        
    } catch (error) {
        log(`\nUnexpected error: ${error.message}`, 'red');
    }
}

// Run the tests
runAllTests();