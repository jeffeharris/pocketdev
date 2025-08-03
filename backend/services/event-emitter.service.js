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
   * Unsubscribe from an event
   * @param {string} eventName - Event name to unsubscribe from
   * @param {Function} handler - Event handler function to remove
   */
  unsubscribe(eventName, handler) {
    this.off(eventName, handler);
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