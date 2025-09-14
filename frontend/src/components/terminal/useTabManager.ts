/**
 * useTabManager - Manages terminal tab lifecycle
 * 
 * A deep module that handles all tab operations:
 * - Creating, closing, renaming, reordering tabs
 * - Active tab selection and persistence
 * - Tab close confirmation for modified sessions
 * 
 * This extracts ~200 lines of tab management from TerminalPanel
 */

import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTerminalStore } from '../../stores/terminal/terminalStore.deep';
import { TerminalService } from '../../services/terminal.service';
import type { Task } from '../../types/task';
import type { TerminalSession } from '../../types/task';
import type { Tab } from './TerminalTabs';

// Tab modification actions - consolidates all operations
export type TabAction = 
  | { type: 'add'; options?: SessionOptions }
  | { type: 'close'; dbSessionId: string }
  | { type: 'forceClose'; dbSessionId: string }  // Bypass confirmation
  | { type: 'rename'; dbSessionId: string; newName: string }
  | { type: 'reorder'; tabs: Tab[] }
  | { type: 'select'; tabId: string };

interface SessionOptions {
  tabName?: string;
  aiAgent?: 'claude' | 'aider' | 'codex' | 'gemini' | 'none';
  workingDirectory?: string;
  initialPrompt?: string;
}

interface UseTabManagerProps {
  task: Task;
  terminals: Array<TerminalSession & { normalizedId: string }>;
  terminalService: TerminalService;
  sessionStatuses?: Map<string, 'connected' | 'disconnected' | 'error'>;
  realtimeSessionStates?: Array<{ id: string; aiState: string }>;
  onTabsChange?: () => void;
}

// Simplified interface - only 5 public members
interface UseTabManagerResult {
  tabs: Tab[];
  activeTabId: string;
  confirmClose: { dbSessionId: string; tabName: string } | null;
  modifyTab: (action: TabAction) => Promise<void>;
  cancelCloseConfirmation: () => void;
}

export function useTabManager({
  task,
  terminals,
  terminalService,
  sessionStatuses = new Map(),
  realtimeSessionStates,
  onTabsChange
}: UseTabManagerProps): UseTabManagerResult {
  const navigate = useNavigate();
  const terminalStore = useTerminalStore();
  
  // Active tab state
  const [activeTabId, setActiveTabId] = useState(() => {
    const savedTabId = localStorage.getItem('focusTabId') || 
                      localStorage.getItem(`activeTab-${task.id}`) || '';
    if (localStorage.getItem('focusTabId')) {
      localStorage.removeItem('focusTabId');
    }
    return savedTabId;
  });
  
  // Close confirmation state
  const [confirmClose, setConfirmClose] = useState<{ dbSessionId: string; tabName: string } | null>(null);
  
  // Convert terminals to tabs with real-time state
  const tabs: Tab[] = terminals.map(t => {
    const normalizedId = t.normalizedId;
    const connectionStatus = sessionStatuses.get(normalizedId) || 'connected';
    
    // Use real-time AI state if available, otherwise fall back to initial state
    const realtimeState = realtimeSessionStates?.find(s => s.id === t.dbSessionId);
    const currentAiState = realtimeState?.aiState || t.aiState;
    
    return {
      sessionId: t.sessionId,
      dbSessionId: t.dbSessionId,
      normalizedId: normalizedId,
      tabName: t.tabName,
      tabOrder: t.tabOrder,
      aiState: currentAiState || 'not-started',
      aiAgent: t.aiAgent || 'claude',
      connectionStatus: connectionStatus
    };
  });
  
  // Save active tab when it changes
  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    terminalStore.setActiveTerminal(task.id, tabId);
    localStorage.setItem(`activeTab-${task.id}`, tabId);
    
    // Find terminal and update state
    const terminal = terminals.find(t => t.normalizedId === tabId);
    if (terminal) {
      terminalStore.updateTerminal(task.id, terminal.dbSessionId, {
        type: 'update',
        updates: {
          lastActivity: new Date().toISOString()
        }
      });
    }
  }, [task.id, terminals, terminalStore]);
  
  // Create new tab
  const handleTabAdd = useCallback(async (options?: SessionOptions) => {
    try {
      const tabCount = terminals.length;
      if (tabCount >= 6) {
        console.warn('Maximum of 6 tabs reached');
        return;
      }
      
      const newSession = await terminalService.createTerminalSession(task.id, {
        tabName: options?.tabName || `Tab ${tabCount + 1}`,
        aiAgent: options?.aiAgent || 'claude',
        workingDirectory: options?.workingDirectory
      });
      
      console.log('[useTabManager] New session created:', newSession);
      
      // Add to store using the correct action pattern
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
      
      // Switch to new tab
      if (newSession.normalizedId) {
        handleTabSelect(newSession.normalizedId);
        
        // Launch AI agent if specified
        if (options?.aiAgent && options.aiAgent !== 'none') {
          setTimeout(async () => {
            try {
              await terminalService.launchAgent(
                newSession.normalizedId!,
                options.aiAgent,
                {
                  workingDirectory: options.workingDirectory,
                  initialPrompt: options.initialPrompt,
                  worktreePath: task.worktreePath
                }
              );
            } catch (error) {
              console.error('Failed to launch agent:', error);
            }
          }, 500);
        }
      }
      
      onTabsChange?.();
    } catch (error) {
      console.error('Failed to create terminal session:', error);
    }
  }, [task, terminals, terminalService, terminalStore, handleTabSelect, onTabsChange]);
  
  // Rename tab
  const handleTabRename = useCallback(async (dbSessionId: string, newName: string) => {
    try {
      const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
      if (!terminal) return;
      
      await terminalService.updateTerminalTab(terminal.normalizedId, { tabName: newName });
      
      terminalStore.updateTerminal(task.id, dbSessionId, {
        type: 'rename',
        name: newName
      });
      onTabsChange?.();
    } catch (error) {
      console.error('Failed to rename tab:', error);
    }
  }, [task.id, terminals, terminalService, terminalStore, onTabsChange]);
  
  // Reorder tabs
  const handleTabReorder = useCallback(async (reorderedTabs: Tab[]) => {
    try {
      const updatePromises = reorderedTabs.map(tab => {
        const terminal = terminals.find(t => t.dbSessionId === tab.id);
        if (!terminal) return Promise.resolve();
        
        return terminalService.updateTerminalTab(terminal.normalizedId, {
          tabOrder: tab.tabOrder
        });
      });
      
      await Promise.all(updatePromises);
      
      // Update store
      reorderedTabs.forEach(tab => {
        terminalStore.updateTerminal(task.id, tab.id, {
          type: 'reorder',
          order: tab.tabOrder
        });
      });
      
      onTabsChange?.();
    } catch (error) {
      console.error('Failed to reorder tabs:', error);
    }
  }, [task.id, terminals, terminalService, terminalStore, onTabsChange]);
  
  // Handle close with confirmation
  const handleTabClose = useCallback(async (dbSessionId: string) => {
    const terminalToClose = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminalToClose) return;
    
    // Check if it has uncommitted changes
    if (terminalToClose.hasUncommittedChanges) {
      setConfirmClose({
        dbSessionId,
        tabName: terminalToClose.tabName
      });
      return;
    }
    
    // Otherwise, close immediately
    await performTabClose(dbSessionId);
  }, [terminals]);
  
  // Perform actual close
  const performTabClose = useCallback(async (dbSessionId: string) => {
    console.log('[performTabClose] Starting close for:', dbSessionId);
    
    try {
      const terminalToClose = terminals.find(t => t.dbSessionId === dbSessionId);
      if (!terminalToClose) {
        console.log('[performTabClose] Terminal not found, aborting');
        return;
      }
      
      // Handle active tab switching
      const closingTerminalNormalizedId = terminalToClose.normalizedId;
      if (closingTerminalNormalizedId === activeTabId) {
        const remainingTabs = terminals.filter(t => t.dbSessionId !== dbSessionId);
        
        if (remainingTabs.length > 0) {
          // Switch to next tab BEFORE deleting
          const nextTab = remainingTabs.sort((a, b) => a.tabOrder - b.tabOrder)[0];
          const nextTabId = nextTab.normalizedId;
          console.log('[performTabClose] Switching to next tab:', nextTabId);
          setActiveTabId(nextTabId);
          localStorage.setItem(`activeTab-${task.id}`, nextTabId);
          terminalStore.setActiveTerminal(task.id, nextTabId);
        } else {
          console.log('[performTabClose] No remaining tabs after close');
        }
      }
      
      // Delete the terminal session
      console.log('[performTabClose] Calling terminalService.deleteTerminalSession');
      await terminalService.deleteTerminalSession(terminalToClose.normalizedId);
      
      // Remove from store
      terminalStore.updateTerminal(task.id, dbSessionId, {
        type: 'remove'
      });
      
      // Clear confirmation if it was set
      setConfirmClose(null);
      
      // Navigate away if no tabs left
      if (terminals.length <= 1) {
        navigate(`/projects/${task.projectId}/tasks`);
      }
      
      onTabsChange?.();
    } catch (error: any) {
      // Ignore race condition errors
      if (error.message && error.message.includes('Session not found')) {
        console.log('[performTabClose] Session already deleted (race condition), ignoring error');
        setConfirmClose(null);
        terminalStore.updateTerminal(task.id, dbSessionId, {
          type: 'remove'
        });
      } else {
        console.error('Failed to close terminal:', error);
      }
    }
  }, [task, terminals, activeTabId, terminalService, terminalStore, navigate, onTabsChange]);
  
  const cancelCloseConfirmation = useCallback(() => {
    setConfirmClose(null);
  }, []);
  
  // Auto-select first terminal if none selected
  useEffect(() => {
    if (!activeTabId && terminals.length > 0) {
      const firstTerminal = terminals.sort((a, b) => a.tabOrder - b.tabOrder)[0];
      if (firstTerminal) {
        handleTabSelect(firstTerminal.normalizedId);
      }
    }
  }, [activeTabId, terminals, handleTabSelect]);
  
  // Single unified method for all tab modifications
  const modifyTab = useCallback(async (action: TabAction) => {
    switch (action.type) {
      case 'select':
        handleTabSelect(action.tabId);
        break;
      case 'add':
        await handleTabAdd(action.options);
        break;
      case 'close':
        await handleTabClose(action.dbSessionId);
        break;
      case 'forceClose':
        await performTabClose(action.dbSessionId);
        break;
      case 'rename':
        await handleTabRename(action.dbSessionId, action.newName);
        break;
      case 'reorder':
        await handleTabReorder(action.tabs);
        break;
    }
  }, [handleTabSelect, handleTabAdd, handleTabClose, performTabClose, handleTabRename, handleTabReorder]);
  
  // Simplified public interface
  return {
    tabs,
    activeTabId,
    confirmClose,
    modifyTab,
    cancelCloseConfirmation
  };
}