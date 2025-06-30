/**
 * Shelltender WebSocket Adapter
 * Bridges the gap between Shelltender's WebSocket protocol and AI Session Monitor
 */

import WebSocket from 'ws';

export class ShelltenderWSAdapter {
  constructor(wsUrl = 'ws://localhost:8080') {
    this.wsUrl = wsUrl;
    this.sessionConnections = new Map();
    this.dataCallbacks = [];
    this.activeSessionIds = new Set();
  }

  /**
   * Register a callback for terminal data
   * Compatible with sessionManager.onData() interface
   */
  onData(callback) {
    console.log('ShelltenderWSAdapter: Registering onData callback');
    this.dataCallbacks.push(callback);
    
    // Connect to any existing sessions
    this.activeSessionIds.forEach(sessionId => {
      this.connectToSession(sessionId);
    });
  }

  /**
   * Connect to a specific session's WebSocket
   */
  connectToSession(sessionId) {
    if (this.sessionConnections.has(sessionId)) {
      return; // Already connected
    }

    console.log(`ShelltenderWSAdapter: Connecting to session ${sessionId}`);
    
    // Create WebSocket connection without query parameter
    const ws = new WebSocket(this.wsUrl);
    
    ws.on('open', () => {
      console.log(`ShelltenderWSAdapter: WebSocket opened, sending connect for ${sessionId}`);
      // Send connect message to associate with session
      ws.send(JSON.stringify({
        type: 'connect',
        sessionId: sessionId
      }));
      this.sessionConnections.set(sessionId, ws);
    });

    ws.on('message', (rawData) => {
      const dataStr = rawData.toString();
      
      try {
        // Try to parse as JSON first
        const msg = JSON.parse(dataStr);
        
        // Handle different message types
        if (msg.type === 'connected') {
          console.log(`ShelltenderWSAdapter: Successfully connected to session ${sessionId}`);
        } else if (msg.type === 'output' && msg.data) {
          // Standard output message - this is what we get from Shelltender
          this.notifyCallbacks(sessionId, msg.data);
        } else if (msg.type === 'connect' && msg.scrollback) {
          // Initial connection includes scrollback (legacy format)
          this.notifyCallbacks(sessionId, msg.scrollback);
        } else if (msg.type === 'error') {
          console.error(`ShelltenderWSAdapter: Error for session ${sessionId}:`, msg.message);
        }
      } catch (e) {
        // Not JSON - this is raw terminal data (shouldn't happen with new Shelltender)
        // Log it for debugging
        console.warn(`ShelltenderWSAdapter: Received non-JSON data for ${sessionId}:`, dataStr.substring(0, 50));
      }
    });

    ws.on('error', (err) => {
      console.error(`ShelltenderWSAdapter: Error for session ${sessionId}:`, err.message);
    });

    ws.on('close', () => {
      console.log(`ShelltenderWSAdapter: Disconnected from session ${sessionId}`);
      this.sessionConnections.delete(sessionId);
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        if (this.activeSessionIds.has(sessionId)) {
          this.connectToSession(sessionId);
        }
      }, 5000);
    });
  }

  /**
   * Notify all registered callbacks with terminal data
   */
  notifyCallbacks(sessionId, data) {
    // Only log if data contains something interesting
    if (data.includes('ing') || data.includes('│')) {
      console.log(`ShelltenderWSAdapter: Data for ${sessionId}: ${data.substring(0, 50)}...`);
    }
    
    this.dataCallbacks.forEach(callback => {
      try {
        callback(sessionId, data);
      } catch (error) {
        console.error('Error in data callback:', error);
      }
    });
  }

  /**
   * Register a session for monitoring
   */
  registerSession(sessionId) {
    console.log(`ShelltenderWSAdapter: Registering session ${sessionId}`);
    this.activeSessionIds.add(sessionId);
    
    // Connect if we have callbacks registered
    if (this.dataCallbacks.length > 0) {
      this.connectToSession(sessionId);
    }
  }

  /**
   * Unregister a session
   */
  unregisterSession(sessionId) {
    console.log(`ShelltenderWSAdapter: Unregistering session ${sessionId}`);
    this.activeSessionIds.delete(sessionId);
    
    // Close WebSocket if connected
    const ws = this.sessionConnections.get(sessionId);
    if (ws) {
      ws.close();
      this.sessionConnections.delete(sessionId);
    }
  }

  /**
   * Close all connections
   */
  close() {
    this.sessionConnections.forEach((ws, sessionId) => {
      ws.close();
    });
    this.sessionConnections.clear();
    this.activeSessionIds.clear();
  }
}