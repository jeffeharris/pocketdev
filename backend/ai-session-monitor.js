/**
 * AI Session Monitor
 * 
 * This service monitors AI developer sessions (Claude Code, GitHub Copilot, etc.) by watching
 * terminal output through Shelltender's onData callback. It detects AI states based on
 * pattern matching and maintains real-time state for each task.
 * 
 * State Flow:
 * 1. Terminal output → Pattern matching → State detection
 * 2. State changes → Broadcast via WebSocket + Update database
 * 3. Frontend receives updates via WebSocket for real-time UI updates
 * 
 * States (matching frontend WorkerStatus enum):
 * - 'not-started': At bash prompt, no AI session active (gray)
 * - 'idle': AI session active but waiting for input (blue)
 * - 'working': AI is thinking/processing (yellow)
 * - 'waiting': AI needs user input/confirmation (purple)
 */

import { AIStateTracker } from './ai-state-tracker.js';
import { AI_EVENTS } from './services/events.js';

export class AISessionMonitor {
  constructor(sessionManager, notificationService, models, eventEmitterService = null) {
    this.sessionManager = sessionManager;
    this.notificationService = notificationService;
    this.eventEmitterService = eventEmitterService;
    this.models = models;
    this.stateTrackers = new Map(); // sessionId -> AIStateTracker
    this.patternMatchers = new Map(); // pattern name -> config
  }

  /**
   * Register AI-specific patterns
   */
  registerPatterns() {
    // Set up global session monitoring using sessionManager.onData
    this.setupGlobalMonitoring();
    
    // Essential patterns for AI monitoring
    const patterns = {
      // Claude's thinking animation - must have "ing..." and duration/tokens
      'claude-thinking': {
        pattern: /([✻●◉◎✢✶✽✺○·])\s+\w+ing….*\d+s.*tokens/,
        type: 'status',
        priority: 'high',
        handler: (match, sessionId) => {
          console.log('Claude thinking detected:', match[0]);
          return {
            state: 'working',
            data: { 
              raw: match[0]
            }
          };
        }
      },
      
      // Claude's initial processing (before token count shows)
      'claude-processing': {
        pattern: /([✻●◉◎✢✶✽✺○·])\s+\w+ing\.\.\.(?!.*tokens)/,
        type: 'status',
        priority: 'medium',
        handler: (match, sessionId) => ({
          state: 'working',
          data: { 
            action: 'Starting',
            pattern: match[0]
          }
        })
      },
      

      // Context Loading - percentage based
      'ai-context-loading': {
        pattern: /Loading context.*?(\d{1,3})%/,
        type: 'status',
        priority: 'low',
        handler: (match, sessionId) => {
          const [, percentage] = match;
          return {
            state: null, // Don't change state for loading
            data: { progress: parseInt(percentage) }
          };
        }
      },

      // Input Required - Yes/No prompts
      'ai-yes-no': {
        pattern: /(?:Should I|Would you like me to|Shall I|Can I|May I).*\?\s*\(y\/n\)\s*:?\s*$/i,
        type: 'input',
        priority: 'high',
        handler: (match, sessionId) => ({
          state: 'waiting',
          data: { 
            inputType: 'yes_no',
            prompt: match[0].trim()
          }
        })
      },

      // Claude prompt/input box - single line with just > means idle (running)
      'claude-prompt': {
        pattern: /│\s*>\s*│/,
        type: 'status',
        priority: 'medium',
        handler: (match, sessionId) => {
          return {
            state: 'idle',  // Blue - Claude is active but idle
            data: { 
              hasPrompt: true,
              timestamp: Date.now()
            }
          };
        }
      },
      
      // Claude confirmation prompt - numbered options in blue box
      'claude-confirmation': {
        pattern: /│\s*(\d+)\.\s+(.+?)\s*│/,
        type: 'input',
        priority: 'high',
        handler: (match, sessionId) => {
          const [, number, option] = match;
          console.log(`Claude confirmation option detected: ${number}. ${option}`);
          return {
            state: 'waiting',
            data: { 
              inputType: 'confirmation',
              option: option.trim(),
              number: parseInt(number)
            }
          };
        }
      },

      // Terminal Title - for context
      'terminal-title': {
        pattern: /\x1b\]([012]);([^\x07\x1b]+)(?:\x07|\x1b\\)/,
        type: 'context',
        priority: 'low',
        handler: (match, sessionId) => {
          const [, code, title] = match;
          return {
            state: null, // Don't change state, just update context
            data: { terminalTitle: title }
          };
        }
      },

      // Task Success - including Claude's "Human:" prompt that appears after completion
      'ai-success': {
        pattern: /✓\s+Successfully\s+(.+)|(?:Completed|Finished|Done):\s*(.+)|Human:/i,
        type: 'completion',
        priority: 'high',
        handler: (match, sessionId) => ({
          state: 'idle',
          data: { 
            action: match[1] || match[2] || 'task',
            success: true
          }
        })
      },

      // Real errors (not bash warnings)
      'ai-error': {
        pattern: /(?:Error|Failed|Exception):\s*(.+)|❌\s+(.+)/i,
        type: 'error',
        priority: 'high',
        handler: (match, sessionId) => {
          const errorText = match[1] || match[2] || 'Unknown error';
          // Ignore bash locale warnings
          if (errorText.includes('setlocale') || errorText.includes('LC_ALL')) {
            return { state: null, data: {} };
          }
          return {
            state: 'waiting',
            data: { error: errorText }
          };
        }
      },

      // AI Confusion/Clarification needed
      'ai-confused': {
        pattern: /I'm not sure|I need clarification|I don't understand|Could you clarify/i,
        type: 'input',
        priority: 'high',
        handler: (match, sessionId) => ({
          state: 'waiting',
          data: { 
            inputType: 'clarification',
            prompt: match[0]
          }
        })
      },
      
      // Bash prompt - Claude has exited (high priority to clear other states)
      // Updated to support both legacy (root@container:/path#) and current (username$) formats
      'bash-prompt': {
        pattern: /(?:root@[\w-]+:[\w/~-]+#|\w+\$)\s*$/,
        type: 'context',
        priority: 'high',
        handler: (match, sessionId) => ({
          state: 'not-started',
          data: { 
            context: 'bash',
            prompt: match[0],
            clearThinking: true
          }
        })
      },
      
      // Claude welcome message - Claude just started
      'claude-welcome': {
        pattern: /Welcome to.*Claude|Claude Code/i,
        type: 'status',
        priority: 'high',
        handler: (match, sessionId) => ({
          state: 'idle',
          data: { 
            started: true,
            timestamp: Date.now()
          }
        })
      }
    };

    // Store patterns locally for manual matching
    Object.entries(patterns).forEach(([name, config]) => {
      this.patternMatchers.set(name, config);
    });
    
    // Note: Pattern registration happens per-session when sessions are created
  }
  
  /**
   * Set up global session monitoring using Shelltender's onData callback
   * This is the main entry point for all terminal data processing.
   * Instead of registering patterns per-session, we monitor ALL sessions
   * and process their data in real-time.
   */
  setupGlobalMonitoring() {
    console.log('Setting up global session monitoring with Shelltender...');
    
    if (!this.sessionManager || !this.sessionManager.onData) {
      console.error('SessionManager.onData not available!');
      return;
    }
    
    // Track recent patterns for context-aware state determination
    this.recentPatterns = new Map(); // sessionId -> { patterns: Set, lastUpdate: timestamp, lastThinking: timestamp }
    
    // Monitor all session data globally
    this.sessionManager.onData((sessionId, data, metadata) => {
      try {
        // Validate inputs
        if (!sessionId || !data) {
          console.warn('Invalid onData call:', { sessionId, dataLength: data ? data.length : 0 });
          return;
        }
        
        // Check if this is a task session we care about
        if (!sessionId.startsWith('task-')) {
          return;
        }
        
        // Debug logging to trace duplicate data
        if (data.length > 0) {
          console.log(`[AIMonitor] Processing data for ${sessionId}: ${data.length} bytes, first 50 chars: "${data.substring(0, 50).replace(/\n/g, '\\n')}"`);
        }
        
        // Strip ANSI escape sequences for pattern matching
        // This prevents control sequences from interfering
        const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        
        
        // Skip if data is only control sequences
        if (cleanData.trim().length === 0) {
          return;
        }
        
        // Get or create recent patterns tracking
        if (!this.recentPatterns.has(sessionId)) {
          this.recentPatterns.set(sessionId, { 
            patterns: new Set(), 
            lastUpdate: Date.now(),
            lastThinking: 0,
            lastPromptSeen: 0
          });
        }
        const recent = this.recentPatterns.get(sessionId);
        
        // Clear old patterns if more than 2 seconds old
        if (Date.now() - recent.lastUpdate > 2000) {
          recent.patterns.clear();
        }
        recent.lastUpdate = Date.now();
        
        // Process data against all patterns
        let foundThinking = false;
        let foundPrompt = false;
        let foundConfirmation = false;
        
        
        // Get tracker early for debugging
        let tracker = this.stateTrackers.get(sessionId);
        
        
        // FIRST: Check for thinking patterns - they have absolute priority
        ['claude-thinking', 'claude-processing'].forEach(patternName => {
          const config = this.patternMatchers.get(patternName);
          if (config) {
            const match = cleanData.match(config.pattern);
            if (match) {
              foundThinking = true;
              recent.lastThinking = Date.now();
              recent.patterns.add(patternName);
            }
          }
        });
        
        // If thinking is found, skip all other pattern processing
        if (foundThinking) {
          console.log('Thinking pattern found - skipping other patterns');
        } else {
          // Only process other patterns if NO thinking detected
          this.patternMatchers.forEach((config, patternName) => {
            // Skip thinking patterns as we already checked them
            if (patternName === 'claude-thinking' || patternName === 'claude-processing') {
              return;
            }
            
            const match = cleanData.match(config.pattern);
            if (match) {
              console.log(`Pattern matched: ${patternName} in session ${sessionId}`);
              
              // Track what we found
              if (patternName === 'claude-prompt') {
                foundPrompt = true;
                recent.lastPromptSeen = Date.now();
              } else if (patternName === 'claude-confirmation') {
                foundConfirmation = true;
              }
              
              recent.patterns.add(patternName);
            }
          });
        }
        
        // Handle state transitions based on what we found
        if (!tracker) {
          // Create tracker if it doesn't exist
          console.log(`Creating new state tracker for session ${sessionId}`);
          tracker = new AIStateTracker(sessionId);
          this.stateTrackers.set(sessionId, tracker);
          
          // IMPORTANT: Broadcast initial state to sync with database
          // This ensures new sessions start with 'not-started' in the database
          this.broadcastStateUpdate(sessionId, tracker.getStatus());
          // Don't return - continue processing to set initial state
        }
        
        // State determination priority (highest to lowest):
        // 1. Bash prompt = 'not-started' (AI has exited)
        // 2. Thinking animation = 'working' (AI is processing)
        // 3. Multi-line input = 'waiting' (AI needs confirmation)
        // 4. Single-line prompt = 'idle' (AI is ready for input)
        
        // Check 1: Bash prompt detected = 'not-started' (gray)
        // Updated to support both legacy (root@container:/path#) and current (username$) formats
        let foundBashPrompt = false;
        if (cleanData.match(/(?:root@[\w-]+:[\w/~-]+#|\w+\$)\s*$/)) {
          foundBashPrompt = true;
        }
        
        if (foundBashPrompt) {
          // Bash prompt means Claude has exited - user is back at shell
          console.log(`Bash prompt found for ${sessionId}, current state: ${tracker?.currentState}`);
          if (tracker && tracker.currentState !== 'not-started') {
            console.log('Bash prompt detected - Claude exited, changing state from', tracker.currentState, 'to not-started');
            tracker.updateState('not-started', { context: 'bash' });
            this.broadcastStateUpdate(sessionId, tracker.getStatus());
          }
          return;
        }
        
        // Check 2: Thinking animation = 'working' (yellow)
        // This has priority over prompts because Claude shows prompts even while thinking
        if (foundThinking) {
          if (tracker.currentState !== 'working') {
            console.log('Thinking animation detected');
            tracker.updateState('working', { animation: true });
            this.broadcastStateUpdate(sessionId, tracker.getStatus());
          }
          return;
        }
        
        
        // Check 3: Multi-line input box = 'waiting' (purple)
        // This indicates Claude needs user confirmation or selection
        if (foundConfirmation) {
          // Only transition to waiting if not currently thinking
          if (!foundThinking && tracker.currentState !== 'waiting') {
            console.log('Multi-line input detected - transitioning to WAITING_INPUT');
            tracker.updateState('waiting', { inputType: 'confirmation' });
            this.broadcastStateUpdate(sessionId, tracker.getStatus());
          }
          return;
        }
        
        // Check 4: Single line prompt = 'idle' (blue)
        // This means Claude is active but waiting for user input
        if (foundPrompt && !foundConfirmation) {
          // Important: Check if we're still seeing thinking text without the animation
          // Claude's animation character disappears briefly, but the text remains
          const hasThinkingText = cleanData.match(/\w+ing….*\d+s.*tokens/);
          
          if (!hasThinkingText) {
            // No thinking text visible, safe to transition to idle
            if (tracker.currentState !== 'idle') {
              console.log('Single line prompt detected - Claude idle');
              tracker.updateState('idle', { active: true });
              this.broadcastStateUpdate(sessionId, tracker.getStatus());
            }
          }
          return;
        }
      } catch (error) {
        console.error('Error in onData handler:', error);
      }
    });
    
    console.log('Global session monitoring configured');
  }
  
  /**
   * Register patterns for a specific session
   * Called when a new task session is created
   */
  async registerSessionPatterns(sessionId) {
    // Create state tracker for the session if it doesn't exist
    if (!this.stateTrackers.has(sessionId)) {
      const tracker = new AIStateTracker(sessionId);
      this.stateTrackers.set(sessionId, tracker);
      console.log(`Created state tracker for session ${sessionId}`);
    }
    console.log(`Session ${sessionId} registered - patterns monitored via onData`);
  }

  /**
   * Handle pattern match events from Shelltender
   */
  handlePatternMatch(event) {
    const { sessionId, patternName, match, buffer } = event;
    const config = this.patternMatchers.get(patternName);
    
    if (!config || !config.handler) return;

    // Get or create state tracker for this session
    let tracker = this.stateTrackers.get(sessionId);
    if (!tracker) {
      tracker = new AIStateTracker(sessionId);
      this.stateTrackers.set(sessionId, tracker);
    }

    // Process the match
    const result = config.handler(match, sessionId);
    
    if (result.state) {
      // No special handling needed here - just update states normally
      
      // Update state
      const stateChange = tracker.updateState(result.state, result.data);
      
      // Send notification if needed
      if (stateChange.shouldNotify) {
        const notification = tracker.getNotificationContent();
        if (notification) {
          this.notificationService.sendNotification(sessionId, notification);
        }
      }

      // Broadcast state update to connected clients
      console.log(`State changed to ${result.state} for session ${sessionId}`);
      this.broadcastStateUpdate(sessionId, tracker.getStatus());
    } else if (result.data) {
      // Just update context without changing state
      tracker.updateState(tracker.currentState, result.data);
    }
  }

  /**
   * Broadcast state update to WebSocket clients and persist to database
   * This is the central point for all state changes - ensures frontend
   * and database stay in sync with the detected AI state.
   */
  async broadcastStateUpdate(sessionId, status) {
    // Extract task ID and db session ID from session ID (format: task-{taskId}-{dbSessionId})
    const sessionParts = sessionId.split('-');
    const taskId = sessionParts[1];
    const dbSessionId = sessionParts[2];
    
    // Update individual session state in database
    if (this.models && this.models.sessions && dbSessionId) {
      try {
        await this.models.sessions.updateSessionAIState(dbSessionId, status.currentState);
      } catch (error) {
        console.error(`Failed to update AI state for session ${dbSessionId}:`, error);
      }
    }
    
    // Get all active sessions for this task to calculate aggregate state
    let aggregateState = status.currentState;
    let sessionStates = [];
    
    if (this.models && this.models.sessions) {
      try {
        const activeSessions = await this.models.sessions.findAllActiveByTaskId(taskId);
        sessionStates = activeSessions.map(session => ({
          id: session.id,
          shelltenderSessionId: session.shelltender_session_id,
          tabName: session.tab_name,
          aiState: session.ai_state || 'not-started',
          aiAgent: session.ai_agent
        }));
        
        // Calculate aggregate state based on priority
        // Priority: waiting > working > idle > not-started
        const states = activeSessions.map(s => s.ai_state || 'not-started');
        if (states.includes('waiting')) {
          aggregateState = 'waiting';
        } else if (states.includes('working')) {
          aggregateState = 'working';
        } else if (states.includes('idle')) {
          aggregateState = 'idle';
        } else {
          aggregateState = 'not-started';
        }
      } catch (error) {
        console.error(`Failed to get active sessions for task ${taskId}:`, error);
      }
    }
    
    // Emit AI state changed event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(AI_EVENTS.STATE_CHANGED, { taskId, sessionState: {
        status: aggregateState,
        lastStateChange: new Date().toISOString(),
        sessionStates: sessionStates // Include individual session states
      }});
    }
    
    console.log(`AI state update: session ${sessionId} -> ${status.currentState}, task ${taskId} aggregate -> ${aggregateState}`);
  }

  /**
   * Get all sessions that need attention
   */
  getSessionsNeedingAttention() {
    const sessions = [];
    
    this.stateTrackers.forEach((tracker, sessionId) => {
      const status = tracker.getStatus();
      if (status.needsAttention) {
        sessions.push(status);
      }
    });

    return sessions.sort((a, b) => {
      // Sort by priority: errors first, then waiting for input
      if (a.currentState === 'error' && b.currentState !== 'error') return -1;
      if (b.currentState === 'error' && a.currentState !== 'error') return 1;
      return 0;
    });
  }

  /**
   * Acknowledge that a session has been handled
   */
  acknowledgeSession(sessionId) {
    const tracker = this.stateTrackers.get(sessionId);
    if (tracker) {
      // Reset to idle state when acknowledged
      tracker.updateState('idle', { acknowledged: true });
      this.broadcastStateUpdate(sessionId, tracker.getStatus());
    }
  }

  /**
   * Get status for a specific session
   */
  getSessionStatus(sessionId) {
    const tracker = this.stateTrackers.get(sessionId);
    return tracker ? tracker.getStatus() : null;
  }

  /**
   * Get all monitored sessions
   */
  getAllSessionStatuses() {
    const statuses = [];
    this.stateTrackers.forEach((tracker, sessionId) => {
      statuses.push(tracker.getStatus());
    });
    return statuses;
  }

  /**
   * Clean up tracker for a closed session
   */
  removeSession(sessionId) {
    this.stateTrackers.delete(sessionId);
  }
}