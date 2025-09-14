/**
 * TerminalOrchestrator Service
 * 
 * Deep module that handles all terminal coordination logic.
 * Processes all actions internally instead of returning them for UI to handle.
 * 
 * Following Ousterhout's principles:
 * - Simple interface (4 methods) hiding complex coordination
 * - Single responsibility: orchestrating terminal operations
 * - Processes actions internally - no leaking to UI layer
 */

import { terminalRefreshService, type RefreshEvent } from './terminal-refresh.service';
import { useTerminalStore } from '../stores/terminal/terminalStore.deep';
import type { Task, TerminalSession } from '../types/task';
import type { DirectTerminalHandle } from '../components/terminal/DirectTerminal';

// UI callbacks the orchestrator needs to perform its work
export interface OrchestratorCallbacks {
  showNotification: (level: 'success' | 'warning' | 'error', message: string) => void;
  dispatch: (action: any) => void;
  reloadTask: () => Promise<void>;
  selectTab: (tabId: string) => void;
}

// Configuration for orchestrator operations
export interface OrchestratorConfig {
  taskId: string;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
  terminalRefs: Map<string, DirectTerminalHandle>;
}

export class TerminalOrchestrator {
  private callbacks: OrchestratorCallbacks | null = null;
  
  /**
   * Initialize the orchestrator with UI callbacks
   * This allows the orchestrator to process actions internally
   */
  initialize(callbacks: OrchestratorCallbacks): void {
    this.callbacks = callbacks;
  }
  
  /**
   * Process actions internally instead of returning them
   */
  private async processActions(actions: Array<{ type: string; [key: string]: any }>): Promise<void> {
    if (!this.callbacks) {
      console.error('[TerminalOrchestrator] Not initialized with callbacks');
      return;
    }
    
    for (const action of actions) {
      switch (action.type) {
        case 'refresh-terminal': {
          const ref = action.terminalRef;
          if (ref?.refresh) {
            ref.refresh();
          }
          break;
        }
        case 'reload-task': {
          await this.callbacks.reloadTask();
          break;
        }
        case 'fit-terminal': {
          const ref = action.terminalRef;
          if (ref?.fit) {
            ref.fit();
          }
          break;
        }
        case 'focus-terminal': {
          const ref = action.terminalRef;
          if (ref?.focus) {
            ref.focus();
          }
          break;
        }
        case 'show-notification': {
          this.callbacks.showNotification(action.level, action.message);
          break;
        }
        case 'start-refresh-ui': {
          this.callbacks.dispatch({ type: 'START_RESET' });
          break;
        }
        case 'end-refresh-ui': {
          this.callbacks.dispatch({ type: 'FINISH_RESET' });
          break;
        }
        case 'switch-tab': {
          this.callbacks.selectTab(action.tabId);
          break;
        }
      }
    }
  }
  
  /**
   * Refresh the active terminal session
   * Processes all coordination internally
   */
  async refreshActiveTerminal(
    config: OrchestratorConfig,
    activeTerminalId: string
  ): Promise<{ success: boolean; message?: string }> {
    if (!this.callbacks) {
      return { success: false, message: 'Orchestrator not initialized' };
    }
    
    const actions: any[] = [];
    
    // Start UI refresh state
    actions.push({ type: 'start-refresh-ui' });
    
    try {
      // Get domain events from service
      const refreshResult = await terminalRefreshService.refreshSession({
        taskId: config.taskId,
        activeTerminalId,
        terminals: config.terminals,
        sessionStatuses: config.sessionStatuses
      });
      
      // Translate domain events to internal actions
      for (const event of refreshResult.events) {
        switch (event.type) {
          case 'session-disconnected':
            actions.push({
              type: 'show-notification',
              message: `Session "${event.sessionName}" disconnected - reconnecting...`,
              level: 'warning'
            });
            break;
          case 'task-reload-required':
            actions.push({ type: 'reload-task' });
            break;
          case 'refresh-completed':
            const terminalRef = config.terminalRefs.get(event.terminalId);
            actions.push({ type: 'refresh-terminal', terminalRef });
            actions.push({ type: 'fit-terminal', terminalRef });
            break;
          case 'refresh-failed':
            actions.push({
              type: 'show-notification',
              message: `Failed to refresh: ${event.error}`,
              level: 'error'
            });
            break;
        }
      }
      
      // Focus terminal after refresh
      if (activeTerminalId) {
        const terminalRef = config.terminalRefs.get(activeTerminalId);
        actions.push({ type: 'focus-terminal', terminalRef });
      }
      
      // Process all actions internally
      await this.processActions(actions);
      
      // Schedule UI refresh end
      setTimeout(() => {
        this.processActions([{ type: 'end-refresh-ui' }]);
      }, 1000);
      
      return { success: refreshResult.success };
    } catch (error) {
      console.error('[TerminalOrchestrator] Refresh failed:', error);
      await this.processActions([{ type: 'end-refresh-ui' }]);
      return { success: false, message: 'Refresh failed' };
    }
  }
  
  /**
   * Reconnect a specific terminal session
   * Handles all coordination internally
   */
  async reconnectSession(
    config: OrchestratorConfig,
    dbSessionId: string
  ): Promise<{ success: boolean }> {
    if (!this.callbacks) {
      return { success: false };
    }
    
    // Get domain events from service
    const events = terminalRefreshService.getReconnectEvents(
      dbSessionId,
      config.terminals,
      config.sessionStatuses
    );
    
    // Translate domain events to internal actions
    const actions: any[] = [];
    for (const event of events) {
      switch (event.type) {
        case 'session-disconnected':
          actions.push({
            type: 'show-notification',
            message: `Session "${event.sessionName}" disconnected`,
            level: 'warning'
          });
          break;
        case 'task-reload-required':
          actions.push({ type: 'reload-task' });
          break;
        case 'refresh-completed':
          const terminalRef = config.terminalRefs.get(event.terminalId);
          actions.push({ type: 'refresh-terminal', terminalRef });
          break;
        case 'reconnection-failed':
          actions.push({
            type: 'show-notification',
            message: event.reason,
            level: 'error'
          });
          break;
      }
    }
    
    // Focus terminal after reconnection
    const terminal = config.terminals.find(t => t.dbSessionId === dbSessionId);
    if (terminal) {
      const terminalRef = config.terminalRefs.get(terminal.normalizedId);
      actions.push({ type: 'focus-terminal', terminalRef });
    }
    
    // Process all actions internally
    await this.processActions(actions);
    
    return { success: events.length > 0 && !events.some(e => e.type === 'reconnection-failed') };
  }
  
  /**
   * Handle terminal focus coordination
   * Manages focus internally
   */
  focusTerminal(
    taskId: string,
    terminalId: string,
    terminalRefs: Map<string, DirectTerminalHandle>
  ): void {
    const store = useTerminalStore.getState();
    
    // Update store focus state
    store.updateTerminal(taskId, terminalId, {
      type: 'set-focus',
      focus: true
    });
    
    // Focus the terminal after a delay
    const terminalRef = terminalRefs.get(terminalId);
    if (terminalRef) {
      setTimeout(() => {
        this.processActions([{ type: 'focus-terminal', terminalRef }]);
      }, 100);
    }
  }
  
  /**
   * Coordinate tab switching
   * Handles all coordination internally
   */
  async switchToTab(
    config: OrchestratorConfig,
    dbSessionId: string
  ): Promise<void> {
    if (!this.callbacks) {
      return;
    }
    
    // Check if tab exists
    const terminal = config.terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) {
      await this.processActions([{ 
        type: 'show-notification', 
        message: `Tab not found: ${dbSessionId}`,
        level: 'error'
      }]);
      return;
    }
    
    // Switch tab
    await this.processActions([{ type: 'switch-tab', tabId: dbSessionId }]);
    
    // Focus the terminal
    this.focusTerminal(
      config.taskId,
      terminal.normalizedId,
      config.terminalRefs
    );
  }
}

// Export singleton instance
export const terminalOrchestrator = new TerminalOrchestrator();