#!/usr/bin/env node

/**
 * Test Shelltender WebSocket directly to understand the protocol
 */

import WebSocket from 'ws';

const sessionId = process.argv[2] || 'task-1bf2f902-1753108787556';
const wsUrl = 'ws://localhost:8080/ws';

console.log(`Testing WebSocket connection to Shelltender`);
console.log(`Using session ID: ${sessionId}`);
console.log(`WebSocket URL: ${wsUrl}`);
console.log('---');

const ws = new WebSocket(wsUrl);

ws.on('open', () => {
  console.log('✓ WebSocket connected');
  
  // Shelltender v0.6.1 doesn't use "attach", just send input directly
  setTimeout(() => {
    const inputMsg = {
      type: 'input',
      sessionId: sessionId,
      data: 'echo "Test from WebSocket"\n'
    };
    console.log(`→ Sending: ${JSON.stringify(inputMsg)}`);
    ws.send(JSON.stringify(inputMsg));
    
    // Close after another delay
    setTimeout(() => {
      console.log('→ Closing connection');
      ws.close();
    }, 2000);
  }, 500);
});

ws.on('message', (data) => {
  try {
    const message = JSON.parse(data.toString());
    console.log(`← Received: ${JSON.stringify(message)}`);
  } catch (error) {
    console.log(`← Received (raw): ${data.toString()}`);
  }
});

ws.on('error', (error) => {
  console.error(`✗ Error: ${error.message}`);
});

ws.on('close', () => {
  console.log('✓ WebSocket closed');
  process.exit(0);
});