import { spawn } from 'node-pty';
import { WebSocketServer } from 'ws';

const sessions = new Map();

export function createTerminalWebSocketServer(port = 8080) {
  const wss = new WebSocketServer({ port });
  
  console.log(`Simple terminal WebSocket server listening on port ${port}`);
  
  wss.on('connection', (ws) => {
    let pty = null;
    let sessionId = null;
    
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data);
        
        switch (message.type) {
          case 'connect':
            sessionId = message.sessionId;
            
            // Check if session exists
            if (sessions.has(sessionId)) {
              pty = sessions.get(sessionId);
              ws.send(JSON.stringify({
                type: 'connect',
                status: 'reconnected',
                sessionId: sessionId
              }));
            } else {
              // Create new PTY
              pty = spawn('bash', [], {
                name: 'xterm-color',
                cols: message.cols || 80,
                rows: message.rows || 24,
                cwd: process.env.HOME,
                env: process.env
              });
              
              sessions.set(sessionId, pty);
              
              // Send PTY output to WebSocket
              pty.onData((data) => {
                if (ws.readyState === ws.OPEN) {
                  ws.send(data);
                }
              });
              
              ws.send(JSON.stringify({
                type: 'connect',
                status: 'connected',
                sessionId: sessionId
              }));
            }
            break;
            
          case 'input':
            if (pty) {
              pty.write(message.data);
            }
            break;
            
          case 'resize':
            if (pty) {
              pty.resize(message.cols, message.rows);
            }
            break;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });
    
    ws.on('close', () => {
      // Keep PTY alive for reconnection
      console.log('WebSocket closed for session:', sessionId);
    });
  });
  
  return wss;
}

// Create a session for a specific task
export function createTaskTerminalSession(taskId, worktreePath) {
  const sessionId = `task-${taskId}`;
  
  if (!sessions.has(sessionId)) {
    const pty = spawn('bash', [], {
      name: 'xterm-color',
      cols: 80,
      rows: 24,
      cwd: worktreePath,
      env: {
        ...process.env,
        TASK_ID: taskId,
        WORKTREE_PATH: worktreePath
      }
    });
    
    sessions.set(sessionId, pty);
  }
  
  return { sessionId, status: 'active' };
}