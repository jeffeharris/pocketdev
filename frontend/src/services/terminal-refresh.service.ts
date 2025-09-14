/**
 * TerminalRefreshService - Domain service for terminal refresh operations
 * 
 * This deep module encapsulates the complex refresh logic that was previously
 * mixed into TerminalPanel. It handles:
 * - WebSocket reconnection
 * - Terminal buffer restoration  
 * - UI synchronization
 * - Task data reloading
 * - Error recovery
 * 
 * Following Ousterhout's principles, this service provides a simple interface
 * hiding significant complexity.
 */

import type { Task, TerminalSession } from '../types/task';
import type { DirectTerminalHandle } from '../components/terminal/DirectTerminal';

export interface RefreshOptions {
  taskId: string;
  activeTerminalId: string;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  terminalRefs: Map<string, DirectTerminalHandle>;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
  task: Task;
}

export interface RefreshResult {
  success: boolean;
  message: string;
  wasDisconnected: boolean;
  terminalRefreshed: boolean;
  taskReloaded: boolean;
}

export class TerminalRefreshService {
  /**
   * Refresh the active terminal session
   * Handles all the complex orchestration of reconnection, restoration, and synchronization
   */
  async refreshSession(options: RefreshOptions): Promise<RefreshResult> {
    const { activeTerminalId, terminals, terminalRefs, sessionStatuses, task } = options;
    
    // Phase 1: Assess current state
    const assessment = this.assessSessionState(activeTerminalId, terminals, sessionStatuses);
    if (!assessment.terminal) {
      return {
        success: false,
        message: 'No active terminal to refresh',
        wasDisconnected: false,
        terminalRefreshed: false,
        taskReloaded: false
      };
    }
    
    // Phase 2: Attempt terminal refresh
    const terminalRef = terminalRefs.get(assessment.terminal.dbSessionId);
    let terminalRefreshed = false;
    
    if (terminalRef?.refresh) {
      try {
        // Refresh terminal (reconnects WebSocket, restores buffer, fits to container)
        terminalRef.refresh();
        terminalRefreshed = true;
        
        // Ensure proper sizing after refresh
        await this.ensureTerminalFit(terminalRef);
      } catch (error) {
        console.error('[TerminalRefreshService] Terminal refresh failed:', error);
      }
    }
    
    // Phase 3: Reload task data if needed
    let taskReloaded = false;
    if (assessment.isDisconnected || !terminalRefreshed) {
      if (task.onReload) {
        try {
          await task.onReload();
          taskReloaded = true;
        } catch (error) {
          console.error('[TerminalRefreshService] Task reload failed:', error);
        }
      }
    }
    
    // Phase 4: Final synchronization
    await this.synchronizeTerminalSize(terminalRefs, activeTerminalId);
    
    // Determine result message
    const message = this.determineResultMessage(
      assessment.isDisconnected,
      terminalRefreshed,
      taskReloaded
    );
    
    return {
      success: terminalRefreshed || taskReloaded,
      message,
      wasDisconnected: assessment.isDisconnected,
      terminalRefreshed,
      taskReloaded
    };
  }
  
  /**
   * Reconnect a disconnected session
   */
  async reconnectSession(
    dbSessionId: string,
    terminals: Array<TerminalSession & { normalizedId: string }>,
    terminalRefs: Map<string, DirectTerminalHandle>,
    task: Task
  ): Promise<boolean> {
    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) return false;
    
    const terminalRef = terminalRefs.get(dbSessionId);
    if (!terminalRef) {
      // No ref available, try task reload
      if (task.onReload) {
        await task.onReload();
        return true;
      }
      return false;
    }
    
    // Attempt to refresh the specific terminal
    if (terminalRef.refresh) {
      try {
        terminalRef.refresh();
        await this.ensureTerminalFit(terminalRef);
        return true;
      } catch (error) {
        console.error(`[TerminalRefreshService] Failed to reconnect session ${dbSessionId}:`, error);
        return false;
      }
    }
    
    return false;
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
  
  private async ensureTerminalFit(terminalRef: DirectTerminalHandle): Promise<void> {
    // Fit immediately
    if (terminalRef.fit) {
      terminalRef.fit();
    }
    
    // Fit again after DOM settles
    await new Promise(resolve => setTimeout(resolve, 200));
    if (terminalRef.fit) {
      terminalRef.fit();
    }
  }
  
  private async synchronizeTerminalSize(
    terminalRefs: Map<string, DirectTerminalHandle>,
    activeTerminalId: string
  ): Promise<void> {
    const terminalRef = terminalRefs.get(activeTerminalId);
    if (terminalRef?.fit) {
      terminalRef.fit();
    }
  }
  
  private determineResultMessage(
    wasDisconnected: boolean,
    terminalRefreshed: boolean,
    taskReloaded: boolean
  ): string {
    if (wasDisconnected && terminalRefreshed) {
      return 'Reconnecting terminal session...';
    }
    if (terminalRefreshed) {
      return 'Terminal refreshed';
    }
    if (taskReloaded) {
      return 'Reloading terminal session...';
    }
    return 'Refresh attempted';
  }
}

// Export singleton instance
export const terminalRefreshService = new TerminalRefreshService();