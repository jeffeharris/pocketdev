/**
 * WebSocketService - WebSocket server wrapper that subscribes to events
 * 
 * This service wraps the WebSocket server functionality and subscribes to
 * events from the EventEmitterService to broadcast updates to connected clients.
 * It provides clean separation between event emission and WebSocket broadcasting.
 * 
 * Design principles:
 * - Services should NOT call this directly - they emit events instead
 * - Subscribes to EventEmitter events and maps them to WebSocket broadcasts
 * - Handles client connection/disconnection management
 * - Maintains backwards compatibility with existing frontend WebSocket messages
 * - Provides subscription-based filtering for clients
 */
export class WebSocketService {
  constructor(wss, eventEmitterService) {
    this.wss = wss;
    this.eventEmitterService = eventEmitterService;
    this.clientCount = 0;
    
    // Subscribe to all events we need to broadcast
    this.setupEventSubscriptions();
    
    // Handle client connections
    this.setupClientHandling();
    
    console.log('[WebSocketService] Initialized with event-based broadcasting');
  }

  /**
   * Set up subscriptions to events that should be broadcast via WebSocket
   */
  setupEventSubscriptions() {
    // Task events
    this.eventEmitterService.subscribe('task.created', (data) => {
      this.broadcastToProject(data.task.project_id, {
        type: 'task-created',
        data: { task: data.task }
      });
    });

    this.eventEmitterService.subscribe('task.updated', (data) => {
      // Find task to get project_id for broadcasting
      this.broadcastToTaskAndProject(data.taskId, {
        type: 'task-updated',
        data: { taskId: data.taskId, changes: data.changes }
      });
    });

    this.eventEmitterService.subscribe('task.deleted', (data) => {
      this.broadcastToTaskAndProject(data.taskId, {
        type: 'task-deleted',
        data: { taskId: data.taskId }
      });
    });

    this.eventEmitterService.subscribe('task.state-changed', (data) => {
      this.broadcastToTask(data.taskId, {
        type: 'task-state-changed',
        data: {
          taskId: data.taskId,
          newState: data.newState,
          oldState: data.oldState
        }
      });
    });

    // Terminal events
    this.eventEmitterService.subscribe('terminal.created', (data) => {
      this.broadcastToTask(data.terminal.task_id, {
        type: 'terminal-created',
        data: { terminal: data.terminal }
      });
    });

    this.eventEmitterService.subscribe('terminal.state-changed', (data) => {
      this.broadcastToSession(data.sessionId, {
        type: 'terminal-state-changed',
        data: {
          sessionId: data.sessionId,
          state: data.state
        }
      });
    });

    this.eventEmitterService.subscribe('terminal.closed', (data) => {
      // Broadcast to task instead of session (session is already closed)
      if (data.taskId) {
        this.broadcastToTask(data.taskId, {
          type: 'terminal-deleted',
          taskId: data.taskId,
          data: { 
            sessionId: data.sessionId,
            dbSessionId: data.dbSessionId 
          }
        });
      } else {
        // Legacy support - if no taskId, try to broadcast to session
        this.broadcastToSession(data.sessionId, {
          type: 'terminal-closed',
          data: { sessionId: data.sessionId }
        });
      }
    });

    // AI events
    this.eventEmitterService.subscribe('ai.state-changed', (data) => {
      this.broadcastToTask(data.taskId, {
        type: 'ai-state-changed',
        data: {
          taskId: data.taskId,
          sessionState: data.sessionState
        }
      });
    });

    this.eventEmitterService.subscribe('ai.attention-needed', (data) => {
      this.broadcastToTask(data.taskId, {
        type: 'ai-attention-needed',
        data: {
          taskId: data.taskId,
          message: data.message,
          priority: 'high'
        }
      });
    });

    // Git events
    this.eventEmitterService.subscribe('git.status-changed', (data) => {
      this.broadcastToTask(data.taskId, {
        type: 'git-status-changed',
        data: {
          taskId: data.taskId,
          gitStatus: data.gitStatus
        }
      });
    });

    this.eventEmitterService.subscribe('git.operation-completed', (data) => {
      this.broadcastToTask(data.taskId, {
        type: 'git-operation-completed',
        data: {
          taskId: data.taskId,
          operation: data.operation,
          result: data.result
        }
      });
    });

    // Project events
    this.eventEmitterService.subscribe('project.created', (data) => {
      this.broadcastToAll({
        type: 'project-created',
        data: { project: data.project }
      });
    });

    this.eventEmitterService.subscribe('project.updated', (data) => {
      this.broadcastToProject(data.projectId, {
        type: 'project-updated',
        data: { projectId: data.projectId, changes: data.changes }
      });
    });

    this.eventEmitterService.subscribe('project.deleted', (data) => {
      this.broadcastToProject(data.projectId, {
        type: 'project-deleted',
        data: { projectId: data.projectId }
      });
    });

    // Split view events
    this.eventEmitterService.subscribe('split.layout-changed', (data) => {
      this.broadcastToTask(data.taskId, {
        type: 'split-layout-changed',
        data: {
          taskId: data.taskId,
          layout: data.layout
        }
      });
    });
  }

  /**
   * Set up WebSocket client connection handling
   */
  setupClientHandling() {
    this.wss.on('connection', (ws, req) => {
      this.clientCount++;
      const clientId = Math.random().toString(36).substr(2, 9);
      
      console.log(`[WebSocketService] New client connected: ${clientId} (total: ${this.clientCount})`);
      
      // Initialize client metadata
      ws.clientId = clientId;
      ws.subscriptions = new Set();
      
      // Handle client messages
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(ws, data);
        } catch (error) {
          console.error(`[WebSocketService] Invalid message from client ${clientId}:`, error);
        }
      });
      
      // Handle client disconnection
      ws.on('close', () => {
        this.clientCount--;
        console.log(`[WebSocketService] Client ${clientId} disconnected (total: ${this.clientCount})`);
      });
      
      ws.on('error', (error) => {
        console.error(`[WebSocketService] Client ${clientId} error:`, error);
      });
      
      // Send connection success message
      ws.send(JSON.stringify({ 
        type: 'connected', 
        clientId,
        timestamp: new Date().toISOString()
      }));
    });
  }

  /**
   * Handle messages from WebSocket clients
   */
  handleClientMessage(ws, data) {
    switch (data.type) {
      case 'subscribe':
        this.handleSubscription(ws, data);
        break;
      case 'unsubscribe':
        this.handleUnsubscription(ws, data);
        break;
      case 'ping':
        ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
        break;
      default:
        console.log(`[WebSocketService] Unknown message type from ${ws.clientId}: ${data.type}`);
    }
  }

  /**
   * Handle client subscription requests
   */
  handleSubscription(ws, data) {
    if (data.projectId) {
      ws.subscriptions.add(`project:${data.projectId}`);
      console.log(`[WebSocketService] Client ${ws.clientId} subscribed to project ${data.projectId}`);
    }
    if (data.taskId) {
      ws.subscriptions.add(`task:${data.taskId}`);
      console.log(`[WebSocketService] Client ${ws.clientId} subscribed to task ${data.taskId}`);
    }
    if (data.sessionId) {
      ws.subscriptions.add(`session:${data.sessionId}`);
      console.log(`[WebSocketService] Client ${ws.clientId} subscribed to session ${data.sessionId}`);
    }
  }

  /**
   * Handle client unsubscription requests
   */
  handleUnsubscription(ws, data) {
    if (data.projectId) {
      ws.subscriptions.delete(`project:${data.projectId}`);
    }
    if (data.taskId) {
      ws.subscriptions.delete(`task:${data.taskId}`);
    }
    if (data.sessionId) {
      ws.subscriptions.delete(`session:${data.sessionId}`);
    }
  }

  /**
   * Broadcast message to all connected clients
   */
  broadcastToAll(message) {
    this.broadcast('all', message);
  }

  /**
   * Broadcast message to clients subscribed to a project
   */
  broadcastToProject(projectId, message) {
    this.broadcast(`project:${projectId}`, {
      ...message,
      projectId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to clients subscribed to a task
   */
  broadcastToTask(taskId, message) {
    this.broadcast(`task:${taskId}`, {
      ...message,
      taskId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to clients subscribed to a specific session
   */
  broadcastToSession(sessionId, message) {
    this.broadcast(`session:${sessionId}`, {
      ...message,
      sessionId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast message to clients subscribed to both task and its project
   * Used when we need to notify about task changes to project subscribers too
   */
  async broadcastToTaskAndProject(taskId, message) {
    // Broadcast to task subscribers
    this.broadcastToTask(taskId, message);
    
    // Also broadcast to project subscribers if we can find the project
    // This would require a models reference - for now just broadcast to task
    // TODO: Consider injecting models or task lookup service if needed
  }

  /**
   * Core broadcast method
   */
  broadcast(channel, message) {
    if (!this.wss) return;

    let sentCount = 0;
    this.wss.clients.forEach(client => {
      // Check if client is connected and subscribed to this channel
      const isSubscribed = channel === 'all' || client.subscriptions?.has(channel);
      
      if (client.readyState === 1 && isSubscribed) {
        try {
          client.send(JSON.stringify(message));
          sentCount++;
        } catch (error) {
          console.error(`[WebSocketService] Failed to send to client ${client.clientId}:`, error);
        }
      }
    });

    if (sentCount > 0) {
      console.log(`[WebSocketService] Broadcast ${message.type} to ${sentCount} clients on channel ${channel}`);
    }
  }

  /**
   * Get WebSocket server statistics
   */
  getStats() {
    const connectionCount = this.wss?.clients?.size || 0;
    const subscriptionStats = {};
    
    if (this.wss) {
      this.wss.clients.forEach(client => {
        if (client.subscriptions) {
          client.subscriptions.forEach(subscription => {
            subscriptionStats[subscription] = (subscriptionStats[subscription] || 0) + 1;
          });
        }
      });
    }
    
    return {
      connections: connectionCount,
      subscriptions: subscriptionStats,
      clientCount: this.clientCount
    };
  }

  /**
   * Close all connections and cleanup
   */
  close() {
    if (this.wss) {
      this.wss.clients.forEach(client => {
        client.close();
      });
      this.wss.close();
    }
    console.log('[WebSocketService] Closed all connections');
  }
}