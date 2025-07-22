/**
 * Execute a command in a Shelltender session via WebSocket
 * 
 * This replaces the incorrect HTTP-based implementation in shelltender-client.js
 */

import WebSocket from 'ws';

export async function executeCommandViaWebSocket(sessionId, command) {
  const wsUrl = process.env.SHELLTENDER_WS_URL || 'ws://localhost:8080/ws';
  
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let commandSent = false;
    
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('Command execution timeout'));
    }, 5000);
    
    ws.on('open', () => {
      console.log(`[executeCommand] WebSocket opened for session ${sessionId}`);
      
      // Send the command directly (no attach needed in v0.6.1)
      setTimeout(() => {
        if (!commandSent) {
          commandSent = true;
          console.log(`[executeCommand] Sending command: ${command}`);
          ws.send(JSON.stringify({
            type: 'input',
            sessionId: sessionId,
            data: command + '\n'
          }));
          
          // Give it a moment for the command to be processed
          setTimeout(() => {
            clearTimeout(timeout);
            ws.close();
            resolve({ success: true, command, sessionId });
          }, 200);
        }
      }, 100); // Small delay to ensure connection is ready
    });
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        // Handle errors
        if (message.type === 'error') {
          clearTimeout(timeout);
          ws.close();
          reject(new Error(message.data || message.message || 'Unknown error'));
        }
        
        // Log message for debugging
        console.log(`[executeCommand] Received: ${JSON.stringify(message)}`);
      } catch (error) {
        console.error('[executeCommand] Error parsing message:', error);
      }
    });
    
    ws.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    
    ws.on('close', () => {
      clearTimeout(timeout);
      if (!commandSent) {
        reject(new Error('Connection closed before command could be sent'));
      }
    });
  });
}

// Alternative: Use the existing session monitor if available
export async function executeCommandViaMonitor(sessionId, command, monitor) {
  if (!monitor) {
    throw new Error('Session monitor not available');
  }
  
  // Ensure we're connected to the session
  if (!monitor.sessions.has(sessionId)) {
    await monitor.connectToSession(sessionId);
    // Wait a bit for connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Send the input
  monitor.sendInput(sessionId, command + '\n');
  
  return { success: true, command, sessionId };
}