/**
 * Simple terminal output monitor
 * Monitors WebSocket messages for AI patterns
 */

export class TerminalMonitor {
  constructor(wsServer, aiMonitor) {
    this.wsServer = wsServer;
    this.aiMonitor = aiMonitor;
    this.setupMonitoring();
  }

  setupMonitoring() {
    console.log('Setting up terminal monitoring via WebSocket...');
    
    // Hook into WebSocket broadcast to monitor terminal output
    const originalBroadcast = this.wsServer.broadcast;
    if (originalBroadcast) {
      this.wsServer.broadcast = (message) => {
        // Monitor the message
        this.monitorMessage(message);
        // Call original broadcast
        originalBroadcast.call(this.wsServer, message);
      };
    }
    
    // Also monitor individual sends if possible
    if (this.wsServer.clients) {
      this.wsServer.on('connection', (ws) => {
        const originalSend = ws.send;
        ws.send = (data) => {
          this.monitorMessage(data);
          originalSend.call(ws, data);
        };
      });
    }
  }
  
  monitorMessage(message) {
    try {
      let data;
      if (typeof message === 'string') {
        data = message;
      } else if (message && message.data) {
        data = message.data;
      } else {
        return;
      }
      
      // Simple pattern matching
      if (data.includes('claude')) {
        console.log('Claude mentioned in terminal!');
      }
      
      // Check for thinking patterns
      if (data.match(/[✻●◉]\s*\w+ing\.\.\./)) {
        console.log('AI thinking pattern detected!');
      }
      
    } catch (error) {
      // Ignore errors in monitoring
    }
  }
}