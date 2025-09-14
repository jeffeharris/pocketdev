import { useState, forwardRef, useImperativeHandle, useRef, useEffect, useReducer } from 'react';
import { Eye, EyeOff, RefreshCw, ExternalLink, Monitor, Square, Columns, Rows, Grid2x2 } from 'lucide-react';
import { useToast } from '@shelltender/client';
import type { Task, TerminalSession } from '../../types/task';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { TerminalTabs, type Tab } from './TerminalTabs';
import { SessionLauncher, type SessionOptions } from './SessionLauncher';
import { useService } from '../../services';
import { useTaskStatus } from '../../hooks/useTaskStatus';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SplitViewContainer } from './SplitViewContainer';
import { EmptyTerminalPanel } from './EmptyTerminalPanel';
import { useSplitViewStore, useSplitLayout, saveLayout } from '../../stores/splitViewStore';
import { useTerminalStore, useTaskTerminals, useActiveTerminalId, useFocusedTerminalId } from '../../stores/terminal/terminalStore.deep';
import { useShortcutContext } from '../../hooks/keyboard';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { ThrottledTerminal } from './ThrottledTerminal';
import type { SplitLayoutConfig } from '../../stores/splitViewStore';
import { terminalPanelReducer, createInitialState, selectors } from './terminalPanelReducer';
import './TerminalPanel.css';

export type TerminalPanelHandle = {
  focus: () => void;
  switchToTab: (dbSessionId: string) => void;
};

interface TerminalPanelProps {
  task: Task;
  validationMode: boolean;
  onToggleValidation: () => void;
  onToggleSidebar: () => void;
  isVisible?: boolean;
  isFullscreen?: boolean;
}

function TerminalPanelComponent(props: TerminalPanelProps, ref: React.ForwardedRef<TerminalPanelHandle>) {
  const {
    task,
    validationMode,
    onToggleValidation,
    onToggleSidebar,
    isVisible = true,
    isFullscreen = false
  } = props;
  const terminalService = useService('terminal');
  
  // Use reducer for all component state
  const [state, dispatch] = useReducer(
    terminalPanelReducer,
    task.id,
    (taskId) => {
      // Check for focus request first
      const focusTabKey = `focus-tab-${taskId}`;
      const focusTabId = sessionStorage.getItem(focusTabKey);
      if (focusTabId) {
        const initialState = createInitialState(taskId);
        return { ...initialState, activeTabId: focusTabId };
      }
      return createInitialState(taskId);
    }
  );
  
  const { 
    activeTabId, 
    isResetting, 
    showSessionLauncher, 
    sessionStatuses, 
    confirmClose,
    canShowQuad,
    canShowHorizontal,
    canShowVertical
  } = state;
  
  const terminalRefs = useRef<Map<string, DirectTerminalHandle>>(new Map());
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  
  // Get real-time session states from WebSocket
  const { sessionStates: realtimeSessionStates } = useTaskStatus(task.id);
  
  
  // Viewport constraints are now in reducer state
  
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Get actual terminal container height if available
      const terminalHeight = terminalContainerRef.current?.offsetHeight || height;
      
      // Use terminal container height for constraints when in validation mode
      const effectiveHeight = validationMode ? terminalHeight : height;
      
      // Quad view needs large screen and sufficient terminal height
      // Horizontal and quad splits need the same height threshold
      const minHeightForHorizontalSplits = 600;
      
      dispatch({
        type: 'UPDATE_VIEWPORT_CONSTRAINTS',
        constraints: {
          quad: width >= 1400 && effectiveHeight >= minHeightForHorizontalSplits,
          horizontal: effectiveHeight >= minHeightForHorizontalSplits,
          vertical: width >= 1000
        }
      });
    };
    
    checkViewport();
    window.addEventListener('resize', checkViewport);
    
    // Also check when validation mode changes
    const resizeObserver = new ResizeObserver(checkViewport);
    if (terminalContainerRef.current) {
      resizeObserver.observe(terminalContainerRef.current);
    }
    
    return () => {
      window.removeEventListener('resize', checkViewport);
      resizeObserver.disconnect();
    };
  }, [validationMode]);
  
  // Split view state
  const layout = useSplitLayout();
  const { toggleSplitMode, updateLayout, setCurrentTask } = useSplitViewStore();
  
  // Auto-downgrade layout if viewport becomes too small
  useEffect(() => {
    // If in quad view but screen too small, downgrade
    if (layout.mode === 'split-4' && !canShowQuad) {
      // Try horizontal split first, then vertical, then tab
      if (canShowHorizontal) {
        updateLayout( { mode: 'split', orientation: 'horizontal' });
      } else if (canShowVertical) {
        updateLayout( { mode: 'split', orientation: 'vertical' });
      } else {
        updateLayout( { mode: 'tab' });
      }
    }
    // If in horizontal split but screen too short, switch to vertical or tab
    else if (layout.mode === 'split' && layout.orientation === 'horizontal' && !canShowHorizontal) {
      if (canShowVertical) {
        updateLayout( { orientation: 'vertical' });
      } else {
        updateLayout( { mode: 'tab' });
      }
    }
    // If in vertical split but screen too narrow, switch to horizontal or tab
    else if (layout.mode === 'split' && layout.orientation === 'vertical' && !canShowVertical) {
      if (canShowHorizontal) {
        updateLayout( { orientation: 'horizontal' });
      } else {
        updateLayout( { mode: 'tab' });
      }
    }
  }, [layout.mode, layout.orientation, canShowQuad, canShowHorizontal, canShowVertical, task.id, updateLayout]);
  
  // Set current task for split view on mount
  useEffect(() => {
    if (task.project_id) {
      setCurrentTask(task.id, task.project_id);
    }
  }, [task.id, task.project_id, setCurrentTask]);

  // Get terminals from the store
  const terminalsFromStore = useTaskTerminals(task.id);
  const activeTerminalId = useActiveTerminalId(task.id);
  const focusedTerminalId = useFocusedTerminalId(task.id);
  const terminalStore = useTerminalStore();
  
  // Use terminals from task prop if store is empty (handles initial load and view switches)
  const terminals = terminalsFromStore.length > 0 ? terminalsFromStore : (task.terminals || []);
  
  // Activate terminal keyboard context only when visible (priority 10 for feature-level)
  useShortcutContext('terminal', { enabled: isVisible, priority: 10 });
  
  // Force sync terminals when layout changes (fixes terminals not showing when switching views)
  useEffect(() => {
    if (task.terminals && task.terminals.length > 0 && terminalsFromStore.length === 0) {
      terminalStore.initializeTask(task.id, task.terminals);
    }
  }, [layout.mode, task.id, task.terminals, terminalsFromStore.length, terminalStore]);
  
  // Initialize terminals from task prop on mount or when task changes
  useEffect(() => {
    // Always sync terminals from task prop to store when available
    if (task.terminals && task.terminals.length > 0) {
      // Check if store is empty or out of sync
      const currentStoreTerminals = useTerminalStore.getState().getTerminals(task.id);
      if (currentStoreTerminals.length === 0 || currentStoreTerminals.length !== task.terminals.length) {
        terminalStore.initializeTask(task.id, task.terminals);
      }
      // Set initial focus to active terminal if no focus set
      if (!focusedTerminalId && activeTabId) {
        terminalStore.updateTerminal(task.id, activeTabId, {
          type: 'set-focus',
          focus: true
        });
      }
    }
  }, [task.id, task.terminals, terminalStore, focusedTerminalId, activeTabId]);
  
  // Simple effect - just validate the saved tab exists
  useEffect(() => {
    console.log('[TerminalPanel useEffect@186] Running tab validation effect:', {
      taskId: task.id,
      terminalsLength: terminals.length,
      activeTabId,
      terminals: terminals.map(t => ({ dbSessionId: t.dbSessionId, tabName: t.tabName }))
    });
    
    if (terminals.length > 0) {
      const savedId = localStorage.getItem(`activeTab-${task.id}`);
      const currentTab = terminals.find(t => (t.normalizedId || terminalService.getNormalizedId(t)) === activeTabId);
      const validTab = terminals.find(t => t.dbSessionId === savedId);
      
      console.log('[TerminalPanel useEffect@186] Tab state:', {
        savedId,
        currentTab: currentTab?.dbSessionId,
        validTab: validTab?.dbSessionId,
        willUpdate: (!currentTab && !validTab && terminals[0]) || (!currentTab && validTab)
      });
      
      // Only update if we don't have a current valid tab
      if (!currentTab && !validTab && terminals[0]) {
        const firstTerminalId = terminals[0].normalizedId || terminalService.getNormalizedId(terminals[0]);
        console.log('[TerminalPanel useEffect@186] Setting activeTabId to first terminal:', firstTerminalId);
        setActiveTabId(firstTerminalId);
        // Don't set focus here - let the initial terminals effect handle it
      } else if (!currentTab && validTab) {
        const validTabId = validTab.normalizedId || terminalService.getNormalizedId(validTab);
        console.log('[TerminalPanel useEffect@186] Setting activeTabId to saved tab:', validTabId);
        setActiveTabId(validTabId);
      }
    }
  }, [task.id, terminals.length]); // Use terminals.length instead of terminals to avoid re-runs on terminal updates

  // Check for focus tab request
  useEffect(() => {
    const focusTabKey = `focus-tab-${task.id}`;
    const focusTabId = sessionStorage.getItem(focusTabKey);
    
    if (focusTabId && terminals.length > 0) {
      const tabToFocus = terminals.find(t => t.dbSessionId === focusTabId);
      if (tabToFocus) {
        setActiveTabId(focusTabId);
        terminalStore.setActiveTerminal(task.id, focusTabId);
        localStorage.setItem(`activeTab-${task.id}`, focusTabId);
        // Clean up after using
        sessionStorage.removeItem(focusTabKey);
      }
    }
  }, [task.id, terminals, terminalStore]);

  // Save when active tab changes
  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    terminalStore.setActiveTerminal(task.id, tabId);
    terminalStore.updateTerminal(task.id, tabId, {
      type: 'set-focus',
      focus: true
    });
    localStorage.setItem(`activeTab-${task.id}`, tabId);
    // Focus the terminal after switching
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(tabId);
      terminalRef?.focus();
    }, 100);
  };

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      // Focus the active terminal
      const activeTerminal = terminals.find(t => (t.normalizedId || terminalService.getNormalizedId(t)) === activeTabId);
      const activeRef = activeTerminal ? terminalRefs.current.get(activeTerminal.dbSessionId) : undefined;
      activeRef?.focus();
    },
    switchToTab: (dbSessionId: string) => {
      // Check if the tab exists
      const tab = terminals.find(t => t.dbSessionId === dbSessionId);
      if (tab) {
        const normalizedId = terminal.normalizedId || terminalService.getNormalizedId(terminal);
        handleTabSelect(normalizedId);
      }
    }
  }), [activeTabId, terminals, handleTabSelect]);
  
  const handleRefreshSession = async () => {
    setIsResetting(true);
    try {
      // Tab mode - use the normal logic
      const activeTerminal = terminals.find(t => (t.normalizedId || terminalService.getNormalizedId(t)) === activeTabId);
      if (!activeTerminal) {
        showNotification('warning', 'No active terminal to refresh');
        return;
      }

      // Check if session is disconnected
      const sessionStatus = sessionStatuses.get(activeTabId); // Already using normalized ID
      const isDisconnected = sessionStatus === 'disconnected' || sessionStatus === 'error';
      
      // Get the terminal ref for the active terminal
      const terminalRef = activeTerminal ? terminalRefs.current.get(activeTerminal.dbSessionId) : undefined;
      
      if (terminalRef?.refresh) {
        // Call the refresh method which will:
        // 1. Reconnect WebSocket if needed
        // 2. Restore terminal buffer
        // 3. Fit terminal to container
        terminalRef.refresh();
        
        // Also trigger a fit after a short delay to ensure proper sizing
        setTimeout(() => {
          terminalRef.fit();
        }, 200);
        
        // If we were disconnected, also try to reload task data
        if (isDisconnected && task.onReload) {
          await task.onReload();
        }
        
        showNotification('success', isDisconnected ? 'Reconnecting terminal session...' : 'Terminal refreshed');
      } else {
        // Fallback: reload the entire task
        if (task.onReload) {
          await task.onReload();
          showNotification('success', 'Reloading terminal session...');
        }
      }
      
      // Update the session status to trigger any necessary UI updates
      await triggerStatusUpdate(task.id, activeTabId);
      
    } catch (error) {
      console.error('[TerminalPanel] Failed to refresh session:', error);
      showNotification('error', 'Failed to refresh terminal session');
    } finally {
      setTimeout(() => dispatch({ type: 'FINISH_RESET' }), 1000);
    }
  };
  
  // Helper to trigger status update
  const triggerStatusUpdate = async (taskId: string, sessionId: string) => {
    // This would trigger any status checks or updates needed
    // For now, we'll just ensure the terminal gets properly sized
    const terminalRef = terminalRefs.current.get(sessionId);
    if (terminalRef?.fit) {
      terminalRef.fit();
    }
  };


  const handleTabAdd = async (options?: SessionOptions) => {
    try {
      const tabCount = terminals.length;
      
      // Get the currently active terminal to copy history from
      const activeTerminal = terminals.find(t => (t.normalizedId || terminalService.getNormalizedId(t)) === activeTabId);
      
      // Use provided options or generate next available "Tab #"
      const aiAgent = options?.aiAgent || 'claude';
      const tabName = options?.tabName || getNextAvailableTabName(terminals);
      
      const newSession = await terminalService.createTerminalSession(task.id, {
        tabName,
        aiAgent,
        copyHistoryFrom: activeTerminal?.sessionId || null
      });
      
      console.log('[TerminalPanel handleTabAdd] New session created:', {
        sessionId: newSession.sessionId,
        dbSessionId: newSession.dbSessionId,
        shelltenderSessionId: newSession.shelltenderSessionId,
        fullObject: newSession
      });
      
      const newTerminal: TerminalSession = {
        sessionId: newSession.sessionId,
        dbSessionId: newSession.dbSessionId,
        shelltenderSessionId: newSession.shelltenderSessionId,
        tabName: newSession.tabName,
        tabOrder: newSession.tabOrder,
        aiState: 'not-started',
        aiAgent: newSession.aiAgent
      };
      
      // Use normalized ID for tracking active tab
      const normalizedId = newSession.normalizedId || terminalService.getNormalizedId(newTerminal);
      
      // Just update the active tab - backend has already added it to the database
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: normalizedId });
      localStorage.setItem(`activeTab-${task.id}`, normalizedId);
      
      // Reload task to get updated terminals list
      if (task.onReload) {
        task.onReload();
      }
      
      // Auto-launch AI agent if specified
      if (aiAgent && aiAgent !== 'none') {
        // Wait for terminal connection to be established
        setTimeout(async () => {
          try {
            const normalizedId = newSession.normalizedId || terminalService.getNormalizedId(newTerminal);
            await terminalService.launchAgent(normalizedId, aiAgent, {
              workingDirectory: options?.workingDirectory,
              initialPrompt: options?.initialPrompt,
              worktreePath: task.worktree_path
            });
          } catch (error) {
            console.error('[TerminalPanel] Failed to launch agent:', error);
          }
        }, 500);
      }
    } catch (error) {
      console.error('[TerminalPanel] Failed to create new terminal:', error);
    }
  };


  // Get next available "Tab #" name that doesn't already exist
  const getNextAvailableTabName = (existingTabs: TerminalSession[]): string => {
    const existingTabNumbers = existingTabs
      .map(t => {
        const match = t.tabName.match(/^Tab (\d+)$/);
        return match ? parseInt(match[1]) : null;
      })
      .filter((n): n is number => n !== null);
    
    // Find the first available number starting from 1
    let nextNumber = 1;
    while (existingTabNumbers.includes(nextNumber)) {
      nextNumber++;
    }
    
    return `Tab ${nextNumber}`;
  };

  // Handle tab rename
  const handleTabRename = async (dbSessionId: string, newName: string) => {
    try {
      // Find the terminal
      const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
      if (!terminal) return;
      
      // Optimistically update the store
      terminalStore.updateTerminal(task.id, terminal.dbSessionId, {
        type: 'rename',
        name: newName
      });
      
      // Update via API
      // Get normalized ID for the terminal
      const normalizedId = terminalService.getNormalizedId(terminal);
      await terminalService.updateTerminalTab(normalizedId, {
        tabName: newName
      });
      
      // Reload task to get updated terminals list
      if (task.onReload) {
        task.onReload();
      }
    } catch (error) {
      console.error('[TerminalPanel] Failed to rename tab:', error);
      // Revert on error
      const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
      if (terminal) {
        const currentName = tabs.find(t => t.id === dbSessionId)?.name || 'Tab';
        terminalStore.updateTerminal(task.id, terminal.dbSessionId, {
          type: 'rename',
          name: currentName
        });
      }
      showNotification('error', 'Failed to rename tab');
    }
  };

  // Handle tab reorder
  const handleTabReorder = async (reorderedTabs: Tab[]) => {
    try {
      // Update each tab's order in the backend
      const updatePromises = reorderedTabs.map(tab => {
        // Find the terminal for this tab to get normalized ID
        const terminal = terminals.find(t => t.dbSessionId === tab.dbSessionId);
        if (!terminal) return Promise.resolve();
        const normalizedId = terminalService.getNormalizedId(terminal);
        return terminalService.updateTerminalTab(normalizedId, {
          tabOrder: tab.tabOrder
        });
      });
      
      await Promise.all(updatePromises);
      
      // Reload task to get updated terminals list
      if (task.onReload) {
        task.onReload();
      }
    } catch (error) {
      console.error('[TerminalPanel] Failed to reorder tabs:', error);
      showNotification('error', 'Failed to reorder tabs');
    }
  };


  // Handle session status changes
  const handleSessionStatus = (dbSessionId: string, status: 'connected' | 'disconnected' | 'error') => {
    // Find terminal and get normalized ID
    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) return;
    
    const normalizedId = terminal.normalizedId || terminalService.getNormalizedId(terminal);
    
    // Update status map with normalized ID
    setSessionStatuses(prev => {
      const newMap = new Map(prev);
      newMap.set(normalizedId, status);
      return newMap;
    });
    if (!terminal) return;

    if (status === 'disconnected') {
      console.warn(`[TerminalPanel] Session disconnected for ${terminal.tabName}`);
      // Attempt automatic reconnection after a delay
      setTimeout(() => {
        handleReconnectSession(dbSessionId);
      }, 2000);
    } else if (status === 'error') {
      console.error(`[TerminalPanel] Session error for ${terminal.tabName}`);
      // Show error notification
      showNotification('error', `Terminal "${terminal.tabName}" encountered an error`);
    } else if (status === 'connected') {
      // Clear any error state
      const prevStatus = sessionStatuses.get(dbSessionId);
      if (prevStatus === 'disconnected' || prevStatus === 'error') {
        showNotification('success', `Terminal "${terminal.tabName}" reconnected`);
      }
    }
  };

  // Handle tab close
  const handleTabClose = async (dbSessionId: string) => {
    // Find the terminal being closed
    const terminalToClose = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminalToClose) return;
    
    // Get the real-time state for this session
    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
    const normalizedId = terminal ? (terminal.normalizedId || terminalService.getNormalizedId(terminal)) : dbSessionId;
    const realtimeState = realtimeSessionStates?.find(s => s.id === dbSessionId);
    const currentAiState = realtimeState?.aiState || terminalToClose.aiState;
    
    // If AI is active (not 'not-started'), show confirmation
    if (currentAiState !== 'not-started') {
      setConfirmClose({ 
        dbSessionId, 
        tabName: terminalToClose.tabName 
      });
      return;
    }
    
    // Otherwise, close immediately
    await performTabClose(dbSessionId);
  };
  
  const performTabClose = async (dbSessionId: string) => {
    console.log('[performTabClose] Starting close for:', dbSessionId, {
      currentTerminals: terminals.map(t => ({ id: t.dbSessionId, name: t.tabName })),
      activeTabId,
      isClosingActiveTab: (terminalToClose ? (terminalToClose.normalizedId || terminalService.getNormalizedId(terminalToClose)) : dbSessionId) === activeTabId
    });
    
    try {
      // Find the terminal being closed
      const terminalToClose = terminals.find(t => t.dbSessionId === dbSessionId);
      if (!terminalToClose) {
        console.log('[performTabClose] Terminal not found, aborting');
        return;
      }
      
      // If closing the active tab, switch to another tab first
      const closingTerminalNormalizedId = terminalToClose ? (terminalToClose.normalizedId || terminalService.getNormalizedId(terminalToClose)) : dbSessionId;
      if (closingTerminalNormalizedId === activeTabId) {
        const remainingTabs = terminals.filter(t => t.dbSessionId !== dbSessionId);
        console.log('[performTabClose] Closing active tab, remaining tabs:', remainingTabs.length);
        
        if (remainingTabs.length > 0) {
          // Find the next tab and switch to it BEFORE deleting
          const nextTab = remainingTabs.sort((a, b) => a.tabOrder - b.tabOrder)[0];
          const nextTabId = nextTab.normalizedId || terminalService.getNormalizedId(nextTab);
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
      // Get normalized ID for deletion
      const normalizedId = terminalService.getNormalizedId(terminalToClose);
      await terminalService.deleteTerminalSession(normalizedId);
      
      // Clear confirm close state if it exists
      dispatch({ type: 'CANCEL_CLOSE_CONFIRMATION' });
      
      // Reload task to get updated terminals list
      if (task.onReload) {
        await task.onReload();
      }
      
      // Skip the success notification to avoid terminal re-render issues
      // The tab closing is already visually apparent to the user
    } catch (error: any) {
      // Check if this is a "Session not found" error - this can happen when closing multiple
      // tabs quickly due to race conditions with WebSocket events
      if (error.message && error.message.includes('Session not found')) {
        console.log('[performTabClose] Session already deleted (race condition), ignoring error');
        // Clear confirm close state
        dispatch({ type: 'CANCEL_CLOSE_CONFIRMATION' });
        // Still reload to ensure UI is in sync
        if (task.onReload) {
          await task.onReload();
        }
        return;
      }
      
      console.error('[TerminalPanel] Failed to close tab:', error);
      showNotification('error', 'Failed to close tab');
      // Clear confirm close state on error too
      dispatch({ type: 'CANCEL_CLOSE_CONFIRMATION' });
    }
  };

  // Handle session reconnection
  const handleReconnectSession = async (dbSessionId: string) => {
    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) return;

    
    try {
      // Try to reconnect by reloading the terminal
      const terminalRef = terminalRefs.current.get(dbSessionId);
      if (terminalRef) {
        // Reload task to force reconnection
        if (task.onReload) {
          task.onReload();
        }
      }
    } catch (error) {
      console.error(`[TerminalPanel] Failed to reconnect session:`, error);
      showNotification('error', `Failed to reconnect terminal "${terminal.tabName}"`);
    }
  };

  // Show notification using Shelltender's toast system
  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    // showToast expects (message: string, duration?: number)
    // For now, ignore the type parameter as the toast library doesn't support variants
    showToast(message, 5000);
  };

  // Render control buttons (reusable for both tab mode and split view)
  const renderControlButtons = () => (
    <>
      {/* Split View Toggle */}
      <button 
          onClick={() => {
            if (layout.mode === 'tab') {
              // Switch to vertical split if allowed, otherwise horizontal, otherwise stay in tab
              if (canShowVertical) {
                updateLayout( { mode: 'split', orientation: 'vertical' });
              } else if (canShowHorizontal) {
                updateLayout( { mode: 'split', orientation: 'horizontal' });
              }
              // If neither split view is possible, stay in tab mode
            } else if (layout.mode === 'split' && layout.orientation === 'vertical') {
              // Switch to horizontal split if allowed, otherwise quad if allowed, otherwise tab
              if (canShowHorizontal) {
                updateLayout( { orientation: 'horizontal' });
              } else if (canShowQuad) {
                updateLayout( { mode: 'split-4' });
              } else {
                updateLayout( { mode: 'tab' });
              }
            } else if (layout.mode === 'split' && layout.orientation === 'horizontal') {
              // Switch to quad view if allowed, otherwise back to tab
              if (canShowQuad) {
                updateLayout( { mode: 'split-4' });
              } else {
                updateLayout( { mode: 'tab' });
              }
            } else {
              // From quad view, always go back to tab mode
              updateLayout( { mode: 'tab' });
            }
            // Save layout after any changes
            saveLayout();
          }}
          className={`p-1 transition-colors ${
            layout.mode !== 'tab' 
              ? 'text-blue-400 hover:text-blue-300' 
              : 'text-gray-400 hover:text-gray-200'
          }`}
          title={
            layout.mode === 'tab' 
              ? (!canShowVertical && !canShowHorizontal) ? 'Screen too small for split view' : 'Enable split view (Alt+D)' 
              : layout.mode === 'split' && layout.orientation === 'vertical'
              ? !canShowHorizontal ? 'Switch to single tab view (Alt+D) - Screen too narrow for horizontal split' : 'Switch to horizontal split (Alt+D)'
              : layout.mode === 'split' && layout.orientation === 'horizontal'
              ? !canShowQuad ? 'Switch to single tab view (Alt+D) - Screen too small for quad view' : 'Switch to quad view (Alt+D)'
              : layout.mode === 'split-4'
              ? 'Switch to single tab view (Alt+D)'
              : 'Switch to single tab view (Alt+D)'
          }
        >
          {layout.mode === 'tab' 
            ? <Square className="w-4 h-4" />
            : layout.mode === 'split' && layout.orientation === 'vertical'
            ? <Columns className="w-4 h-4" />  // Columns icon for vertical split (side by side)
            : layout.mode === 'split' && layout.orientation === 'horizontal'
            ? <Rows className="w-4 h-4" />     // Rows icon for horizontal split (top/bottom)
            : <Grid2x2 className="w-4 h-4" />  // Grid icon for quad view
          }
        </button>
      <button 
        onClick={onToggleSidebar}
        className="text-gray-400 hover:text-gray-200 p-1"
        title={isFullscreen ? "Exit fullscreen (Alt+F)" : "Enter fullscreen (Alt+F)"}
      >
        {isFullscreen ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
      <button 
        onClick={(e) => {
          // In split view mode, let the SplitViewContainer handle it
          if (layout.mode === 'split' || layout.mode === 'split-4') {
            // Just mark the button with data-action, the event will bubble up
            return;
          }
          // In tab mode, handle it here
          handleRefreshSession();
        }}
        data-action="refresh"
        className={`p-1 transition-colors ${
          isResetting 
            ? 'text-blue-400 animate-spin' 
            : Array.from(sessionStatuses.values()).some(s => s === 'disconnected' || s === 'error')
            ? 'text-orange-400 hover:text-orange-300'
            : 'text-gray-400 hover:text-gray-200'
        }`}
        disabled={isResetting}
        title={Array.from(sessionStatuses.values()).some(s => s === 'disconnected' || s === 'error') 
          ? "Reconnect and restore terminal session (Ctrl+Shift+R)" 
          : "Refresh terminal - sync state, reload buffer, restore cursor (Ctrl+Shift+R)"}
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      <button 
        onClick={() => {
          // Open terminal in a new window
          const url = `/terminal/${task.project_id}/${task.id}`;
          const features = 'width=1400,height=800,menubar=no,toolbar=no,location=no,status=no';
          window.open(url, `terminal-${task.id}`, features);
        }}
        className="text-gray-400 hover:text-gray-200 p-1"
        title="Open in new window"
      >
        <ExternalLink className="w-4 h-4" />
      </button>
      <button 
        onClick={onToggleValidation}
        className={`p-1 transition-colors ${validationMode ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
      >
        <Monitor className="w-4 h-4" />
      </button>
    </>
  );

  // Convert terminals to Tab format for TerminalTabs component
  const tabs: Tab[] = terminals.map(t => {
    const normalizedId = t.normalizedId || terminalService.getNormalizedId(t);
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
      aiState: currentAiState,
      aiAgent: t.aiAgent,
      connectionStatus: connectionStatus
    };
  });
  
  // Listen for keyboard shortcut events
  useEffect(() => {
    const handleTerminalShortcut = (event: CustomEvent) => {
      switch (event.type) {
        case 'terminal-new-tab':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          if (terminals.length < 6) {
            handleTabAdd();
          }
          break;
        case 'terminal-close-tab':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          if (activeTabId && terminals.length > 1) {
            handleTabClose(activeTabId);
          }
          break;
        case 'terminal-next-tab':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          {
            const currentIndex = terminals.findIndex(t => (t.normalizedId || terminalService.getNormalizedId(t)) === activeTabId);
            const nextIndex = (currentIndex + 1) % terminals.length;
            if (terminals[nextIndex]) {
              const nextTerminalId = terminals[nextIndex].normalizedId || terminalService.getNormalizedId(terminals[nextIndex]);
              handleTabSelect(nextTerminalId);
            }
          }
          break;
        case 'terminal-previous-tab':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          {
            const currentIndex = terminals.findIndex(t => (t.normalizedId || terminalService.getNormalizedId(t)) === activeTabId);
            const prevIndex = currentIndex === 0 ? terminals.length - 1 : currentIndex - 1;
            if (terminals[prevIndex]) {
              const prevTerminalId = terminals[prevIndex].normalizedId || terminalService.getNormalizedId(terminals[prevIndex]);
              handleTabSelect(prevTerminalId);
            }
          }
          break;
        case 'terminal-switch-tab':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          {
            const detail = (event as CustomEvent).detail;
            if (detail && typeof detail.index === 'number' && terminals[detail.index]) {
              const targetTerminalId = terminals[detail.index].normalizedId || terminalService.getNormalizedId(terminals[detail.index]);
              handleTabSelect(targetTerminalId);
            }
          }
          break;
        case 'terminal-toggle-split':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          if (layout.mode === 'tab') {
            // Switch to vertical split if allowed, otherwise horizontal, otherwise stay in tab
            if (canShowVertical) {
              updateLayout( { mode: 'split', orientation: 'vertical' });
            } else if (canShowHorizontal) {
              updateLayout( { mode: 'split', orientation: 'horizontal' });
            }
            // If neither split view is possible, stay in tab mode
          } else if (layout.mode === 'split' && layout.orientation === 'vertical') {
            // Switch to horizontal split if allowed, otherwise quad if allowed, otherwise tab
            if (canShowHorizontal) {
              updateLayout( { orientation: 'horizontal' });
            } else if (canShowQuad) {
              updateLayout( { mode: 'split-4' });
            } else {
              updateLayout( { mode: 'tab' });
            }
          } else if (layout.mode === 'split' && layout.orientation === 'horizontal') {
            // Switch to quad view if allowed, otherwise back to tab
            if (canShowQuad) {
              updateLayout( { mode: 'split-4' });
            } else {
              updateLayout( { mode: 'tab' });
            }
          } else {
            // From quad view, always go back to tab mode
            updateLayout( { mode: 'tab' });
          }
          // Save layout after any changes
          saveLayout();
          break;
        case 'terminal-toggle-fullscreen':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          onToggleSidebar();
          break;
        case 'terminal-refresh':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          // Simulate a click on the refresh button to ensure consistent behavior
          const refreshButton = document.querySelector('[data-action="refresh"]') as HTMLButtonElement;
          if (refreshButton) {
            refreshButton.click();
          }
          break;
      }
    };

    // Add event listeners
    document.addEventListener('terminal-new-tab', handleTerminalShortcut as EventListener);
    document.addEventListener('terminal-close-tab', handleTerminalShortcut as EventListener);
    document.addEventListener('terminal-next-tab', handleTerminalShortcut as EventListener);
    document.addEventListener('terminal-previous-tab', handleTerminalShortcut as EventListener);
    document.addEventListener('terminal-switch-tab', handleTerminalShortcut as EventListener);
    document.addEventListener('terminal-toggle-split', handleTerminalShortcut as EventListener);
    document.addEventListener('terminal-toggle-fullscreen', handleTerminalShortcut as EventListener);
    document.addEventListener('terminal-refresh', handleTerminalShortcut as EventListener);

    return () => {
      // Remove event listeners
      document.removeEventListener('terminal-new-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-close-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-next-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-previous-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-switch-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-toggle-split', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-toggle-fullscreen', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-refresh', handleTerminalShortcut as EventListener);
    };
  }, [terminals, activeTabId, layout.mode, layout.orientation, task.id, toggleSplitMode, updateLayout, canShowVertical, canShowHorizontal, canShowQuad, onToggleSidebar, handleRefreshSession, isVisible]);

  // Helper function to determine if a terminal should be visible
  const shouldShowTerminal = (
    terminal: TerminalSession, 
    layout: SplitLayoutConfig, 
    activeTabId: string
  ): boolean => {
    const terminalIndex = terminals.findIndex(t => t.dbSessionId === terminal.dbSessionId);
    const terminalNormalizedId = terminal.normalizedId || terminalService.getNormalizedId(terminal);
    
    switch (layout.mode) {
      case 'tab':
        return terminalNormalizedId === activeTabId;
      case 'split':
        // Always show first 2 terminals in split mode, regardless of assignments
        // This ensures we always have 2 panels visible
        return terminalIndex >= 0 && terminalIndex < 2;
      case 'split-4':
        // Always show first 4 terminals in quad mode, regardless of assignments
        // This ensures we always have 4 panels visible
        return terminalIndex >= 0 && terminalIndex < 4;
      default:
        return false;
    }
  };

  // Helper function to get CSS class for terminal based on position
  const getTerminalClassName = (
    terminal: TerminalSession, 
    layout: SplitLayoutConfig
  ): string => {
    if (layout.mode === 'tab') return 'terminal terminal-tab';
    
    const terminalIndex = terminals.findIndex(t => t.dbSessionId === terminal.dbSessionId);
    
    // For split/quad modes, always use order-based positioning
    // The dropdowns will handle which terminal appears in which position
    if (layout.mode === 'split') {
      if (terminalIndex === 0) return 'terminal terminal-primary';
      if (terminalIndex === 1) return 'terminal terminal-secondary';
    } else if (layout.mode === 'split-4') {
      if (terminalIndex === 0) return 'terminal terminal-primary';
      if (terminalIndex === 1) return 'terminal terminal-secondary';
      if (terminalIndex === 2) return 'terminal terminal-tertiary';
      if (terminalIndex === 3) return 'terminal terminal-quaternary';
    }
    
    return 'terminal terminal-hidden';
  };

  return (
    <div 
      className="bg-gray-900 flex flex-col h-full"
    >
      {/* Terminal Header - Only show in tab mode */}
      {layout.mode === 'tab' && (
        <div className="bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <TerminalTabs
              tabs={tabs}
              activeTabId={activeTabId}
              onTabSelect={handleTabSelect}
              onTabAdd={() => handleTabAdd()}
              onTabAdvancedAdd={() => dispatch({ type: 'SHOW_SESSION_LAUNCHER' })}
              onTabRename={handleTabRename}
              onTabClose={handleTabClose}
              onTabReorder={handleTabReorder}
              maxTabs={6}
            />
            <div className="flex items-center gap-2 pr-4">
              {/* Control buttons for tab mode */}
              {renderControlButtons()}
            </div>
          </div>
        </div>
      )}

      {/* Terminal Content - All terminals rendered persistently */}
      <div ref={terminalContainerRef} className="flex-1 bg-gray-900 relative overflow-hidden min-h-0">
        {/* Render all terminals with CSS-based visibility */}
        <div 
          className={`terminals-container mode-${layout.mode} ${layout.mode === 'split' ? `orientation-${layout.orientation}` : ''}`}
          style={{
            '--split-ratio': `${layout.splitRatio * 100}%`,
            '--split-ratio-fr': `${layout.splitRatio}fr`,
            '--split-complement-fr': `${1 - layout.splitRatio}fr`
          } as React.CSSProperties}>
          {terminals.map(terminal => {
            const isVisibleTerminal = shouldShowTerminal(terminal, layout, activeTabId);
            const terminalClassName = getTerminalClassName(terminal, layout);
            
            return (
              <div
                key={terminal.dbSessionId}
                className={`terminal-wrapper ${terminalClassName}`}
                style={{ 
                  display: isVisibleTerminal ? 'block' : 'none'
                }}
              >
                <DirectTerminal
                  ref={(el) => {
                    if (el) {
                      terminalRefs.current.set(terminal.dbSessionId, el);
                    } else {
                      terminalRefs.current.delete(terminal.dbSessionId);
                    }
                  }}
                  taskId={task.id}
                  dbSessionId={terminal.dbSessionId}
                  shelltenderSessionId={terminal.shelltenderSessionId || terminal.sessionId}
                  worktreePath={task.worktree_path}
                  isVisible={isVisibleTerminal && isVisible}
                  hasFocus={focusedTerminalId === (terminal.normalizedId || terminalService.getNormalizedId(terminal))}
                  onSessionStatus={(status) => handleSessionStatus(terminal.dbSessionId, status)}
                  onFocusRequest={() => {
                    terminalStore.updateTerminal(task.id, terminal.normalizedId || terminalService.getNormalizedId(terminal), {
                      type: 'set-focus',
                      focus: true
                    });
                  }}
                />
              </div>
            );
          })}
          
          {/* Render empty panels for missing terminals in split/quad modes */}
          {layout.mode === 'split' && terminals.length < 2 && (
            <>
              {terminals.length === 0 && (
                <div className="terminal-wrapper terminal-primary">
                  <EmptyTerminalPanel 
                    onCreateTerminal={(type) => {
                      switch (type) {
                        case 'claude':
                          handleTabAdd({ aiAgent: 'claude' });
                          break;
                        case 'bash':
                          handleTabAdd({ aiAgent: 'none', tabName: 'Bash' });
                          break;
                        case 'advanced':
                          dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                          break;
                      }
                    }}
                    layout={layout}
                  />
                </div>
              )}
              {terminals.length <= 1 && (
                <div className="terminal-wrapper terminal-secondary">
                  <EmptyTerminalPanel 
                    onCreateTerminal={(type) => {
                      switch (type) {
                        case 'claude':
                          handleTabAdd({ aiAgent: 'claude' });
                          break;
                        case 'bash':
                          handleTabAdd({ aiAgent: 'none', tabName: 'Bash' });
                          break;
                        case 'advanced':
                          dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                          break;
                      }
                    }}
                    layout={layout}
                  />
                </div>
              )}
            </>
          )}
          
          {/* Render empty panels for quad mode */}
          {layout.mode === 'split-4' && terminals.length < 4 && (
            <>
              {terminals.length === 0 && (
                <div className="terminal-wrapper terminal-primary">
                  <EmptyTerminalPanel 
                    onCreateTerminal={(type) => {
                      switch (type) {
                        case 'claude':
                          handleTabAdd({ aiAgent: 'claude' });
                          break;
                        case 'bash':
                          handleTabAdd({ aiAgent: 'none', tabName: 'Bash' });
                          break;
                        case 'advanced':
                          dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                          break;
                      }
                    }}
                    layout={layout}
                  />
                </div>
              )}
              {terminals.length <= 1 && (
                <div className="terminal-wrapper terminal-secondary">
                  <EmptyTerminalPanel 
                    onCreateTerminal={(type) => {
                      switch (type) {
                        case 'claude':
                          handleTabAdd({ aiAgent: 'claude' });
                          break;
                        case 'bash':
                          handleTabAdd({ aiAgent: 'none', tabName: 'Bash' });
                          break;
                        case 'advanced':
                          dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                          break;
                      }
                    }}
                    layout={layout}
                  />
                </div>
              )}
              {terminals.length <= 2 && (
                <div className="terminal-wrapper terminal-tertiary">
                  <EmptyTerminalPanel 
                    onCreateTerminal={(type) => {
                      switch (type) {
                        case 'claude':
                          handleTabAdd({ aiAgent: 'claude' });
                          break;
                        case 'bash':
                          handleTabAdd({ aiAgent: 'none', tabName: 'Bash' });
                          break;
                        case 'advanced':
                          dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                          break;
                      }
                    }}
                    layout={layout}
                  />
                </div>
              )}
              {terminals.length <= 3 && (
                <div className="terminal-wrapper terminal-quaternary">
                  <EmptyTerminalPanel 
                    onCreateTerminal={(type) => {
                      switch (type) {
                        case 'claude':
                          handleTabAdd({ aiAgent: 'claude' });
                          break;
                        case 'bash':
                          handleTabAdd({ aiAgent: 'none', tabName: 'Bash' });
                          break;
                        case 'advanced':
                          dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                          break;
                      }
                    }}
                    layout={layout}
                  />
                </div>
              )}
            </>
          )}
        </div>
        
        {/* Overlay split view controls when in split/quad modes */}
        {(layout.mode === 'split' || layout.mode === 'split-4') && (
          <SplitViewContainer
            taskId={task.id}
            projectId={task.project_id}
            worktreePath={task.worktree_path}
            isVisible={isVisible}
            onSessionStatus={handleSessionStatus}
            activeTabId={activeTabId}
            controlButtons={renderControlButtons()}
            isResetting={isResetting}
            setIsResetting={(value) => dispatch({ type: value ? 'START_RESET' : 'FINISH_RESET' })}
            onTerminalReorder={handleTabReorder}
          />
        )}
      </div>

      {/* Session Launcher Modal */}
      <SessionLauncher
        isOpen={showSessionLauncher}
        onClose={() => dispatch({ type: 'HIDE_SESSION_LAUNCHER' })}
        onLaunch={(options) => {
          handleTabAdd(options);
          dispatch({ type: 'HIDE_SESSION_LAUNCHER' });
        }}
        taskPath={task.worktree_path}
      />
      
      {/* Confirm Close Dialog */}
      <ConfirmDialog
        isOpen={!!confirmClose}
        onClose={() => dispatch({ type: 'CANCEL_CLOSE_CONFIRMATION' })}
        onConfirm={() => {
          if (confirmClose) {
            performTabClose(confirmClose.dbSessionId);
            dispatch({ type: 'CANCEL_CLOSE_CONFIRMATION' });
          }
        }}
        title="Close Terminal Tab"
        message={`Are you sure you want to close "${confirmClose?.tabName}"? The AI session is currently active and will be terminated.`}
        confirmText="Close Tab"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}

const TerminalPanelWithRef = forwardRef<TerminalPanelHandle, TerminalPanelProps>(TerminalPanelComponent);
TerminalPanelWithRef.displayName = 'TerminalPanel';

export const TerminalPanel = TerminalPanelWithRef;