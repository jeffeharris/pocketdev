import {
  TASK_EVENTS,
  TERMINAL_EVENTS,
  AI_EVENTS,
  GIT_EVENTS,
  PROJECT_EVENTS,
  SPLIT_EVENTS
} from './events.js';

const EVENT_MAPPINGS = [
  {
    event: TASK_EVENTS.CREATED,
    buildMessage: (payload) => ({
      type: 'task-created',
      data: { task: payload.task }
    }),
    targets: [
      { scope: 'project', id: (payload) => payload.task?.project_id }
    ]
  },
  {
    event: TASK_EVENTS.UPDATED,
    buildMessage: (payload) => ({
      type: 'task-updated',
      data: { taskId: payload.taskId, changes: payload.changes }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId },
      {
        scope: 'project',
        id: (payload) => payload.projectId,
        fallback: { type: 'taskLookup', taskId: (payload) => payload.taskId }
      }
    ]
  },
  {
    event: TASK_EVENTS.DELETED,
    buildMessage: (payload) => ({
      type: 'task-deleted',
      data: { taskId: payload.taskId }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId },
      {
        scope: 'project',
        id: (payload) => payload.projectId,
        fallback: { type: 'taskLookup', taskId: (payload) => payload.taskId }
      }
    ]
  },
  {
    event: TASK_EVENTS.ARCHIVED,
    buildMessage: (payload) => ({
      type: 'task-archived',
      data: { taskId: payload.taskId }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId },
      {
        scope: 'project',
        id: (payload) => payload.projectId,
        fallback: { type: 'taskLookup', taskId: (payload) => payload.taskId }
      }
    ]
  },
  {
    event: TASK_EVENTS.STATE_CHANGED,
    buildMessage: (payload) => ({
      type: 'task-state-changed',
      data: {
        taskId: payload.taskId,
        newState: payload.newState,
        oldState: payload.oldState
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId },
      {
        scope: 'project',
        id: (payload) => payload.projectId,
        fallback: { type: 'taskLookup', taskId: (payload) => payload.taskId }
      }
    ]
  },
  {
    event: TERMINAL_EVENTS.CREATED,
    buildMessage: (payload) => ({
      type: 'terminal-created',
      data: { terminal: payload.terminal }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.terminal?.task_id }
    ]
  },
  {
    event: TERMINAL_EVENTS.STATE_CHANGED,
    buildMessage: (payload) => ({
      type: 'terminal-state-changed',
      data: {
        taskId: payload.taskId,
        sessionId: payload.sessionId,
        state: payload.state
      }
    }),
    targets: [
      { scope: 'session', id: (payload) => payload.sessionId },
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  },
  {
    event: TERMINAL_EVENTS.RENAMED,
    buildMessage: (payload) => ({
      type: 'terminal-renamed',
      data: {
        dbSessionId: payload.dbSessionId,
        newName: payload.newName
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  },
  {
    event: TERMINAL_EVENTS.REORDERED,
    buildMessage: (payload) => ({
      type: 'terminals-reordered',
      data: {
        terminals: payload.terminals
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  },
  {
    event: TERMINAL_EVENTS.CLOSED,
    handler: (service, payload) => {
      if (payload.taskId) {
        service.broadcast('task', payload.taskId, {
          type: 'terminal-deleted',
          taskId: payload.taskId,
          data: {
            sessionId: payload.sessionId,
            dbSessionId: payload.dbSessionId
          }
        });
      } else if (payload.sessionId) {
        service.broadcast('session', payload.sessionId, {
          type: 'terminal-closed',
          data: { sessionId: payload.sessionId }
        });
      }
    }
  },
  {
    event: AI_EVENTS.STATE_CHANGED,
    buildMessage: (payload) => ({
      type: 'ai-state-changed',
      data: {
        taskId: payload.taskId,
        sessionState: payload.sessionState
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  },
  {
    event: AI_EVENTS.ATTENTION_NEEDED,
    buildMessage: (payload) => ({
      type: 'ai-attention-needed',
      data: {
        taskId: payload.taskId,
        message: payload.message,
        priority: payload.priority || 'high'
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  },
  {
    event: GIT_EVENTS.STATUS_CHANGED,
    buildMessage: (payload) => ({
      type: 'git-status-changed',
      data: {
        taskId: payload.taskId,
        gitStatus: payload.gitStatus
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  },
  {
    event: GIT_EVENTS.OPERATION_COMPLETED,
    buildMessage: (payload) => ({
      type: 'git-operation-completed',
      data: {
        taskId: payload.taskId,
        operation: payload.operation,
        result: payload.result
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  },
  {
    event: PROJECT_EVENTS.CREATED,
    buildMessage: (payload) => ({
      type: 'project-created',
      data: { project: payload.project }
    }),
    targets: [
      { scope: 'all' }
    ]
  },
  {
    event: PROJECT_EVENTS.UPDATED,
    buildMessage: (payload) => ({
      type: 'project-updated',
      data: { projectId: payload.projectId, changes: payload.changes }
    }),
    targets: [
      { scope: 'project', id: (payload) => payload.projectId }
    ]
  },
  {
    event: PROJECT_EVENTS.DELETED,
    buildMessage: (payload) => ({
      type: 'project-deleted',
      data: { projectId: payload.projectId }
    }),
    targets: [
      { scope: 'project', id: (payload) => payload.projectId }
    ]
  },
  {
    event: SPLIT_EVENTS.LAYOUT_CHANGED,
    buildMessage: (payload) => ({
      type: 'split-layout-changed',
      data: {
        taskId: payload.taskId,
        layout: payload.layout
      }
    }),
    targets: [
      { scope: 'task', id: (payload) => payload.taskId }
    ]
  }
];

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
  constructor(wss, eventEmitterService, taskService = null, options = {}) {
    this.wss = wss;
    this.eventEmitterService = eventEmitterService;
    this.taskService = taskService;
    this.options = options;
    this.clientCount = 0;
    this.taskProjectCache = new Map();

    this.setupEventSubscriptions();
    this.setupClientHandling();

    console.log('[WebSocketService] Initialized with event-based broadcasting');
  }

  /**
   * Set up subscriptions to events that should be broadcast via WebSocket
   */
  setupEventSubscriptions() {
    EVENT_MAPPINGS.forEach((mapping) => {
      this.eventEmitterService.subscribe(mapping.event, (payload) => {
        Promise.resolve(this.handleMappedEvent(mapping, payload)).catch((error) => {
          console.error(`[WebSocketService] Error handling event ${mapping.event}:`, error);
        });
      });
    });
  }

  async handleMappedEvent(mapping, payload) {
    try {
      if (typeof mapping.handler === 'function') {
        await mapping.handler(this, payload);
        return;
      }

      if (!mapping.buildMessage) {
        console.warn(`[WebSocketService] No message builder defined for event ${mapping.event}`);
        return;
      }

      const message = mapping.buildMessage(payload);
      if (!message || !message.type) {
        console.warn(`[WebSocketService] Invalid message produced for event ${mapping.event}`);
        return;
      }

      for (const target of mapping.targets) {
        const scope = target.scope;

        if (scope === 'all') {
          this.broadcast('all', null, message);
          continue;
        }

        const scopeId = await this.resolveTargetId(target, payload);
        if (scopeId === undefined || scopeId === null) {
          continue;
        }

        this.broadcast(scope, scopeId, message);
      }
    } catch (error) {
      console.error(`[WebSocketService] Failed to process event ${mapping.event}:`, error);
    }
  }

  async resolveTargetId(target, payload) {
    if (target.scope === 'all') {
      return null;
    }

    const id = this.resolveValue(payload, target.id);
    if (id !== undefined && id !== null) {
      return id;
    }

    if (target.fallback?.type === 'taskLookup') {
      const taskId = this.resolveValue(payload, target.fallback.taskId);
      return this.getProjectIdForTask(taskId);
    }

    return undefined;
  }

  resolveValue(payload, resolver) {
    if (typeof resolver === 'function') {
      return resolver(payload);
    }

    if (typeof resolver === 'string' && resolver.length > 0) {
      return resolver.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), payload);
    }

    return resolver;
  }

  async getProjectIdForTask(taskId) {
    if (!taskId) {
      return undefined;
    }

    if (this.taskProjectCache.has(taskId)) {
      return this.taskProjectCache.get(taskId);
    }

    if (!this.taskService || typeof this.taskService.get !== 'function') {
      return undefined;
    }

    try {
      const task = await this.taskService.get(taskId);
      const projectId = task?.project_id;
      if (projectId !== undefined) {
        this.taskProjectCache.set(taskId, projectId);
      }
      return projectId;
    } catch (error) {
      console.error(`[WebSocketService] Failed to lookup project for task ${taskId}:`, error.message || error);
      return undefined;
    }
  }

  broadcast(scope, scopeId, message) {
    if (!this.wss) return;

    const channel = this.getChannel(scope, scopeId);
    if (!channel) {
      return;
    }

    const enrichedMessage = {
      ...message,
      timestamp: new Date().toISOString()
    };

    if (scope === 'task' && scopeId) {
      enrichedMessage.taskId = scopeId;
    } else if (scope === 'project' && scopeId) {
      enrichedMessage.projectId = scopeId;
    } else if (scope === 'session' && scopeId) {
      enrichedMessage.sessionId = scopeId;
    }

    this._sendToClients(channel, enrichedMessage);
  }

  getChannel(scope, scopeId) {
    switch (scope) {
      case 'all':
        return 'all';
      case 'task':
        return scopeId ? `task:${scopeId}` : null;
      case 'project':
        return scopeId ? `project:${scopeId}` : null;
      case 'session':
        return scopeId ? `session:${scopeId}` : null;
      default:
        return scopeId || null;
    }
  }

  broadcastToAll(message) {
    this.broadcast('all', null, message);
  }

  broadcastToProject(projectId, message) {
    this.broadcast('project', projectId, message);
  }

  broadcastToTask(taskId, message) {
    this.broadcast('task', taskId, message);
  }

  broadcastToSession(sessionId, message) {
    this.broadcast('session', sessionId, message);
  }

  async broadcastToTaskAndProject(taskId, message, projectId) {
    this.broadcast('task', taskId, message);

    const resolvedProjectId =
      projectId !== undefined && projectId !== null
        ? projectId
        : await this.getProjectIdForTask(taskId);

    if (resolvedProjectId !== undefined && resolvedProjectId !== null) {
      this.broadcast('project', resolvedProjectId, message);
    }
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

  _sendToClients(channel, message) {
    if (!this.wss) {
      return;
    }

    let sentCount = 0;
    this.wss.clients.forEach((client) => {
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
