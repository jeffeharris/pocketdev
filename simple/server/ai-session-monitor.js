/**
 * AI Session Monitor
 * Monitors AI developer sessions (Claude Code, GitHub Copilot, etc.) using Shelltender's pattern matching
 * Detects when sessions need attention and manages notifications
 */

import { AIStateTracker, AIStates } from './ai-state-tracker.js';

export class AISessionMonitor {
  constructor(sessionManager, wsServer, notificationService) {
    this.sessionManager = sessionManager;
    this.wsServer = wsServer;
    this.notificationService = notificationService;
    this.stateTrackers = new Map(); // sessionId -> AIStateTracker
    this.patternMatchers = new Map(); // pattern name -> config
  }

  /**
   * Register AI-specific patterns with EventManager
   * Uses Shelltender v0.2.6's AgenticCodingPatterns
   */
  registerPatterns(eventManager) {
    this.eventManager = eventManager;
    
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
            state: AIStates.THINKING,
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
          state: AIStates.THINKING,
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
            state: AIStates.LOADING_CONTEXT,
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
          state: AIStates.WAITING_INPUT,
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
            state: AIStates.RUNNING,  // Blue - Claude is active but idle
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
            state: AIStates.WAITING_INPUT,
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
          state: AIStates.COMPLETED,
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
            state: AIStates.ERROR,
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
          state: AIStates.WAITING_INPUT,
          data: { 
            inputType: 'clarification',
            prompt: match[0]
          }
        })
      },
      
      // Bash prompt - Claude has exited (high priority to clear other states)
      'bash-prompt': {
        pattern: /root@[\w-]+:[\w/~-]+#\s*$/,
        type: 'context',
        priority: 'high',
        handler: (match, sessionId) => ({
          state: AIStates.IDLE,
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
          state: AIStates.RUNNING,
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
        
        // Log all data for debugging
        if ((sessionId === 'task-7d29e028' || sessionId === 'task-7d29e08') && data.length > 5) {
          console.log(`DATA for ${sessionId}:`, JSON.stringify(data.substring(0, 200)));
        }
        
        // Strip ANSI escape sequences for pattern matching
        // This prevents control sequences from interfering
        const cleanData = data.replace(/\x1b\[[0-9;]*[a-zA-Z]/g, '');
        
        // Log data for any active task to debug
        if (sessionId.startsWith('task-')) {
          // Only log if it contains something interesting
          if (cleanData.includes('│') || cleanData.includes('ing') || cleanData.includes('bash')) {
            console.log(`[${sessionId}] DATA: ${cleanData.substring(0, 100).replace(/\n/g, '\\n')}`);
          }
        }
        
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
        
        // Log data for active sessions
        try {
          if (sessionId && (sessionId.includes('7d29e028') || sessionId.includes('0d2af90a'))) {
            console.log(`[${sessionId}] Processing data length: ${cleanData.length}`);
            if (cleanData.includes('ing') || cleanData.includes('●') || cleanData.includes('✻')) {
              console.log(`[${sessionId}] Potential thinking data: ${cleanData.substring(0, 100)}`);
            }
          }
        } catch (logError) {
          console.error('Error in debug logging:', logError);
        }
        
        // Get tracker early for debugging
        const tracker = this.stateTrackers.get(sessionId);
        
        // Debug: Log any data that contains the prompt box
        if (cleanData.includes('│') && cleanData.includes('>')) {
          console.log(`DEBUG: Prompt detected in session ${sessionId}, current state: ${tracker?.currentState}`);
        }
        
        // FIRST: Check for thinking patterns - they have absolute priority
        ['claude-thinking', 'claude-processing'].forEach(patternName => {
          const config = this.patternMatchers.get(patternName);
          if (config) {
            const match = cleanData.match(config.pattern);
            if (match) {
              foundThinking = true;
              recent.lastThinking = Date.now();
              console.log(`THINKING DETECTED: ${patternName} - ${match[0]}`);
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
                console.log(`CONFIRMATION FOUND: "${match[0]}"`);
              }
              
              recent.patterns.add(patternName);
            }
          });
        }
        
        // Handle state transitions based on what we found
        if (!tracker) {
          // Create tracker if it doesn't exist
          const newTracker = new AIStateTracker(sessionId);
          this.stateTrackers.set(sessionId, newTracker);
          return;
        }
        
        // Simple priority-based state determination:
        // 1. Bash prompt detected = IDLE (gray)
        let foundBashPrompt = false;
        if (cleanData.match(/root@[\w-]+:[\w/~-]+#\s*$/)) {
          foundBashPrompt = true;
        }
        
        if (foundBashPrompt) {
          // Only transition to bash if we haven't seen thinking recently
          const timeSinceThinking = Date.now() - recent.lastThinking;
          if (tracker.currentState !== AIStates.IDLE && timeSinceThinking > 1500) {
            console.log('Bash prompt detected - Claude exited');
            tracker.updateState(AIStates.IDLE, { context: 'bash' });
            this.broadcastStateUpdate(sessionId, tracker.getStatus());
          }
          return;
        }
        
        // 2. Thinking animation = THINKING (yellow) - HIGHEST PRIORITY after bash
        if (foundThinking) {
          if (tracker.currentState !== AIStates.THINKING) {
            console.log('Thinking animation detected');
            tracker.updateState(AIStates.THINKING, { animation: true });
            this.broadcastStateUpdate(sessionId, tracker.getStatus());
          }
          return;
        }
        
        
        // 3. Multi-line input box with text = WAITING_INPUT (purple)
        // Confirmation has priority over single prompt
        if (foundConfirmation) {
          // If we found confirmation but no thinking, Claude has stopped thinking
          if (!foundThinking && tracker.currentState !== AIStates.WAITING_INPUT) {
            console.log('Multi-line input detected - transitioning to WAITING_INPUT');
            tracker.updateState(AIStates.WAITING_INPUT, { inputType: 'confirmation' });
            this.broadcastStateUpdate(sessionId, tracker.getStatus());
          }
          return;
        }
        
        // 4. Single line input box with > = RUNNING (blue)
        // Only if no confirmation found
        if (foundPrompt && !foundConfirmation) {
          // Only transition from thinking after debounce period
          if (tracker.currentState === AIStates.THINKING) {
            const timeSinceThinking = Date.now() - recent.lastThinking;
            if (timeSinceThinking > 1500) {
              console.log('Single line prompt detected - Claude idle');
              tracker.updateState(AIStates.RUNNING, { active: true });
              this.broadcastStateUpdate(sessionId, tracker.getStatus());
            }
          } else if (tracker.currentState !== AIStates.RUNNING) {
            console.log('Single line prompt detected - Claude idle');
            tracker.updateState(AIStates.RUNNING, { active: true });
            this.broadcastStateUpdate(sessionId, tracker.getStatus());
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
   * Broadcast state update to WebSocket clients
   */
  broadcastStateUpdate(sessionId, status) {
    // Send through Shelltender's WebSocket server
    if (this.wsServer && this.wsServer.sendToAll) {
      this.wsServer.sendToAll({
        type: 'ai_state_update',
        sessionId,
        data: status
      });
    } else if (this.wsServer && this.wsServer.clients) {
      // Try direct client broadcast
      this.wsServer.clients.forEach(client => {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(JSON.stringify({
            type: 'ai_state_update',
            sessionId,
            data: status
          }));
        }
      });
    } else {
      console.log('AI state update:', sessionId, status.currentState);
    }
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
      if (a.currentState === AIStates.ERROR && b.currentState !== AIStates.ERROR) return -1;
      if (b.currentState === AIStates.ERROR && a.currentState !== AIStates.ERROR) return 1;
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
      tracker.updateState(AIStates.IDLE, { acknowledged: true });
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