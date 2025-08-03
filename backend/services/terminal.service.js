import { executeCommandViaWebSocket, executeCommandViaMonitor } from '../utils/execute-command.js';
import { getAllAgents, getAgentConfig, getAgentLaunchCommand } from '../config/ai-agents.js';
import path from 'path';

/**
 * TerminalService - Handles all terminal session operations
 * 
 * This service provides a clean interface for terminal session management,
 * hiding the complexity of session ID mapping, Shelltender API integration,
 * monitor coordination, and session lifecycle management.
 * 
 * Following deep module principles: simple interface (8 methods), 
 * complex implementation handling multiple session concerns.
 * 
 * Key complexity hidden:
 * - Session ID mapping (sessionId vs dbSessionId vs shelltenderSessionId)
 * - Shelltender API communication
 * - Monitor coordination (aiMonitor, wsAdapter)
 * - Session state aggregation
 * - Multi-terminal support
 */
export class TerminalService {
  constructor(models, eventEmitterService = null) {
    this.models = models;
    this.eventEmitterService = eventEmitterService;
    this.shelltenderUrl = process.env.SHELLTENDER_API_URL || 'http://shelltender:8080';
    this.authKey = process.env.SHELLTENDER_MONITOR_AUTH_KEY || 'pocketdev-monitor-key-2024';
  }

  /**
   * Create a new terminal session for a task
   * @param {string} taskId - Task ID
   * @param {Object} sessionData - Session configuration
   * @param {Object} monitors - Monitor services (wsAdapter, aiMonitor)
   * @returns {Promise<Object>} Session information with unified ID handling
   */
  async createSession(taskId, sessionData = {}, monitors = {}) {
    const { tabName, aiAgent, initialPrompt, workingDirectory } = sessionData;
    
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    // Check terminal limit (6 per task)
    const currentTerminals = await this.models.sessions.findAllActiveByTaskId(taskId);
    if (currentTerminals.length >= 6) {
      throw new Error(`Maximum number of terminals (6) reached for this task`);
    }
    
    // Generate session IDs (hide the complexity of multiple ID types)
    const dbSessionId = this.models.sessions.generateId();
    const shelltenderSessionId = `task-${taskId}-${dbSessionId}`;
    
    // Create database record
    const dbSession = await this.models.sessions.create(taskId, {
      id: dbSessionId,
      sessionId: shelltenderSessionId,
      shelltenderSessionId: shelltenderSessionId,
      tabName: tabName || 'Main',
      aiAgent: aiAgent || 'claude',
      metadata: {
        initialPrompt,
        workingDirectory
      }
    });
    
    // Check if Shelltender session already exists
    const existingSession = await this._checkShelltenderSession(shelltenderSessionId);
    
    if (existingSession) {
      // Reconnect to existing session
      await this._connectMonitors(shelltenderSessionId, monitors);
      
      return {
        sessionId: shelltenderSessionId,
        dbSessionId: dbSession.id,
        tabName: dbSession.tab_name,
        tabOrder: dbSession.tab_order,
        aiAgent: dbSession.ai_agent,
        isReconnected: true
      };
    }
    
    // Create new Shelltender session
    const sessionInfo = await this._createShelltenderSession(
      shelltenderSessionId,
      task,
      dbSession,
      workingDirectory
    );
    
    // Connect monitors
    await this._connectMonitors(shelltenderSessionId, monitors);
    
    const result = {
      ...sessionInfo,
      isReconnected: false
    };
    
    // Emit terminal created event
    if (this.eventEmitterService) {
      this.eventEmitterService.emitTerminalCreated({
        ...dbSession,
        task_id: taskId,
        sessionId: shelltenderSessionId
      });
    }
    
    return result;
  }

  /**
   * Delete a terminal session completely
   * @param {string} sessionId - Unified session ID (can be dbSessionId or shelltenderSessionId)
   * @returns {Promise<Object>} Deletion result
   */
  async deleteSession(sessionId) {
    // Resolve session details (handle different ID types)
    const sessionDetails = await this._resolveSessionDetails(sessionId);
    if (!sessionDetails) {
      throw new Error('Session not found');
    }
    
    // Terminate Shelltender session if it exists
    if (sessionDetails.shelltenderSessionId) {
      try {
        const response = await fetch(`${this.shelltenderUrl}/api/sessions/${sessionDetails.shelltenderSessionId}`, {
          method: 'DELETE'
        });
        
        if (!response.ok) {
          console.error(`Failed to terminate Shelltender session ${sessionDetails.shelltenderSessionId}:`, response.statusText);
        }
      } catch (error) {
        console.error(`Error terminating Shelltender session ${sessionDetails.shelltenderSessionId}:`, error);
        // Continue with database deletion even if Shelltender deletion fails
      }
    }
    
    // Delete from database
    await this.models.sessions.delete(sessionDetails.dbSessionId);
    
    // Emit terminal closed event
    if (this.eventEmitterService) {
      this.eventEmitterService.emitTerminalClosed(sessionDetails.shelltenderSessionId);
    }
    
    return { 
      success: true, 
      message: 'Terminal session deleted',
      sessionId: sessionDetails.shelltenderSessionId
    };
  }

  /**
   * Reset terminal session to original state
   * @param {string} sessionId - Unified session ID
   * @returns {Promise<Object>} Reset result
   */
  async resetSession(sessionId) {
    // Resolve session details
    const sessionDetails = await this._resolveSessionDetails(sessionId);
    if (!sessionDetails) {
      throw new Error('Session not found');
    }
    
    const task = await this.models.tasks.findById(sessionDetails.taskId);
    if (!task) {
      throw new Error('Task not found');
    }
    
    const shelltenderSessionId = sessionDetails.shelltenderSessionId;
    
    // Step 1: Kill the existing session
    try {
      await fetch(`${this.shelltenderUrl}/sessions/${shelltenderSessionId}`, {
        method: 'DELETE',
        headers: {
          'X-Auth-Key': this.authKey
        }
      });
    } catch (error) {
      console.log('Could not delete session, continuing...', error.message);
    }
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Create a new session with the same parameters
    const createResponse = await fetch(`${this.shelltenderUrl}/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Auth-Key': this.authKey
      },
      body: JSON.stringify({
        id: shelltenderSessionId,
        name: `Task ${task.id}`,
        cwd: task.worktree_path,
        restrictToPath: task.worktree_path,
        allowUpwardNavigation: false,
        blockedCommands: ['sudo', 'su', 'chmod', 'chown'],
        readOnlyMode: false,
        env: {
          TASK_ID: task.id,
          WORKTREE_PATH: task.worktree_path
        },
        metadata: {
          taskId: task.id,
          worktreePath: task.worktree_path
        }
      })
    });
    
    if (!createResponse.ok) {
      throw new Error('Failed to create new session');
    }
    
    const newSession = await createResponse.json();
    
    return {
      sessionId: shelltenderSessionId,
      message: 'Session reset successfully',
      workingDirectory: task.worktree_path,
      newSession
    };
  }

  /**
   * Update terminal tab properties
   * @param {string} sessionId - Unified session ID
   * @param {Object} tabData - Tab update data
   * @returns {Promise<Object>} Updated session
   */
  async updateSessionTab(sessionId, tabData) {
    const { tabName, tabOrder } = tabData;
    
    // Resolve to database session ID
    const sessionDetails = await this._resolveSessionDetails(sessionId);
    if (!sessionDetails) {
      throw new Error('Session not found');
    }
    
    // Update tab in database
    const updatedSession = await this.models.sessions.updateTab(sessionDetails.dbSessionId, {
      tabName,
      tabOrder
    });
    
    if (!updatedSession) {
      throw new Error('Failed to update session tab');
    }
    
    return updatedSession;
  }

  /**
   * Execute command in terminal session
   * @param {string} sessionId - Unified session ID
   * @param {string} command - Command to execute
   * @param {Object} monitor - Monitor instance (wsAdapter)
   * @returns {Promise<Object>} Execution result
   */
  async executeCommand(sessionId, command, monitor = null) {
    if (command === undefined) {
      throw new Error('Command is required');
    }
    
    // Resolve to Shelltender session ID
    const sessionDetails = await this._resolveSessionDetails(sessionId);
    if (!sessionDetails) {
      throw new Error('Session not found');
    }
    
    const shelltenderSessionId = sessionDetails.shelltenderSessionId;
    let result;
    
    console.log('[TerminalService.executeCommand] Monitor available:', !!monitor, 'Session:', shelltenderSessionId, 'Command:', command);
    
    if (monitor && monitor.sessions && monitor.sessions.has(shelltenderSessionId)) {
      console.log('[TerminalService.executeCommand] Using existing monitor connection');
      result = await executeCommandViaMonitor(shelltenderSessionId, command, monitor);
    } else if (monitor) {
      console.log('[TerminalService.executeCommand] Monitor exists but session not connected, connecting first...');
      await monitor.connectToSession(shelltenderSessionId);
      result = await executeCommandViaMonitor(shelltenderSessionId, command, monitor);
    } else {
      console.log('[TerminalService.executeCommand] No monitor available, using direct WebSocket connection');
      result = await executeCommandViaWebSocket(shelltenderSessionId, command);
    }
    
    return {
      sessionId: shelltenderSessionId,
      command,
      ...result
    };
  }

  /**
   * Get comprehensive session state (live + database)
   * @param {string} sessionId - Unified session ID
   * @param {Object} monitors - Monitor services for live state
   * @returns {Promise<Object>} Complete session state
   */
  async getSessionState(sessionId, monitors = {}) {
    // Resolve session details
    const sessionDetails = await this._resolveSessionDetails(sessionId);
    if (!sessionDetails) {
      throw new Error('Session not found');
    }
    
    // Get database session info
    const dbSession = await this.models.sessions.findById(sessionDetails.dbSessionId);
    
    // Get live AI state if available
    let liveAIState = null;
    if (monitors.aiMonitor && monitors.aiMonitor.getSessionStatus) {
      liveAIState = monitors.aiMonitor.getSessionStatus(sessionDetails.shelltenderSessionId);
    }
    
    // Get Shelltender session status
    let shelltenderStatus = 'not-found';
    try {
      const response = await fetch(`${this.shelltenderUrl}/api/sessions/${sessionDetails.shelltenderSessionId}`);
      if (response.ok) {
        const session = await response.json();
        shelltenderStatus = session.status === 'active' ? 'active' : 'inactive';
      }
    } catch (error) {
      console.error(`Failed to check Shelltender status for session ${sessionId}:`, error.message);
    }
    
    return {
      sessionId: sessionDetails.shelltenderSessionId,
      dbSessionId: sessionDetails.dbSessionId,
      taskId: sessionDetails.taskId,
      tabName: dbSession?.tab_name,
      tabOrder: dbSession?.tab_order,
      aiAgent: dbSession?.ai_agent,
      aiState: liveAIState?.currentState || dbSession?.ai_state || 'not-started',
      shelltenderStatus,
      lastStateChange: liveAIState ? new Date().toISOString() : dbSession?.updated_at,
      metadata: dbSession?.metadata
    };
  }

  /**
   * Get all terminal sessions for a task
   * @param {string} taskId - Task ID
   * @param {Object} monitors - Monitor services for live state
   * @returns {Promise<Array>} Array of session states
   */
  async getTaskSessions(taskId, monitors = {}) {
    const sessions = await this.models.sessions.findAllActiveByTaskId(taskId);
    
    // Enrich with live state and Shelltender status
    const enrichedSessions = await Promise.all(
      sessions.map(async (session) => {
        try {
          return await this.getSessionState(session.id, monitors);
        } catch (error) {
          console.error(`Failed to get state for session ${session.id}:`, error.message);
          return {
            sessionId: session.session_id || session.shelltender_session_id,
            dbSessionId: session.id,
            taskId: session.task_id,
            tabName: session.tab_name,
            tabOrder: session.tab_order,
            aiAgent: session.ai_agent,
            aiState: session.ai_state || 'not-started',
            shelltenderStatus: 'error',
            lastStateChange: session.updated_at,
            metadata: session.metadata
          };
        }
      })
    );
    
    return enrichedSessions;
  }

  /**
   * Acknowledge AI session (for handling AI prompts)
   * @param {string} sessionId - Unified session ID
   * @param {Object} aiMonitor - AI monitor instance
   * @returns {Promise<Object>} Acknowledgment result
   */
  async acknowledgeSession(sessionId, aiMonitor) {
    if (!aiMonitor || !aiMonitor.acknowledgeSession) {
      throw new Error('AI monitoring not available');
    }
    
    // Resolve to Shelltender session ID
    const sessionDetails = await this._resolveSessionDetails(sessionId);
    if (!sessionDetails) {
      throw new Error('Session not found');
    }
    
    aiMonitor.acknowledgeSession(sessionDetails.shelltenderSessionId);
    
    return { 
      message: 'Session acknowledged',
      sessionId: sessionDetails.shelltenderSessionId 
    };
  }

  // Additional utility methods for AI agents

  /**
   * Get available AI agents with installation status
   * @returns {Array} AI agents with status
   */
  getAvailableAgents() {
    const agents = getAllAgents();
    
    // Check which agents are actually installed in the container
    return agents.map(agent => ({
      ...agent,
      installed: agent.id === 'claude' // Only Claude is guaranteed to be installed
    }));
  }

  /**
   * Get launch command for a specific AI agent
   * @param {string} agentId - Agent ID
   * @param {string} prompt - Initial prompt
   * @returns {Object} Agent and command info
   */
  getAgentLaunchCommand(agentId, prompt) {
    const agent = getAgentConfig(agentId);
    if (!agent) {
      throw new Error('Agent not found');
    }
    
    const command = getAgentLaunchCommand(agentId, prompt);
    
    return {
      agentId,
      agent,
      command,
      supportsPrompt: agent.capabilities.acceptsPrompt
    };
  }

  // Private helper methods

  /**
   * Resolve session details from any type of session ID
   * Handles the complexity of multiple ID types internally
   * @private
   */
  async _resolveSessionDetails(sessionId) {
    let dbSession = null;
    
    // Try to find by database ID first
    try {
      dbSession = await this.models.sessions.findById(sessionId);
    } catch (error) {
      // Not a database ID, continue
    }
    
    // If not found, try to find by Shelltender session ID
    if (!dbSession) {
      try {
        dbSession = await this.models.sessions.findByShelltenderSessionId(sessionId);
      } catch (error) {
        // Not found by Shelltender ID either
      }
    }
    
    // If still not found, extract task ID from session pattern (task-{taskId}-{dbSessionId})
    if (!dbSession && sessionId.startsWith('task-')) {
      const parts = sessionId.split('-');
      if (parts.length >= 3) {
        const taskId = parts[1];
        const sessions = await this.models.sessions.findAllActiveByTaskId(taskId);
        dbSession = sessions.find(s => 
          s.session_id === sessionId || 
          s.shelltender_session_id === sessionId
        );
      }
    }
    
    if (!dbSession) {
      return null;
    }
    
    return {
      dbSessionId: dbSession.id,
      shelltenderSessionId: dbSession.session_id || dbSession.shelltender_session_id,
      taskId: dbSession.task_id
    };
  }

  /**
   * Check if Shelltender session exists and is active
   * @private
   */
  async _checkShelltenderSession(sessionId) {
    try {
      const response = await fetch(`${this.shelltenderUrl}/api/sessions/${sessionId}`);
      
      if (response.ok) {
        const session = await response.json();
        return session.status === 'active' ? session : null;
      }
      return null;
    } catch (error) {
      console.error('Error checking Shelltender session:', error);
      return null;
    }
  }

  /**
   * Create new Shelltender session
   * @private
   */
  async _createShelltenderSession(shelltenderSessionId, task, dbSession, workingDirectory) {
    // Get git config
    const gitUserName = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    const gitConfig = {
      name: gitUserName?.value || 'Pocketdev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
    
    // Set working directory
    const workDir = workingDirectory 
      ? path.join(task.worktree_path, workingDirectory)
      : task.worktree_path;
    
    const createResponse = await fetch(`${this.shelltenderUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId: shelltenderSessionId,
        command: '/bin/bash',
        args: ['--login', '-i'],
        cwd: workDir,
        env: {
          TASK_ID: task.id,
          DB_SESSION_ID: dbSession.id,
          WORKTREE_PATH: task.worktree_path,
          TERM: 'xterm-256color',
          PS1_ENV: `\\033[32m\\u\\033[0m\\$ `,
          TASK_NAME: task.name,
          HISTFILE: path.join(task.worktree_path, '.pocketdev_task_history'),
          HISTSIZE: '10000',
          HISTFILESIZE: '20000',
          GIT_USER_NAME: gitConfig.name,
          GIT_USER_EMAIL: gitConfig.email
        },
        metadata: {
          taskId: task.id,
          dbSessionId: dbSession.id,
          title: task.name,
          type: 'task',
          tabName: dbSession.tab_name,
          aiAgent: dbSession.ai_agent
        }
      })
    });
    
    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      throw new Error(`Failed to create session: ${createResponse.statusText} - ${errorText}`);
    }
    
    return {
      sessionId: shelltenderSessionId,
      dbSessionId: dbSession.id,
      shelltenderSessionId: shelltenderSessionId,
      tabName: dbSession.tab_name,
      tabOrder: dbSession.tab_order,
      aiAgent: dbSession.ai_agent
    };
  }

  /**
   * Connect monitors to session
   * @private
   */
  async _connectMonitors(shelltenderSessionId, monitors) {
    const { wsAdapter, aiMonitor } = monitors;
    
    // Connect WebSocket adapter
    if (wsAdapter && !wsAdapter.sessions?.has(shelltenderSessionId)) {
      try {
        await wsAdapter.connectToSession(shelltenderSessionId);
      } catch (error) {
        console.error('Failed to connect monitor to session:', error.message);
      }
    }
    
    // Register with AI monitor
    if (aiMonitor && aiMonitor.registerSessionPatterns) {
      try {
        await aiMonitor.registerSessionPatterns(shelltenderSessionId);
      } catch (error) {
        console.error('Failed to register session patterns:', error.message);
      }
    }
  }

  /**
   * Clean up all terminal sessions for a task (used during task deletion)
   * @param {string} taskId - Task ID
   * @returns {Promise<void>}
   */
  async cleanupTaskSessions(taskId) {
    try {
      const sessions = await this.models.sessions.findAllActiveByTaskId(taskId);
      
      if (sessions.length === 0) {
        return;
      }
      
      // Terminate each Shelltender session
      for (const session of sessions) {
        if (session.shelltender_session_id) {
          try {
            const response = await fetch(`${this.shelltenderUrl}/api/sessions/${session.shelltender_session_id}`, {
              method: 'DELETE'
            });
            
            if (!response.ok) {
              console.error(`Failed to terminate session ${session.shelltender_session_id}:`, response.statusText);
            }
          } catch (error) {
            console.error(`Error terminating session ${session.shelltender_session_id}:`, error.message);
          }
        }
      }
      
      console.log(`Cleaned up ${sessions.length} sessions for task ${taskId}`);
    } catch (error) {
      console.error(`Error cleaning up sessions for task ${taskId}:`, error);
    }
  }
}