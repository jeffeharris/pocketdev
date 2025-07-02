/**
 * Shelltender Monitor Mode Adapter
 * Uses Shelltender v0.3.0's monitor mode to receive ALL terminal output from a single connection
 */

import WebSocket from 'ws';

export class ShelltenderMonitorAdapter {
  constructor(wsUrl = 'ws://localhost:8080', authKey = 'pocketdev-monitor-key-2024') {
    this.wsUrl = wsUrl;
    this.authKey = authKey;
    this.ws = null;
    this.dataCallbacks = [];
    this.reconnectInterval = 5000;
    this.isConnected = false;
  }

  /**
   * Register a callback for terminal data
   * Compatible with sessionManager.onData() interface
   */
  onData(callback) {
    console.log('ShelltenderMonitorAdapter: Registering onData callback');
    this.dataCallbacks.push(callback);
    
    // Connect if not already connected
    if (!this.isConnected) {
      this.connect();
    }
  }

  /**
   * Connect to Shelltender in monitor mode
   */
  connect() {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return; // Already connected
    }

    console.log('ShelltenderMonitorAdapter: Connecting to Shelltender in monitor mode...');
    
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.on('open', () => {
      console.log('ShelltenderMonitorAdapter: WebSocket opened, authenticating for monitor mode...');
      
      // Authenticate for monitor mode
      this.ws.send(JSON.stringify({
        type: 'monitor-all',
        authKey: this.authKey
      }));
    });

    this.ws.on('message', (rawData) => {
      try {
        const msg = JSON.parse(rawData.toString());
        
        switch (msg.type) {
          case 'monitor-mode-enabled':
            console.log(`ShelltenderMonitorAdapter: Monitor mode enabled! Watching ${msg.sessionCount} sessions`);
            this.isConnected = true;
            break;
            
          case 'session-output':
            // This is terminal output from a session
            if (msg.sessionId && msg.data) {
              this.notifyCallbacks(msg.sessionId, msg.data);
            }
            break;
            
          case 'error':
            console.error('ShelltenderMonitorAdapter: Error:', msg.message);
            if (msg.message && msg.message.includes('Invalid auth key')) {
              console.error('Authentication failed! Check SHELLTENDER_MONITOR_AUTH_KEY');
            }
            break;
            
          default:
            // Log other message types for debugging
            if (msg.type !== 'ping') {
              console.log('ShelltenderMonitorAdapter: Received message type:', msg.type);
            }
        }
      } catch (e) {
        console.error('ShelltenderMonitorAdapter: Failed to parse message:', e);
      }
    });

    this.ws.on('error', (err) => {
      console.error('ShelltenderMonitorAdapter: WebSocket error:', err.message);
    });

    this.ws.on('close', () => {
      console.log('ShelltenderMonitorAdapter: WebSocket closed');
      this.isConnected = false;
      
      // Attempt to reconnect after a delay
      setTimeout(() => {
        console.log('ShelltenderMonitorAdapter: Attempting to reconnect...');
        this.connect();
      }, this.reconnectInterval);
    });
  }

  /**
   * Notify all registered callbacks with terminal data
   */
  notifyCallbacks(sessionId, data) {
    // Only log if data contains something interesting for AI monitoring
    if (data.includes('ing') || data.includes('│') || data.includes('✻') || data.includes('●')) {
      console.log(`ShelltenderMonitorAdapter: AI-relevant data for ${sessionId}: ${data.substring(0, 50)}...`);
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
   * Register a session for monitoring (no-op in monitor mode)
   * Kept for compatibility with the old adapter interface
   */
  registerSession(sessionId) {
    // In monitor mode, we automatically receive data from ALL sessions
    console.log(`ShelltenderMonitorAdapter: Session ${sessionId} will be monitored (monitor mode receives all sessions)`);
  }

  /**
   * Unregister a session (no-op in monitor mode)
   * Kept for compatibility with the old adapter interface
   */
  unregisterSession(sessionId) {
    // In monitor mode, we can't selectively stop monitoring specific sessions
    console.log(`ShelltenderMonitorAdapter: Session ${sessionId} unregistration noted (monitor mode receives all sessions)`);
  }

  /**
   * Close the monitor connection
   */
  close() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.isConnected = false;
    }
  }
}