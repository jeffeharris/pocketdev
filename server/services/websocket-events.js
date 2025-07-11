/**
 * WebSocket Event Service
 * Centralized service for broadcasting real-time updates to connected clients
 */

export class WebSocketEventService {
  constructor(wss) {
    this.wss = wss;
  }

  /**
   * Broadcast an event to all clients subscribed to a specific channel
   */
  broadcast(channel, event) {
    if (!this.wss) return;

    let sentCount = 0;
    this.wss.clients.forEach(client => {
      // Check if client is connected and subscribed to this channel
      if (client.readyState === 1 && client.subscriptions?.has(channel)) {
        client.send(JSON.stringify(event));
        sentCount++;
      }
    });

    console.log(`Broadcast ${event.type} to ${sentCount} clients on channel ${channel}`);
  }

  /**
   * Broadcast to all clients subscribed to a project
   */
  broadcastToProject(projectId, event) {
    this.broadcast(`project:${projectId}`, {
      ...event,
      projectId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Broadcast to all clients subscribed to a task
   */
  broadcastToTask(taskId, event) {
    this.broadcast(`task:${taskId}`, {
      ...event,
      taskId,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send AI state update for a task
   */
  sendAIStateUpdate(taskId, sessionState) {
    this.broadcastToTask(taskId, {
      type: 'ai_state_update',
      data: {
        sessionState,
        taskId
      }
    });
  }

  /**
   * Send task state change (merged, archived, etc)
   */
  sendTaskStateChange(taskId, taskState) {
    this.broadcastToTask(taskId, {
      type: 'task_state_change',
      data: {
        taskState,
        taskId
      }
    });
  }

  /**
   * Send git status update
   */
  sendGitStatusUpdate(taskId, gitStatus) {
    this.broadcastToTask(taskId, {
      type: 'git_status_update',
      data: {
        gitStatus,
        taskId
      }
    });
  }

  /**
   * Send notification that AI needs attention
   */
  sendAIAttentionNeeded(taskId, message) {
    this.broadcastToTask(taskId, {
      type: 'ai_needs_attention',
      data: {
        message,
        taskId,
        priority: 'high'
      }
    });
  }

  /**
   * Get count of connected clients
   */
  getClientCount() {
    return this.wss?.clients?.size || 0;
  }

  /**
   * Get count of clients subscribed to a specific channel
   */
  getChannelSubscriberCount(channel) {
    if (!this.wss) return 0;
    
    let count = 0;
    this.wss.clients.forEach(client => {
      if (client.subscriptions?.has(channel)) {
        count++;
      }
    });
    return count;
  }
}

// Singleton instance
let wsEventService = null;

export function initializeWebSocketEvents(wss) {
  wsEventService = new WebSocketEventService(wss);
  return wsEventService;
}

export function getWebSocketEventService() {
  if (!wsEventService) {
    throw new Error('WebSocket event service not initialized');
  }
  return wsEventService;
}