import { getSessionInfo } from '../../../shared/shelltender-client.js';

/**
 * TaskTerminalManager - Handles terminal session management for tasks
 * This is an internal service used by TaskService
 */
export class TaskTerminalManager {
  constructor(models, eventEmitterService) {
    this.models = models;
    this.eventEmitterService = eventEmitterService;
    this._terminalService = null;
  }

  /**
   * Create or reconnect to terminal session
   */
  async createSession(taskId, sessionData = {}, monitors = {}) {
    const terminalService = await this._getTerminalService();
    return await terminalService.createSession(taskId, sessionData, monitors);
  }

  /**
   * Stop a terminal session
   */
  async stopSession(taskId, sessionId) {
    const terminalService = await this._getTerminalService();
    return await terminalService.stopSession(sessionId || `task-${taskId}`);
  }

  /**
   * Clean up all sessions for a task
   */
  async cleanupSessions(taskId) {
    const terminalService = await this._getTerminalService();
    return await terminalService.cleanupTaskSessions(taskId);
  }

  /**
   * Create initial task session
   */
  async createTaskSession(taskId, worktreePath) {
    // Check for active Shelltender sessions
    let sessionInfo = null;
    
    try {
      const sessionId = `task-${taskId}`;
      const existingSession = await getSessionInfo(sessionId);
      
      if (existingSession?.active) {
        sessionInfo = {
          sessionId,
          isReconnect: true,
          ...existingSession
        };
      } else {
        // Create new Shelltender session
        const terminalService = await this._getTerminalService();
        const session = await terminalService.createSession(taskId, {
          workingDirectory: worktreePath,
          sessionId
        });
        
        if (session) {
          sessionInfo = {
            sessionId: session.id,
            isReconnect: false,
            ...session
          };
        }
      }
    } catch (error) {
      console.warn('Could not create terminal session:', error.message);
    }
    
    return sessionInfo;
  }

  /**
   * Get terminal sessions for a task
   */
  async getTaskTerminals(taskId, limit = 6) {
    const terminals = await this.models.terminals.findByTaskId(taskId, limit);
    
    // Enhance terminals with session status
    const enhancedTerminals = await Promise.all(
      terminals.map(async (terminal) => {
        let sessionStatus = null;
        
        try {
          const sessionInfo = await getSessionInfo(terminal.session_id);
          if (sessionInfo) {
            sessionStatus = {
              active: sessionInfo.active,
              aiState: sessionInfo.aiState,
              lastActivity: sessionInfo.lastActivity
            };
          }
        } catch (error) {
          // Session not found or error getting info
          sessionStatus = {
            active: false,
            error: error.message
          };
        }
        
        return {
          ...terminal,
          sessionStatus
        };
      })
    );
    
    return enhancedTerminals;
  }

  /**
   * Get TerminalService instance (lazy loading to avoid circular dependencies)
   * @private
   */
  async _getTerminalService() {
    if (!this._terminalService) {
      // Import TerminalService only when needed
      const { TerminalService } = await import('../terminal.service.js');
      this._terminalService = new TerminalService(this.models, this.eventEmitterService);
    }
    return this._terminalService;
  }
}