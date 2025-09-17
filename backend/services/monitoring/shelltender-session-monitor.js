/**
 * Shelltender Session Monitor for v0.6.2
 * 
 * This implementation connects to individual task sessions to monitor their output,
 * since Shelltender v0.6.2 doesn't have a global monitor mode.
 */

import WebSocket from 'ws';
import EventEmitter from 'events';

export class ShelltenderSessionMonitor extends EventEmitter {
  constructor(wsUrl, eventEmitterService = null) {
    super();
    this.wsUrl = wsUrl || process.env.SHELLTENDER_WS_URL || 'ws://localhost:8080/ws';
    this.sessions = new Map(); // sessionId -> WebSocket connection
    this.dataCallbacks = [];
    this.reconnectInterval = 5000;
    this.eventEmitterService = eventEmitterService;
  }

  /**
   * Connect to a specific session
   */
  async connectToSession(sessionId) {
    if (this.sessions.has(sessionId)) {
      console.log(`Already connected to session ${sessionId}`);
      return;
    }

    return new Promise((resolve, reject) => {
      try {
        console.log(`Connecting to session ${sessionId}...`);
        const ws = new WebSocket(this.wsUrl);
        
        ws.on('open', () => {
          console.log(`WebSocket opened for session ${sessionId}`);
          
          // Establish connection using Shelltender protocol
          ws.send(JSON.stringify({
            type: 'connect',
            sessionId: sessionId
          }));
          
          // Store the connection
          this.sessions.set(sessionId, ws);
          resolve();
        });
        
        ws.on('message', (data) => {
          try {
            const message = JSON.parse(data.toString());
            
            // Handle output messages
            if (message.type === 'output' && message.sessionId === sessionId) {
              this.handleSessionOutput(sessionId, message.data, message.metadata);
            } else if (message.type === 'error') {
              // If connect fails, try creating the session
              if (message.data && (message.data.includes('connect') || message.data.includes('attach'))) {
                console.log(`Connect failed for ${sessionId}, trying to create...`);
                ws.send(JSON.stringify({
                  type: 'create',
                  sessionId: sessionId
                }));
              }
            } else if (message.type === 'created') {
              console.log(`Session ${sessionId} created successfully`);
            }
          } catch (error) {
            console.error(`Failed to parse message for session ${sessionId}:`, error);
          }
        });
        
        ws.on('error', (error) => {
          console.error(`WebSocket error for session ${sessionId}:`, error);
          this.sessions.delete(sessionId);
        });
        
        ws.on('close', () => {
          console.log(`WebSocket closed for session ${sessionId}`);
          this.sessions.delete(sessionId);

          this.emitSessionClosed(sessionId);
          
          // Attempt to reconnect
          setTimeout(() => {
            if (!this.sessions.has(sessionId)) {
              this.connectToSession(sessionId).catch(console.error);
            }
          }, this.reconnectInterval);
        });
        
      } catch (error) {
        console.error(`Failed to connect to session ${sessionId}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Handle session output data
   */
  handleSessionOutput(sessionId, data, metadata) {
    
    // Call all registered onData callbacks
    this.dataCallbacks.forEach(callback => {
      try {
        callback(sessionId, data, metadata);
      } catch (error) {
        console.error('Error in onData callback:', error);
      }
    });
  }

  /**
   * Register a callback for session data
   * Compatible with the AISessionMonitor's expected interface
   */
  onData(callback) {
    if (typeof callback === 'function') {
      this.dataCallbacks.push(callback);
      console.log('Registered onData callback');
    }
  }

  /**
   * Monitor multiple sessions
   */
  async monitorSessions(sessionIds) {
    console.log(`Starting to monitor ${sessionIds.length} sessions`);
    const promises = sessionIds.map(sessionId => 
      this.connectToSession(sessionId).catch(err => 
        console.error(`Failed to connect to ${sessionId}:`, err)
      )
    );
    
    await Promise.allSettled(promises);
    console.log(`Monitoring ${this.sessions.size} active sessions`);
  }

  /**
   * Send input to a specific session
   */
  sendInput(sessionId, data) {
    const ws = this.sessions.get(sessionId);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'input',
        sessionId: sessionId,
        data: data
      }));
    } else {
      console.error(`Session ${sessionId} not connected`);
    }
  }

  /**
   * Close all connections
   */
  close() {
    this.sessions.forEach((ws, sessionId) => {
      console.log(`Closing connection to session ${sessionId}`);
      ws.close();
    });
    this.sessions.clear();
  }

  emitSessionClosed(sessionId) {
    if (this.eventEmitterService) {
      this.eventEmitterService.emit('shelltender.session-closed', {
        sessionId,
        timestamp: new Date().toISOString()
      });
    }

    this.emit('session-closed', sessionId);
  }
}

/**
 * Create and initialize a session monitor
 */
export async function createSessionMonitor(options = {}) {
  const monitor = new ShelltenderSessionMonitor(options.wsUrl, options.eventEmitterService);
  
  // Get existing task sessions from the API
  if (options.apiUrl) {
    try {
      const response = await fetch(`${options.apiUrl}/api/sessions`);
      if (response.ok) {
        const sessions = await response.json();
        const taskSessions = sessions
          .filter(s => s.id && s.id.startsWith('task-'))
          .map(s => s.id);
        
        if (taskSessions.length > 0) {
          await monitor.monitorSessions(taskSessions);
        }
      }
    } catch (error) {
      console.error('Failed to fetch existing sessions:', error);
    }
  }
  
  return monitor;
}
