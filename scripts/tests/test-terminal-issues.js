// Test script to verify the terminal creation issue
// This demonstrates the data structure mismatch

// Backend emits this structure:
const backendEmit = {
  terminal: {
    id: 'db-session-123',
    task_id: 'task-456',
    sessionId: 'task-456-db-session-123',
    tabName: 'Main',
    // ... other fields
  }
};

// WebSocketService broadcasts this:
const websocketBroadcast = {
  type: 'terminal-created',
  data: {
    terminal: backendEmit.terminal
  },
  taskId: 'task-456',
  timestamp: new Date().toISOString()
};

// Frontend WebSocketContext passes the entire message:
const dataPassedToHandler = websocketBroadcast;

// terminalStore expects to access:
console.log('Looking for data.taskId:', dataPassedToHandler.taskId); // ✓ Works
console.log('Looking for data.terminal:', dataPassedToHandler.terminal); // ✗ undefined
console.log('Actual terminal location:', dataPassedToHandler.data.terminal); // ✓ This is where it is

// The fix would be to update handleTerminalWebSocketEvent to handle the nested structure