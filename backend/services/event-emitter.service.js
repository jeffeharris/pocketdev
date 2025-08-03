import { EventEmitter } from 'events';

/**
 * EventEmitterService - Central event hub for the application
 * 
 * This service acts as the communication backbone, allowing services to emit
 * domain events without knowing who will consume them. This enables clean
 * separation of concerns and makes the system more modular and testable.
 * 
 * Design principles:
 * - Services emit events instead of calling other services directly
 * - Event names use hierarchical namespacing (e.g., 'task.created', 'terminal.state-changed')
 * - Events carry rich data payloads for subscribers
 * - Supports multiple subscribers per event type
 * - Enables async event handling and broadcasting
 */
export class EventEmitterService extends EventEmitter {
  constructor() {
    super();
    
    // Increase max listeners to support multiple subscribers
    this.setMaxListeners(50);
    
    // Track event statistics for debugging
    this.eventStats = new Map();
    
    // Enable event logging in development (disabled temporarily due to logging issues)
    this.enableLogging = false;
    
    if (this.enableLogging) {
      this.on('newListener', (event, listener) => {
        console.log(`[EventEmitter] New subscriber for '${event}'`);
      });
    }
  }

  /**
   * Emit an event with automatic logging and statistics tracking
   * @param {string} eventName - Hierarchical event name (e.g., 'task.created')
   * @param {Object} eventData - Event payload data
   * @returns {boolean} True if event had listeners
   */
  emit(eventName, eventData = {}) {
    // Track event statistics
    const count = this.eventStats.get(eventName) || 0;
    this.eventStats.set(eventName, count + 1);
    
    // Add timestamp to event data
    const enrichedData = {
      ...eventData,
      timestamp: new Date().toISOString(),
      eventName
    };
    
    if (this.enableLogging) {
      console.log(`[EventEmitter] Emitting '${eventName}' with data:`, enrichedData);
    }
    
    // Emit the event
    const hadListeners = super.emit(eventName, enrichedData);
    
    if (!hadListeners && this.enableLogging) {
      console.warn(`[EventEmitter] No listeners for event '${eventName}'`);
    }
    
    return hadListeners;
  }

  /**
   * Subscribe to events with error handling
   * @param {string} eventName - Event name to listen for
   * @param {Function} handler - Event handler function
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventName, handler) {
    const safeHandler = (eventData) => {
      try {
        handler(eventData);
      } catch (error) {
        console.error(`[EventEmitter] Error in handler for '${eventName}':`, error);
        // Emit error event for centralized error handling
        this.emit('error.handler', { eventName, error, originalData: eventData });
      }
    };
    
    this.on(eventName, safeHandler);
    
    // Return unsubscribe function
    return () => this.off(eventName, safeHandler);
  }

  /**
   * Subscribe to events matching a pattern (e.g., 'task.*')
   * @param {string} pattern - Event pattern with wildcards
   * @param {Function} handler - Event handler function
   * @returns {Function} Unsubscribe function
   */
  subscribeToPattern(pattern, handler) {
    const regex = new RegExp(pattern.replace('*', '.*'));
    const unsubscribeFunctions = [];
    
    // Subscribe to existing events that match pattern
    for (const eventName of this.eventNames()) {
      if (regex.test(eventName)) {
        unsubscribeFunctions.push(this.subscribe(eventName, handler));
      }
    }
    
    // Watch for new events that match pattern
    const newListenerHandler = (eventName) => {
      if (regex.test(eventName)) {
        unsubscribeFunctions.push(this.subscribe(eventName, handler));
      }
    };
    
    this.on('newListener', newListenerHandler);
    
    // Return function to unsubscribe from all
    return () => {
      this.off('newListener', newListenerHandler);
      unsubscribeFunctions.forEach(unsubscribe => unsubscribe());
    };
  }

  /**
   * Get event statistics for debugging
   * @returns {Object} Event emission counts
   */
  getEventStats() {
    return Object.fromEntries(this.eventStats);
  }

  /**
   * Get information about current subscribers
   * @returns {Object} Subscriber information by event
   */
  getSubscriberInfo() {
    const info = {};
    for (const eventName of this.eventNames()) {
      info[eventName] = this.listenerCount(eventName);
    }
    return info;
  }

  /**
   * Clear all event statistics
   */
  clearStats() {
    this.eventStats.clear();
  }

  /**
   * Task-related event emitters
   */
  emitTaskCreated(taskData) {
    this.emit('task.created', { task: taskData });
  }

  emitTaskUpdated(taskId, changes) {
    this.emit('task.updated', { taskId, changes });
  }

  emitTaskDeleted(taskId) {
    this.emit('task.deleted', { taskId });
  }

  emitTaskStateChanged(taskId, newState, oldState) {
    this.emit('task.state-changed', { taskId, newState, oldState });
  }

  /**
   * Terminal-related event emitters
   */
  emitTerminalCreated(terminalData) {
    this.emit('terminal.created', { terminal: terminalData });
  }

  emitTerminalStateChanged(sessionId, state) {
    this.emit('terminal.state-changed', { sessionId, state });
  }

  emitTerminalClosed(sessionId) {
    this.emit('terminal.closed', { sessionId });
  }

  /**
   * AI-related event emitters
   */
  emitAIStateChanged(taskId, sessionState) {
    this.emit('ai.state-changed', { taskId, sessionState });
  }

  emitAIAttentionNeeded(taskId, message) {
    this.emit('ai.attention-needed', { taskId, message });
  }

  /**
   * Git-related event emitters
   */
  emitGitStatusChanged(taskId, gitStatus) {
    this.emit('git.status-changed', { taskId, gitStatus });
  }

  emitGitOperationCompleted(taskId, operation, result) {
    this.emit('git.operation-completed', { taskId, operation, result });
  }

  /**
   * Project-related event emitters
   */
  emitProjectCreated(projectData) {
    this.emit('project.created', { project: projectData });
  }

  emitProjectUpdated(projectId, changes) {
    this.emit('project.updated', { projectId, changes });
  }

  emitProjectDeleted(projectId) {
    this.emit('project.deleted', { projectId });
  }

  /**
   * Split view related event emitters
   */
  emitSplitLayoutChanged(taskId, layout) {
    this.emit('split.layout-changed', { taskId, layout });
  }

  /**
   * Container-related event emitters
   */
  emitContainerCreated(taskId, services, ports) {
    this.emit('container.created', { taskId, services, ports });
  }

  emitContainerStopped(taskId, containers, removedVolumes) {
    this.emit('container.stopped', { taskId, containers, removedVolumes });
  }

  emitContainerRestarted(taskId, service, containers) {
    this.emit('container.restarted', { taskId, service, containers });
  }

  emitContainerError(taskId, error, operation) {
    this.emit('container.error', { taskId, error, operation });
  }

  /**
   * Upload-related event emitters
   */
  emitFileAttached(taskId, projectId, filename, size, mimeType) {
    this.emit('upload.file-attached', { taskId, projectId, filename, size, mimeType });
  }

  emitFileDeleted(taskId, projectId, filename) {
    this.emit('upload.file-deleted', { taskId, projectId, filename });
  }

  emitValidationFailed(taskId, projectId, error) {
    this.emit('upload.validation-failed', { taskId, projectId, error });
  }

  /**
   * Monitoring-related event emitters
   */
  emitMonitoringMetricsCollected(metrics) {
    this.emit('monitoring.metrics-collected', { metrics });
  }

  emitMonitoringHealthCritical(component, issue) {
    this.emit('monitoring.health-critical', { component, issue });
  }
}

// Singleton instance
let eventEmitterService = null;

/**
 * Get or create the singleton EventEmitterService instance
 * @returns {EventEmitterService} The event emitter service
 */
export function getEventEmitterService() {
  if (!eventEmitterService) {
    eventEmitterService = new EventEmitterService();
  }
  return eventEmitterService;
}

/**
 * Initialize the EventEmitterService (for testing or explicit initialization)
 * @returns {EventEmitterService} The event emitter service
 */
export function initializeEventEmitterService() {
  eventEmitterService = new EventEmitterService();
  return eventEmitterService;
}