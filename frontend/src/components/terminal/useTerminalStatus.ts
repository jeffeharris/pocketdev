/**
 * useTerminalStatus Hook
 * 
 * Manages terminal session status tracking and reconnection logic.
 * Extracts ~60 lines of status management and notification handling.
 * 
 * Responsibilities:
 * - Tracking connection status for each terminal
 * - Handling automatic reconnection attempts
 * - Managing status-related notifications
 * - Coordinating with WebSocket real-time updates
 */

import { useCallback } from 'react';
import type { TerminalSession } from '@shared/types';

interface UseTerminalStatusProps {
  terminals: TerminalSession[];
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
  getNormalizedId: (terminal: TerminalSession) => string;
  dispatch: (action: any) => void;
  showNotification: (type: 'success' | 'error' | 'warning', message: string) => void;
  handleReconnectSession?: (dbSessionId: string) => void;
}

export function useTerminalStatus({
  terminals,
  sessionStatuses,
  getNormalizedId,
  dispatch,
  showNotification,
  handleReconnectSession
}: UseTerminalStatusProps) {
  
  /**
   * Handle session status changes from DirectTerminal components
   */
  const handleSessionStatus = useCallback((dbSessionId: string, status: 'connected' | 'disconnected' | 'error') => {
    // Find terminal and get normalized ID
    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) return;
    
    const normalizedId = terminal.normalizedId || getNormalizedId(terminal);
    
    // Update status in reducer state
    dispatch({
      type: 'UPDATE_SESSION_STATUS',
      dbSessionId: normalizedId, // Use normalized ID as key
      status
    });
    
    // Handle status-specific actions
    if (status === 'disconnected') {
      console.warn(`[TerminalStatus] Session disconnected for ${terminal.tabName}`);
      
      // Attempt automatic reconnection after a delay
      if (handleReconnectSession) {
        setTimeout(() => {
          handleReconnectSession(dbSessionId);
        }, 2000);
      }
    } else if (status === 'error') {
      console.error(`[TerminalStatus] Session error for ${terminal.tabName}`);
      
      // Show error notification
      showNotification('error', `Terminal "${terminal.tabName}" encountered an error`);
    } else if (status === 'connected') {
      // Check previous status to show reconnection message
      const prevStatus = sessionStatuses.get(normalizedId);
      if (prevStatus === 'disconnected' || prevStatus === 'error') {
        showNotification('success', `Terminal "${terminal.tabName}" reconnected`);
      }
    }
  }, [terminals, sessionStatuses, getNormalizedId, dispatch, showNotification, handleReconnectSession]);
  
  /**
   * Check if any session is disconnected
   */
  const hasDisconnectedSessions = useCallback((): boolean => {
    return Array.from(sessionStatuses.values()).some(
      status => status === 'disconnected' || status === 'error'
    );
  }, [sessionStatuses]);
  
  /**
   * Get status for a specific session
   */
  const getSessionStatus = useCallback((sessionId: string): 'connected' | 'disconnected' | 'error' | undefined => {
    // Try to find terminal to get normalized ID
    const terminal = terminals.find(t => 
      t.dbSessionId === sessionId || 
      t.sessionId === sessionId || 
      t.shelltenderSessionId === sessionId
    );
    
    if (terminal) {
      const normalizedId = terminal.normalizedId || getNormalizedId(terminal);
      return sessionStatuses.get(normalizedId);
    }
    
    // Fallback to direct lookup
    return sessionStatuses.get(sessionId);
  }, [terminals, sessionStatuses, getNormalizedId]);
  
  /**
   * Clear all error states
   */
  const clearErrorStates = useCallback(() => {
    sessionStatuses.forEach((status, sessionId) => {
      if (status === 'error') {
        dispatch({
          type: 'UPDATE_SESSION_STATUS',
          dbSessionId: sessionId,
          status: 'disconnected'
        });
      }
    });
  }, [sessionStatuses, dispatch]);
  
  return {
    handleSessionStatus,
    hasDisconnectedSessions,
    getSessionStatus,
    clearErrorStates
  };
}