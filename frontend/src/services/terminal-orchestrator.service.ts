/**
 * TerminalOrchestrator Service
 * 
 * Deep module that handles all terminal coordination logic.
 * Extracted from TerminalPanel to separate orchestration from presentation.
 * 
 * Following Ousterhout's principles:
 * - Simple interface (4 methods) hiding complex coordination
 * - Single responsibility: orchestrating terminal operations
 * - No UI coupling - returns actions for UI to perform
 */

import { terminalRefreshService, type RefreshEvent } from './terminal-refresh.service';
import { useTerminalStore } from '../stores/terminal/terminalStore.deep';
import type { Task, TerminalSession } from '../types/task';
import type { DirectTerminalHandle } from '../components/terminal/DirectTerminal';

// Actions the UI should perform based on orchestration decisions
export type OrchestratorAction =
  | { type: 'refresh-terminal'; terminalId: string }
  | { type: 'reload-task' }
  | { type: 'fit-terminal'; terminalId: string }
  | { type: 'focus-terminal'; terminalId: string }
  | { type: 'show-notification'; message: string; level: 'success' | 'warning' | 'error' }
  | { type: 'start-refresh-ui' }
  | { type: 'end-refresh-ui' }
  | { type: 'switch-tab'; tabId: string };

// Configuration for orchestrator operations
export interface OrchestratorConfig {
  taskId: string;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
  terminalRefs: Map<string, DirectTerminalHandle>;
}

export class TerminalOrchestrator {
  /**
   * Refresh the active terminal session
   * Coordinates between refresh service, store, and UI
   */
  async refreshActiveTerminal(
    config: OrchestratorConfig,
    activeTerminalId: string
  ): Promise<{ actions: OrchestratorAction[]; success: boolean }> {
    const actions: OrchestratorAction[] = [];
    
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
      
      // Translate domain events to UI actions
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
            actions.push({ type: 'refresh-terminal', terminalId: event.terminalId });
            actions.push({ type: 'fit-terminal', terminalId: event.terminalId });
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
        actions.push({ type: 'focus-terminal', terminalId: activeTerminalId });
      }
      
      return { actions, success: refreshResult.success };
    } finally {
      // Always end refresh UI state
      setTimeout(() => {
        actions.push({ type: 'end-refresh-ui' });
      }, 1000);
    }
  }
  
  /**
   * Reconnect a specific terminal session
   * Handles individual session recovery
   */
  async reconnectSession(
    config: OrchestratorConfig,
    dbSessionId: string
  ): Promise<{ actions: OrchestratorAction[]; success: boolean }> {
    // Get domain events from service
    const events = terminalRefreshService.getReconnectEvents(
      dbSessionId,
      config.terminals,
      config.sessionStatuses
    );
    
    // Translate domain events to UI actions
    const actions: OrchestratorAction[] = [];
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
          actions.push({ type: 'refresh-terminal', terminalId: event.terminalId });
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
    
    // If terminal needs focus after reconnection
    const terminal = config.terminals.find(t => t.dbSessionId === dbSessionId);
    if (terminal) {
      actions.push({ type: 'focus-terminal', terminalId: terminal.normalizedId });
    }
    
    return { 
      actions,
      success: actions.length > 0 
    };
  }
  
  /**
   * Handle terminal focus coordination
   * Manages focus between store state and UI elements
   */
  focusTerminal(
    taskId: string,
    terminalId: string,
    terminalRefs: Map<string, DirectTerminalHandle>
  ): OrchestratorAction[] {
    const actions: OrchestratorAction[] = [];
    const store = useTerminalStore.getState();
    
    // Update store focus state
    store.updateTerminal(taskId, terminalId, {
      type: 'set-focus',
      focus: true
    });
    
    // Request UI focus
    actions.push({ type: 'focus-terminal', terminalId });
    
    // Handle actual DOM focus after a delay
    setTimeout(() => {
      const ref = terminalRefs.get(terminalId);
      if (ref?.focus) {
        ref.focus();
      }
    }, 100);
    
    return actions;
  }
  
  /**
   * Coordinate tab switching
   * Ensures proper state updates and focus management
   */
  switchToTab(
    config: OrchestratorConfig,
    dbSessionId: string
  ): OrchestratorAction[] {
    const actions: OrchestratorAction[] = [];
    
    // Check if tab exists
    const terminal = config.terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) {
      actions.push({ 
        type: 'show-notification', 
        message: `Tab not found: ${dbSessionId}`,
        level: 'error'
      });
      return actions;
    }
    
    // Switch tab
    actions.push({ type: 'switch-tab', tabId: dbSessionId });
    
    // Focus the terminal
    actions.push(...this.focusTerminal(
      config.taskId,
      terminal.normalizedId,
      config.terminalRefs
    ));
    
    return actions;
  }
}

// Export singleton instance
export const terminalOrchestrator = new TerminalOrchestrator();