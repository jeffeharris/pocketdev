/**
 * Terminal Tabs Feature Module
 * 
 * Complete, self-contained terminal tab management including:
 * - Tab lifecycle (create, close, rename, reorder)
 * - Session refresh and reconnection logic
 * - Focus management
 * - Terminal state coordination
 * 
 * This is a "feature module" following AI-assisted architecture principles:
 * One concept, one file, complete implementation.
 * 
 * Now includes terminal refresh logic that was previously in terminal-refresh.service.ts
 * to create a truly complete, self-contained feature module.
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTerminalStore } from '../stores/terminal/terminalStore.deep';
import { TerminalService } from '../services/terminal.service';
import { getFirstByOrder, findTerminalById } from '../utils/terminal-utils';
import type { Task, TerminalSession } from '@shared/types';
import type { Tab } from '../components/terminal/TerminalTabs';
import type { DirectTerminalHandle } from '../components/terminal/DirectTerminal';

// ============================================================================
// Types and Interfaces
// ============================================================================

// Session options for creating new tabs
export interface SessionOptions {
  tabName?: string;
  aiAgent?: 'claude' | 'aider' | 'codex' | 'gemini' | 'none';
  workingDirectory?: string;
  initialPrompt?: string;
}

// UI callbacks for operations
export interface TerminalTabCallbacks {
  showNotification: (level: 'success' | 'warning' | 'error', message: string) => void;
  dispatch: (action: { type: string; dbSessionId?: string; status?: 'connected' | 'disconnected' | 'error' }) => void;
  reloadTask: () => Promise<void>;
}

// Domain events that describe what happened during refresh (from terminal-refresh.service)
type RefreshEvent = 
  | { type: 'session-disconnected'; terminalId: string; sessionName: string }
  | { type: 'session-reconnected'; terminalId: string }
  | { type: 'reconnection-failed'; terminalId: string; reason: string }
  | { type: 'task-reload-required'; reason: string }
  | { type: 'refresh-completed'; terminalId: string }
  | { type: 'refresh-failed'; terminalId: string; error: string };

interface RefreshOptions {
  taskId: string;
  activeTerminalId: string;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
}

interface RefreshResult {
  success: boolean;
  message: string;
  events: RefreshEvent[];
}

// Configuration for the feature
export interface TerminalTabConfig {
  task: Task;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  terminalService: TerminalService;
  sessionStatuses: Map<string, 'connected' | 'disconnected' | 'error'>;
  terminalRefs: React.RefObject<Map<string, DirectTerminalHandle>>;
  realtimeSessionStates?: Array<{ id: string; aiState: string }>;
  callbacks: TerminalTabCallbacks;
  onTabsChange?: () => void;
}

// ============================================================================
// Terminal Refresh Logic (merged from terminal-refresh.service.ts)
// ============================================================================

/**
 * Assess the state of a terminal session
 * Internal helper function
 */
function assessSessionState(
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

/**
 * Analyze session state and determine what refresh events occurred
 * Returns domain events, not UI instructions
 */
async function refreshSession(options: RefreshOptions): Promise<RefreshResult> {
  const { activeTerminalId, terminals, sessionStatuses } = options;
  const events: RefreshEvent[] = [];
  
  // Phase 1: Assess current state
  const assessment = assessSessionState(activeTerminalId, terminals, sessionStatuses);
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
function getReconnectEvents(
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

// ============================================================================
// Main Feature Interface
// ============================================================================

// Complete feature interface - combines tab management with refresh/reconnect
export interface TerminalTabsFeature {
  // State
  state: {
    tabs: Tab[];
    activeTabId: string;
    confirmClose: { dbSessionId: string; tabName: string } | null;
  };
  
  // Tab operations
  selectTab: (tabId: string) => void;
  addTab: (options?: SessionOptions) => Promise<void>;
  closeTab: (dbSessionId: string, options?: { force?: boolean; skipConfirm?: boolean }) => Promise<void>;
  updateTab: (dbSessionId: string, updates: { name?: string; order?: number }) => Promise<void>;
  reorderTabs: (tabs: Tab[]) => Promise<void>;
  cancelCloseConfirmation: () => void;
  
  // Refresh operations (from orchestrator)
  refreshActiveTab: () => Promise<void>;
  reconnectTab: (dbSessionId: string) => Promise<void>;
  
  // Focus operations
  focusActiveTab: () => void;
  switchToTab: (dbSessionId: string) => Promise<void>;
}

/**
 * Complete terminal tabs feature implementation
 * All tab-related logic in one place for AI comprehension
 */
export function useTerminalTabs(config: TerminalTabConfig): TerminalTabsFeature {
  const {
    task,
    terminals,
    terminalService,
    sessionStatuses,
    terminalRefs,
    realtimeSessionStates,
    callbacks,
    onTabsChange
  } = config;
  
  const navigate = useNavigate();
  const terminalStore = useTerminalStore();
  
  // Local state
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [confirmClose, setConfirmClose] = useState<{ dbSessionId: string; tabName: string } | null>(null);
  
  // Convert terminals to tabs format with real-time state
  const tabs: Tab[] = terminals.map(t => {
    const normalizedId = t.normalizedId;
    const connectionStatus = sessionStatuses.get(normalizedId) || 'connected';
    
    // Get real-time AI state if available
    const realtimeState = realtimeSessionStates?.find(s => s.id === t.dbSessionId);
    const aiState = realtimeState ? realtimeState.aiState as Tab['aiState'] : t.aiState;
    
    return {
      sessionId: t.sessionId,
      dbSessionId: t.dbSessionId,
      normalizedId,
      tabName: t.tabName,
      tabOrder: t.tabOrder,
      aiState,
      aiAgent: t.aiAgent || 'claude',
      connectionStatus
    };
  });
  
  // ========== Tab Management ==========
  
  const handleTabSelect = useCallback((tabId: string) => {
    const terminal = findTerminalById(terminals, tabId, 'normalizedId');
    if (!terminal) return;
    
    setActiveTabId(tabId);
    
    // Update store
    terminalStore.setActiveTerminal(task.id, tabId);
    
    // Update task state
    if (task.onChange) {
      task.onChange({
        ...task,
        terminals: terminals.map(t => ({
          ...t,
          is_active: t.normalizedId === tabId
        }))
      });
    }
  }, [terminals, task, terminalStore]);
  
  const handleTabAdd = useCallback(async (options?: SessionOptions) => {
    try {
      const tabName = options?.tabName || `Tab ${terminals.length + 1}`;
      const aiAgent = options?.aiAgent || 'claude';
      
      const newSession = await terminalService.createTerminalSession(
        task.id,
        {
          tabName,
          aiAgent,
          workingDirectory: options?.workingDirectory,
          initialPrompt: options?.initialPrompt
        }
      );
      
      if (newSession && newSession.dbSessionId) {
        // Add to store
        terminalStore.updateTerminal(task.id, newSession.dbSessionId, {
          type: 'create',
          config: {
            sessionId: newSession.sessionId,
            dbSessionId: newSession.dbSessionId,
            tabName: newSession.tabName,
            tabOrder: newSession.tabOrder,
            aiState: 'not-started',
            autoFocus: true
          }
        });
        
        // Select new tab
        handleTabSelect(newSession.dbSessionId);
        
        // Trigger refresh
        if (onTabsChange) onTabsChange();
      }
    } catch (error) {
      console.error('[TerminalTabs] Failed to add tab:', error);
      callbacks.showNotification('error', 'Failed to create new terminal tab');
    }
  }, [terminals, task, terminalService, terminalStore, handleTabSelect, onTabsChange, callbacks]);
  
  const performTabClose = useCallback(async (dbSessionId: string) => {
    try {
      const terminalToClose = findTerminalById(terminals, dbSessionId, 'dbSessionId');
      if (!terminalToClose) return;
      
      // Delete from backend
      await terminalService.deleteTerminalSession(terminalToClose.normalizedId);
      
      // Remove from store
      terminalStore.updateTerminal(task.id, dbSessionId, { type: 'delete' });
      
      // If closing active tab, switch to another
      if (activeTabId === dbSessionId || activeTabId === terminalToClose.normalizedId) {
        const remainingTabs = tabs.filter(t => t.dbSessionId !== dbSessionId);
        if (remainingTabs.length > 0) {
          const nextTab = getFirstByOrder(remainingTabs);
          if (nextTab) {
            handleTabSelect(nextTab.normalizedId);
          }
        } else {
          // No tabs left, navigate to project
          navigate(`/projects/${task.project_id}`);
        }
      }
      
      // Clear confirmation
      setConfirmClose(null);
      
      // Trigger refresh
      if (onTabsChange) onTabsChange();
    } catch (error) {
      console.error('[TerminalTabs] Failed to close tab:', error);
      callbacks.showNotification('error', 'Failed to close terminal tab');
    }
  }, [terminals, tabs, activeTabId, task, terminalService, terminalStore, navigate, handleTabSelect, onTabsChange, callbacks]);
  
  const handleTabClose = useCallback(async (dbSessionId: string) => {
    const terminalToClose = findTerminalById(terminals, dbSessionId, 'dbSessionId');
    if (!terminalToClose) return;
    
    // Check if AI is active
    if (terminalToClose.aiState === 'working' || terminalToClose.aiState === 'waiting') {
      setConfirmClose({ dbSessionId, tabName: terminalToClose.tabName });
    } else {
      await performTabClose(dbSessionId);
    }
  }, [terminals, performTabClose]);
  
  const handleTabRename = useCallback(async (dbSessionId: string, newName: string) => {
    try {
      const terminal = findTerminalById(terminals, dbSessionId, 'dbSessionId');
      if (!terminal) return;
      
      // Update backend
      await terminalService.updateTerminalTab(terminal.normalizedId, { tabName: newName });
      
      // Update store
      terminalStore.updateTerminal(task.id, dbSessionId, {
        type: 'rename',
        name: newName
      });
      
      // Trigger refresh
      if (onTabsChange) onTabsChange();
    } catch (error) {
      console.error('[TerminalTabs] Failed to rename tab:', error);
      callbacks.showNotification('error', 'Failed to rename terminal tab');
    }
  }, [terminals, task, terminalService, terminalStore, onTabsChange, callbacks]);
  
  const handleTabReorder = useCallback(async (reorderedTabs: Tab[]) => {
    try {
      // Update each tab's order
      for (let i = 0; i < reorderedTabs.length; i++) {
        const tab = reorderedTabs[i];
        const terminal = findTerminalById(terminals, tab.dbSessionId, 'dbSessionId');
        if (terminal) {
          await terminalService.updateTerminalTab(terminal.normalizedId, { tabOrder: i });
        }
      }
      
      // Update store
      reorderedTabs.forEach((tab, index) => {
        terminalStore.updateTerminal(task.id, tab.dbSessionId, {
          type: 'reorder',
          order: index
        });
      });
      
      // Trigger refresh
      if (onTabsChange) onTabsChange();
    } catch (error) {
      console.error('[TerminalTabs] Failed to reorder tabs:', error);
      callbacks.showNotification('error', 'Failed to reorder terminal tabs');
    }
  }, [terminals, task, terminalService, terminalStore, onTabsChange, callbacks]);
  
  // ========== Refresh Operations (from orchestrator) ==========
  
  const refreshActiveTab = useCallback(async () => {
    callbacks.dispatch({ type: 'START_RESET' });
    
    try {
      const result = await refreshSession({
        taskId: task.id,
        activeTerminalId: activeTabId,
        terminals,
        sessionStatuses
      });
      
      // Process domain events
      for (const event of result.events) {
        switch (event.type) {
          case 'session-disconnected':
            callbacks.showNotification('warning', `Session "${event.sessionName}" disconnected - reconnecting...`);
            break;
          case 'task-reload-required':
            await callbacks.reloadTask();
            break;
          case 'refresh-completed': {
            const terminalRef = terminalRefs.current?.get(event.terminalId);
            if (terminalRef?.refresh) {
              terminalRef.refresh();
            }
            if (terminalRef?.fit) {
              terminalRef.fit();
            }
            break;
          }
          case 'refresh-failed':
            callbacks.showNotification('error', `Failed to refresh: ${event.error}`);
            break;
        }
      }
      
      // Focus terminal after refresh
      if (activeTabId) {
        const terminalRef = terminalRefs.current?.get(activeTabId);
        if (terminalRef?.focus) {
          setTimeout(() => terminalRef.focus(), 100);
        }
      }
      
      if (!result.success) {
        callbacks.showNotification('error', result.message || 'Failed to refresh terminal session');
      }
    } catch (error) {
      console.error('[TerminalTabs] Refresh failed:', error);
      callbacks.showNotification('error', 'Failed to refresh terminal session');
    } finally {
      setTimeout(() => callbacks.dispatch({ type: 'FINISH_RESET' }), 1000);
    }
  }, [task, activeTabId, terminals, sessionStatuses, terminalRefs, callbacks]);
  
  const reconnectTab = useCallback(async (dbSessionId: string) => {
    const events = getReconnectEvents(
      dbSessionId,
      terminals,
      sessionStatuses
    );
    
    // Process domain events
    for (const event of events) {
      switch (event.type) {
        case 'session-disconnected':
          callbacks.showNotification('warning', `Session "${event.sessionName}" disconnected`);
          break;
        case 'task-reload-required':
          await callbacks.reloadTask();
          break;
        case 'refresh-completed': {
          const terminalRef = terminalRefs.current?.get(event.terminalId);
          if (terminalRef?.refresh) {
            terminalRef.refresh();
          }
          break;
        }
        case 'reconnection-failed':
          callbacks.showNotification('error', event.reason);
          break;
      }
    }
    
    // Focus terminal after reconnection
    const terminal = findTerminalById(terminals, dbSessionId, 'dbSessionId');
    if (terminal) {
      const terminalRef = terminalRefs.current?.get(terminal.normalizedId);
      if (terminalRef?.focus) {
        setTimeout(() => terminalRef.focus(), 100);
      }
    }
    
    if (events.length === 0 || events.some(e => e.type === 'reconnection-failed')) {
      const terminal = findTerminalById(terminals, dbSessionId, 'dbSessionId');
      callbacks.showNotification('error', `Failed to reconnect terminal "${terminal?.tabName || 'unknown'}"`);
    }
  }, [terminals, sessionStatuses, terminalRefs, callbacks]);
  
  // ========== Focus Operations ==========
  
  const focusActiveTab = useCallback(() => {
    if (!activeTabId) return;
    
    // Update store focus state
    terminalStore.updateTerminal(task.id, activeTabId, {
      type: 'set-focus',
      focus: true
    });
    
    // Focus the actual terminal element
    const terminalRef = terminalRefs.current?.get(activeTabId);
    if (terminalRef?.focus) {
      setTimeout(() => terminalRef.focus(), 100);
    }
  }, [activeTabId, task, terminalStore, terminalRefs]);
  
  const switchToTab = useCallback(async (dbSessionId: string) => {
    const terminal = findTerminalById(terminals, dbSessionId, 'dbSessionId');
    if (!terminal) {
      callbacks.showNotification('error', `Tab not found: ${dbSessionId}`);
      return;
    }
    
    // Select the tab
    handleTabSelect(terminal.normalizedId);
    
    // Focus it
    focusActiveTab();
  }, [terminals, handleTabSelect, focusActiveTab, callbacks]);
  
  // ========== Effects ==========
  
  // Initialize active tab
  useEffect(() => {
    if (tabs.length > 0 && !activeTabId) {
      const firstTerminal = getFirstByOrder(terminals);
      if (firstTerminal) {
        handleTabSelect(firstTerminal.normalizedId);
      }
    }
  }, [tabs.length, activeTabId, terminals, handleTabSelect]);
  
  // Return complete feature interface
  return {
    state: {
      tabs,
      activeTabId,
      confirmClose
    },
    
    // Tab operations
    selectTab: handleTabSelect,
    addTab: handleTabAdd,
    closeTab: async (dbSessionId: string, options?: { force?: boolean; skipConfirm?: boolean }) => {
      if (options?.force || options?.skipConfirm) {
        await performTabClose(dbSessionId);
      } else {
        await handleTabClose(dbSessionId);
      }
      // Auto-cancel confirmation if force closing
      if (options?.force && confirmClose?.dbSessionId === dbSessionId) {
        setConfirmClose(null);
      }
    },
    updateTab: async (dbSessionId: string, updates: { name?: string; order?: number }) => {
      if (updates.name !== undefined) {
        await handleTabRename(dbSessionId, updates.name);
      }
      // Order updates would be handled here if needed
    },
    reorderTabs: handleTabReorder,
    cancelCloseConfirmation: () => setConfirmClose(null),
    
    // Refresh operations
    refreshActiveTab,
    reconnectTab,
    
    // Focus operations
    focusActiveTab,
    switchToTab
  };
}