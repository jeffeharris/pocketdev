/**
 * Shelltender WebSocket Client
 * Connects to the standalone Shelltender service for real-time events
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

class ShelltenderWebSocketClient extends EventEmitter {
  constructor(wsUrl = 'ws://localhost:8080') {
    super();
    this.wsUrl = wsUrl;
    this.ws = null;
    this.reconnectInterval = 5000;
    this.shouldReconnect = true;
  }

  connect() {
    console.log(`Connecting to Shelltender WebSocket at ${this.wsUrl}`);
    
    this.ws = new WebSocket(this.wsUrl);
    
    this.ws.on('open', () => {
      console.log('Connected to Shelltender WebSocket');
      this.emit('connected');
      
      // Subscribe to events we care about
      this.send({
        type: 'subscribe',
        events: ['session-output', 'session-created', 'session-closed', 'pattern-match']
      });
    });
    
    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });
    
    this.ws.on('close', () => {
      console.log('Disconnected from Shelltender WebSocket');
      this.emit('disconnected');
      
      if (this.shouldReconnect) {
        setTimeout(() => this.connect(), this.reconnectInterval);
      }
    });
    
    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      this.emit('error', error);
    });
  }
  
  handleMessage(message) {
    switch (message.type) {
      case 'session-output':
        this.emit('session-output', message.sessionId, message.data);
        break;
        
      case 'session-created':
        this.emit('session-created', message);
        break;
        
      case 'session-closed':
        this.emit('session-closed', message.sessionId);
        break;
        
      case 'pattern-match':
        this.emit('pattern-match', message);
        break;
        
      case 'ai_state_update':
        // Forward AI state updates to any listeners
        this.emit('ai_state_update', message);
        break;
        
      default:
        // Forward unknown messages as-is
        this.emit('message', message);
    }
  }
  
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, queuing message');
      // Could implement a queue here if needed
    }
  }
  
  sendToAll(message) {
    // Broadcast a message to all connected clients
    this.send({
      type: 'broadcast',
      message
    });
  }
  
  close() {
    this.shouldReconnect = false;
    if (this.ws) {
      this.ws.close();
    }
  }
}

export default ShelltenderWebSocketClient;