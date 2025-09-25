#!/usr/bin/env node

// Test terminal deletion to understand the issue

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function testDeletion() {
  try {
    // First, let's see what terminals exist for task b0a4497b
    console.log('=== Current Terminals for Task b0a4497b ===');
    const { stdout: terminals } = await execPromise(
      `docker exec backend sqlite3 /app/data/pocketdev.db "SELECT id, tab_name, is_active, session_id FROM terminal_sessions WHERE task_id = 'b0a4497b' AND is_active = 1 ORDER BY tab_order;"`
    );
    console.log(terminals);
    
    // Let's try to call the deletion API for one of them
    const sessionIdToDelete = '2c9f1382'; // Tab 2
    console.log(`\n=== Attempting to delete session: ${sessionIdToDelete} ===`);
    
    // Make the API call
    const { stdout: deleteResult, stderr: deleteError } = await execPromise(
      `docker exec backend curl -X DELETE http://localhost:3005/api/terminals/${sessionIdToDelete} -H "Content-Type: application/json"`
    );
    
    if (deleteError) {
      console.error('Delete error:', deleteError);
    } else {
      console.log('Delete result:', deleteResult);
    }
    
    // Check if it was deleted
    console.log('\n=== Checking if session was deleted ===');
    const { stdout: checkResult } = await execPromise(
      `docker exec backend sqlite3 /app/data/pocketdev.db "SELECT id, tab_name, is_active FROM terminal_sessions WHERE id = '${sessionIdToDelete}';"`
    );
    console.log('Session after deletion:', checkResult || 'NOT FOUND - Successfully deleted');
    
    // Check WebSocket connections
    console.log('\n=== Checking WebSocket connections ===');
    const { stdout: wsConnections } = await execPromise(
      `docker exec backend sh -c "ps aux | grep -i websocket || echo 'No WebSocket processes found'"`
    );
    console.log(wsConnections);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testDeletion();