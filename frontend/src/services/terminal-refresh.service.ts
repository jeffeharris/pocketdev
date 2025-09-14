/**
 * TerminalRefreshService - Domain service for terminal refresh operations
 * 
 * This deep module encapsulates the complex refresh logic that was previously
 * mixed into TerminalPanel. It determines what refresh actions are needed
 * but doesn't directly manipulate UI components.
 * 
 * Following Ousterhout's principles and separation of concerns:
 * - Service layer determines WHAT needs to be done
 * - UI layer handles HOW to do it
 */

import type { Task, TerminalSession } from '../types/task';

// Actions that the UI layer should perform
export type RefreshAction = 
  | { type: 'refresh-terminal'; terminalId: string }
  | { type: 'reload-task' }
  | { type: 'fit-terminal'; terminalId: string }
  | { type: 'show-notification'; message: string; level: 'success' | 'warning' | 'error' };

export interface RefreshOptions {
  taskId: string;
  activeTerminalId: string;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
}

export interface RefreshResult {
  success: boolean;
  message: string;
  actions: RefreshAction[];
}

export class TerminalRefreshService {
  /**
   * Determine what refresh actions are needed
   * Returns a list of actions for the UI to perform
   */
  async refreshSession(options: RefreshOptions): Promise<RefreshResult> {
    const { activeTerminalId, terminals, sessionStatuses } = options;
    const actions: RefreshAction[] = [];
    
    // Phase 1: Assess current state
    const assessment = this.assessSessionState(activeTerminalId, terminals, sessionStatuses);
    if (!assessment.terminal) {
      return {
        success: false,
        message: 'No active terminal to refresh',
        actions: []
      };
    }
    
    // Phase 2: Determine refresh actions needed
    if (assessment.isDisconnected) {
      // For disconnected sessions, we need a full reload
      actions.push({ type: 'reload-task' });
      actions.push({ 
        type: 'show-notification', 
        message: 'Reconnecting terminal session...', 
        level: 'warning' 
      });
    } else {
      // For connected sessions, just refresh the terminal
      actions.push({ type: 'refresh-terminal', terminalId: activeTerminalId });
      actions.push({ type: 'fit-terminal', terminalId: activeTerminalId });
    }
    
    // Phase 3: Add fitting actions with delay
    // Terminal fitting needs to happen after DOM updates
    setTimeout(() => {
      actions.push({ type: 'fit-terminal', terminalId: activeTerminalId });
    }, 200);
    
    return {
      success: true,
      message: assessment.isDisconnected ? 'Reconnecting...' : 'Terminal refreshed',
      actions
    };
  }
  
  /**
   * Determine reconnection actions for a specific session
   */
  getReconnectActions(
    dbSessionId: string,
    terminals: Array<TerminalSession & { normalizedId: string }>,
    sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>
  ): RefreshAction[] {
    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) return [];
    
    const status = sessionStatuses.get(terminal.normalizedId);
    const actions: RefreshAction[] = [];
    
    if (status === 'disconnected' || status === 'error') {
      // Disconnected sessions need a full reload
      actions.push({ type: 'reload-task' });
      actions.push({ 
        type: 'show-notification', 
        message: `Reconnecting terminal "${terminal.tabName}"...`, 
        level: 'warning' 
      });
    } else {
      // Connected sessions just need refresh
      actions.push({ type: 'refresh-terminal', terminalId: terminal.normalizedId });
    }
    
    return actions;
  }
  
  /**
   * Check if any sessions are disconnected
   */
  hasDisconnectedSessions(sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>): boolean {
    for (const status of sessionStatuses.values()) {
      if (status === 'disconnected' || status === 'error') {
        return true;
      }
    }
    return false;
  }
  
  // Private helper methods
  
  private assessSessionState(
    activeTerminalId: string,
    terminals: Array<TerminalSession & { normalizedId: string }>,
    sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>
  ) {
    const terminal = terminals.find(t => t.normalizedId === activeTerminalId);
    const sessionStatus = sessionStatuses.get(activeTerminalId);
    const isDisconnected = sessionStatus === 'disconnected' || sessionStatus === 'error';
    
    return {
      terminal,
      sessionStatus,
      isDisconnected
    };
  }
}

// Export singleton instance
export const terminalRefreshService = new TerminalRefreshService();