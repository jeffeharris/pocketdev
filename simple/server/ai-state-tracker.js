/**
 * AI State Tracker
 * Tracks state transitions for AI sessions to prevent notification spam
 * and provide context-aware notifications
 */

export const AIStates = {
  IDLE: 'idle',
  RUNNING: 'running',  // Claude is active but not thinking
  LOADING_CONTEXT: 'loading_context',
  THINKING: 'thinking',  // Animation visible
  WAITING_INPUT: 'waiting_input',
  COMPLETED: 'completed',
  ERROR: 'error'
};

export class AIStateTracker {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.currentState = AIStates.IDLE;
    this.previousState = AIStates.IDLE;
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
      { from: AIStates.THINKING, to: AIStates.WAITING_INPUT },
      { from: AIStates.LOADING_CONTEXT, to: AIStates.WAITING_INPUT },
      
      // Task completed
      { from: AIStates.THINKING, to: AIStates.COMPLETED },
      
      // Error occurred
      { from: AIStates.THINKING, to: AIStates.ERROR },
      { from: AIStates.LOADING_CONTEXT, to: AIStates.ERROR },
      
      // Started waiting for input from idle (e.g., Claude asking initial question)
      { from: AIStates.IDLE, to: AIStates.WAITING_INPUT }
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
    if (newState === AIStates.THINKING) {
      this.context.thinkingStartTime = Date.now();
    } else if (this.previousState === AIStates.THINKING) {
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
      case AIStates.WAITING_INPUT:
        return {
          title: 'AI needs your input',
          body: `${title} - ${this.context.lastAction || 'Waiting for response'}`,
          priority: 'high',
          actions: this.getSuggestedActions()
        };
        
      case AIStates.COMPLETED:
        return {
          title: 'AI task completed',
          body: `${title} - ${this.context.lastAction || 'Task finished'}`,
          priority: 'low'
        };
        
      case AIStates.ERROR:
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
    if (this.currentState === AIStates.WAITING_INPUT) {
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
      needsAttention: this.currentState === AIStates.WAITING_INPUT || 
                       this.currentState === AIStates.ERROR,
      duration: Date.now() - this.context.startTime
    };
  }
}