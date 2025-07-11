/**
 * AI State Tracker
 * 
 * Maintains state for individual AI sessions and tracks transitions.
 * Each task gets its own tracker instance that persists for the session lifetime.
 * 
 * States match the frontend WorkerStatus enum:
 * - 'not-started': No AI session active (at bash prompt)
 * - 'idle': AI session active, waiting for user input  
 * - 'working': AI is thinking/processing
 * - 'waiting': AI needs user confirmation or input
 * 
 * The tracker also determines when to send notifications based on
 * state transitions and timing to avoid spam.
 */

// AI state constants - MUST match frontend WorkerStatus enum values
// These are the only valid states throughout the system
const AI_STATE_NOT_STARTED = 'not-started';  // Gray - No AI session
const AI_STATE_IDLE = 'idle';                // Blue - AI ready for input
const AI_STATE_WORKING = 'working';          // Yellow - AI thinking
const AI_STATE_WAITING = 'waiting';          // Purple - AI needs response

export class AIStateTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.currentState = AI_STATE_NOT_STARTED;
    this.previousState = AI_STATE_IDLE;
    this.lastNotificationTime = 0;
    this.minNotificationGap = 5000; // 5 seconds
    this.context = {
      terminalTitle: '',
      lastAction: '',
      lastError: '',
      startTime: Date.now(),
      thinkingStartTime: null,
      tokensUsed: 0
    };
  }

  /**
   * Determine if a state transition warrants a notification
   */
  shouldNotify(newState) {
    const now = Date.now();
    
    // Important transitions that warrant notification
    const importantTransitions = [
      // AI needs input after thinking
      { from: 'working', to: 'waiting' },
      
      // Task completed
      { from: 'working', to: 'idle' },
      
      // Error occurred
      { from: 'working', to: 'waiting' },
      
      // Started waiting for input from idle (e.g., Claude asking initial question)
      { from: 'idle', to: 'waiting' }
    ];

    const isImportant = importantTransitions.some(t => 
      t.from === this.currentState && t.to === newState
    );

    const enoughTimePassed = (now - this.lastNotificationTime) > this.minNotificationGap;

    if (isImportant && enoughTimePassed) {
      this.lastNotificationTime = now;
      return true;
    }

    return false;
  }

  /**
   * Update state and context
   */
  updateState(newState, data = {}) {
    this.previousState = this.currentState;
    this.currentState = newState;
    
    // Update context based on state and data
    if (data.terminalTitle) {
      this.context.terminalTitle = data.terminalTitle;
    }
    
    if (data.action) {
      this.context.lastAction = data.action;
    }
    
    if (data.error) {
      this.context.lastError = data.error;
    }
    
    if (data.tokens) {
      this.context.tokensUsed = data.tokens;
    }
    
    // Track thinking duration
    if (newState === AI_STATE_WORKING) {
      this.context.thinkingStartTime = Date.now();
    } else if (this.previousState === AI_STATE_WORKING) {
      const duration = Date.now() - (this.context.thinkingStartTime || Date.now());
      this.context.lastThinkingDuration = duration;
    }
    
    return {
      oldState: this.previousState,
      newState: this.currentState,
      context: this.context,
      shouldNotify: this.shouldNotify(newState)
    };
  }

  /**
   * Get notification content based on current state
   */
  getNotificationContent() {
    const title = this.context.terminalTitle || `Session ${this.sessionId}`;
    
    switch (this.currentState) {
      case 'waiting':
        return {
          title: 'AI needs your input',
          body: `${title} - ${this.context.lastAction || 'Waiting for response'}`,
          priority: 'high',
          actions: this.getSuggestedActions()
        };
        
      case 'idle':
        return {
          title: 'AI task completed',
          body: `${title} - ${this.context.lastAction || 'Task finished'}`,
          priority: 'low'
        };
        
      case 'error':
        return {
          title: 'AI encountered an error',
          body: `${title} - ${this.context.lastError || 'Error occurred'}`,
          priority: 'high'
        };
        
      default:
        return null;
    }
  }

  /**
   * Get suggested quick actions based on context
   */
  getSuggestedActions() {
    if (this.currentState === 'waiting') {
      // Look for common patterns in last action
      const action = this.context.lastAction?.toLowerCase() || '';
      
      if (action.includes('(y/n)') || action.includes('proceed')) {
        return [
          { id: 'yes', title: 'Yes', command: 'y' },
          { id: 'no', title: 'No', command: 'n' }
        ];
      }
      
      if (action.includes('continue')) {
        return [
          { id: 'continue', title: 'Continue', command: '\n' }
        ];
      }
    }
    
    return [];
  }

  /**
   * Get current session status
   */
  getStatus() {
    return {
      sessionId: this.sessionId,
      currentState: this.currentState,
      previousState: this.previousState,
      context: this.context,
      needsAttention: this.currentState === 'waiting',
      duration: Date.now() - this.context.startTime
    };
  }
}