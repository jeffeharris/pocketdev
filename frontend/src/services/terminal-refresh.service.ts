/**
 * TerminalRefreshService - Domain service for terminal refresh operations
 * 
 * This deep module encapsulates the complex refresh logic that was previously
 * mixed into TerminalPanel. It determines what refresh events occur
 * but doesn't directly manipulate UI components.
 * 
 * Following Ousterhout's principles and separation of concerns:
 * - Service layer determines WHAT happened (domain events)
 * - Orchestrator/UI layer determines HOW to respond
 */

import type { TerminalSession } from '../types/task';

// Domain events that describe what happened, not what to do
export type RefreshEvent = 
  | { type: 'session-disconnected'; terminalId: string; sessionName: string }
  | { type: 'session-reconnected'; terminalId: string }
  | { type: 'reconnection-failed'; terminalId: string; reason: string }
  | { type: 'task-reload-required'; reason: string }
  | { type: 'refresh-completed'; terminalId: string }
  | { type: 'refresh-failed'; terminalId: string; error: string };

export interface RefreshOptions {
  taskId: string;
  activeTerminalId: string;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
}

export interface RefreshResult {
  success: boolean;
  message: string;
  events: RefreshEvent[];
}

export class TerminalRefreshService {
  /**
   * Analyze session state and determine what refresh events occurred
   * Returns domain events, not UI instructions
   */
  async refreshSession(options: RefreshOptions): Promise<RefreshResult> {
    const { activeTerminalId, terminals, sessionStatuses } = options;
    const events: RefreshEvent[] = [];
    
    // Phase 1: Assess current state
    const assessment = this.assessSessionState(activeTerminalId, terminals, sessionStatuses);
    if (!assessment.terminal) {
      return {
        success: false,
        message: 'No active terminal to refresh',
        events: []
      };
    }
    
    // Phase 2: Report domain events based on state
    if (assessment.isDisconnected) {
      events.push({
        type: 'session-disconnected',
        terminalId: activeTerminalId,
        sessionName: assessment.terminal.tabName || 'Unknown'
      });
      
      // Disconnected sessions require task reload
      events.push({
        type: 'task-reload-required',
        reason: 'Session disconnected - full reload needed'
      });
    } else {
      // Session is connected, just needs refresh
      events.push({
        type: 'refresh-completed',
        terminalId: activeTerminalId
      });
    }
    
    return {
      success: true,
      message: assessment.isDisconnected ? 'Session disconnected - reconnecting...' : 'Terminal refreshed',
      events
    };
  }
  
  /**
   * Analyze reconnection requirements for a specific session
   * Returns domain events about the reconnection attempt
   */
  getReconnectEvents(
    dbSessionId: string,
    terminals: Array<TerminalSession & { normalizedId: string }>,
    sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>
  ): RefreshEvent[] {
    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) {
      return [{
        type: 'reconnection-failed',
        terminalId: dbSessionId,
        reason: 'Terminal not found'
      }];
    }
    
    const status = sessionStatuses.get(terminal.normalizedId);
    const events: RefreshEvent[] = [];
    
    if (status === 'disconnected' || status === 'error') {
      // Report disconnection
      events.push({
        type: 'session-disconnected',
        terminalId: terminal.normalizedId,
        sessionName: terminal.tabName || 'Unknown'
      });
      
      // Disconnected sessions need full reload
      events.push({
        type: 'task-reload-required',
        reason: `Terminal "${terminal.tabName}" requires reconnection`
      });
    } else {
      // Session is connected, just refresh
      events.push({
        type: 'refresh-completed',
        terminalId: terminal.normalizedId
      });
    }
    
    return events;
  }
  
  /**
   * Check if any sessions are disconnected
   * Pure domain logic - no UI concerns
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