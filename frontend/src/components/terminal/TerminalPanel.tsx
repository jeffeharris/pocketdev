import { useState, forwardRef, useImperativeHandle, useRef, useEffect, useReducer } from 'react';
import { useToast } from '@shelltender/client';
import { findTerminalById } from '../../utils/terminal-utils';
import type { Task, TerminalSession } from '../../types/task';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { TerminalTabs, type Tab } from './TerminalTabs';
import { SessionLauncher, type SessionOptions } from './SessionLauncher';
import { useService } from '../../services';
import { terminalRefreshService } from '../../services/terminal-refresh.service';
import { useTaskStatus } from '../../hooks/useTaskStatus';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useSplitViewStore, useSplitLayout, saveLayout } from '../../stores/splitViewStore';
import { useTerminalStore, useTaskTerminals, useActiveTerminalId, useFocusedTerminalId } from '../../stores/terminal/terminalStore.deep';
import { useShortcutContext } from '../../hooks/keyboard';
import { ThrottledTerminal } from './ThrottledTerminal';
import { useTerminalKeyboardShortcuts } from './useTerminalKeyboardShortcuts';
import { TerminalGrid } from './TerminalGrid';
import { TerminalGridProvider } from './TerminalGridContext';
import { useLayoutConstraints } from './useLayoutConstraints';
import { useTerminalStatus } from './useTerminalStatus';
import { useTabManager } from './useTabManager';
import { ControlButtons } from './ControlButtons';
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
  
  // Use reducer for UI state only (tab management moved to useTabManager)
  const [state, dispatch] = useReducer(
    terminalPanelReducer,
    task.id,
    (taskId) => {
      // Check for focus request first
      const focusTabKey = `focus-tab-${taskId}`;
      const focusTabId = sessionStorage.getItem(focusTabKey);
      if (focusTabId) {
        const initialState = createInitialState(taskId);
        return { ...initialState };
      }
      return createInitialState(taskId);
    }
  );
  
  const { 
    isResetting, 
    showSessionLauncher, 
    sessionStatuses
  } = state;
  
  const terminalRefs = useRef<Map<string, DirectTerminalHandle>>(new Map());
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [shouldForceRefresh, setShouldForceRefresh] = useState(0);
  
  // Get real-time session states from WebSocket
  const { sessionStates: realtimeSessionStates } = useTaskStatus(task.id);
  
  
  // Viewport constraints are now in reducer state
  
  // Use layout constraints hook to manage viewport-based layout rules
  const { canShowQuad, canShowHorizontal, canShowVertical } = useLayoutConstraints({
    layout,
    terminalContainerRef,
    updateLayout,
    onConstraintsChange: (constraints) => {
      dispatch({
        type: 'UPDATE_VIEWPORT_CONSTRAINTS',
        constraints
      });
    }
  });
  
  // Split view state
  const layout = useSplitLayout();
  const { toggleSplitMode, updateLayout, setCurrentTask } = useSplitViewStore();
  
  // Layout constraints hook handles auto-downgrade logic internally
  
  // Get terminals from the store (single source of truth)
  const terminals = useTaskTerminals(task.id);
  const activeTerminalId = useActiveTerminalId(task.id);
  const focusedTerminalId = useFocusedTerminalId(task.id);
  const terminalStore = useTerminalStore();
  
  // Activate terminal keyboard context only when visible (priority 10 for feature-level)
  useShortcutContext('terminal', { enabled: isVisible, priority: 10 });
  
  // Single consolidated mount/unmount effect for initialization
  useEffect(() => {
    // Initialize split view task context
    if (task.project_id) {
      setCurrentTask(task.id, task.project_id);
    }
    
    // Initialize terminal store from task data
    if (task.terminals && task.terminals.length > 0) {
      const currentState = terminalStore.getTaskState(task.id);
      
      // Only initialize if store is empty - happens once on mount
      if (currentState.terminals.length === 0) {
        terminalStore.initializeTask(task.id, task.terminals);
      }
    }
    
    // Cleanup on unmount
    return () => {
      // Optionally dispose task on unmount if needed
      // terminalStore.disposeTask(task.id);
    };
  }, [task.id, task.project_id, task.terminals, setCurrentTask, terminalStore]);
  
  // Now we can use tab manager after terminals are defined
  const {
    tabs,
    activeTabId,
    confirmClose,
    selectTab,
    addTab,
    closeTab,
    forceCloseTab,
    renameTab,
    reorderTabs,
    cancelCloseConfirmation
  } = useTabManager({
    task,
    terminals,
    terminalService,
    sessionStatuses,
    realtimeSessionStates,
    onTabsChange: () => setShouldForceRefresh(prev => prev + 1)
  });
  
  // Handle active tab changes - focus terminal and update store
  useEffect(() => {
    if (!activeTabId) return;
    
    // Update store focus state
    terminalStore.updateTerminal(task.id, activeTabId, {
      type: 'set-focus',
      focus: true
    });
    
    // Focus the actual terminal element after DOM update
    const focusTimer = setTimeout(() => {
      const terminalRef = terminalRefs.current.get(activeTabId);
      terminalRef?.focus();
    }, 100);
    
    return () => clearTimeout(focusTimer);
  }, [activeTabId, task.id, terminalStore]);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      // Focus the active terminal
      const activeTerminal = findTerminalById(terminals, activeTabId, 'dbSessionId');
      const activeRef = activeTerminal ? terminalRefs.current.get(activeTerminal.dbSessionId) : undefined;
      activeRef?.focus();
    },
    switchToTab: (dbSessionId: string) => {
      // Check if the tab exists
      const tab = findTerminalById(terminals, dbSessionId, 'dbSessionId');
      if (tab) {
        selectTab(dbSessionId);
      }
    }
  }), [activeTabId, terminals, selectTab]);
  
  const handleRefreshSession = async () => {
    dispatch({ type: 'START_RESET' });
    try {
      const result = await terminalRefreshService.refreshSession({
        taskId: task.id,
        activeTerminalId: activeTabId,
        terminals,
        sessionStatuses
      });
      
      // Process the actions returned by the service
      for (const action of result.actions) {
        switch (action.type) {
          case 'refresh-terminal': {
            const terminalRef = terminalRefs.current.get(action.terminalId);
            if (terminalRef?.refresh) {
              terminalRef.refresh();
            }
            break;
          }
          case 'reload-task': {
            // Reload the task to get fresh terminal data
            if (task.onReload) {
              await task.onReload();
            }
            break;
          }
          case 'fit-terminal': {
            const terminalRef = terminalRefs.current.get(action.terminalId);
            if (terminalRef?.fit) {
              terminalRef.fit();
            }
            break;
          }
          case 'show-notification': {
            showNotification(action.level, action.message);
            break;
          }
        }
      }
      
      if (result.success) {
        showNotification('success', result.message);
      } else {
        showNotification('warning', result.message);
      }
    } catch (error) {
      console.error('[TerminalPanel] Failed to refresh session:', error);
      showNotification('error', 'Failed to refresh terminal session');
    } finally {
      setTimeout(() => dispatch({ type: 'FINISH_RESET' }), 1000);
    }
  };


  // Show notification using Shelltender's toast system
  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    // showToast expects (message: string, duration?: number)
    // For now, ignore the type parameter as the toast library doesn't support variants
    showToast(message, 5000);
  };

  // Handle session reconnection
  const handleReconnectSession = async (dbSessionId: string) => {
    try {
      const actions = terminalRefreshService.getReconnectActions(
        dbSessionId,
        terminals,
        sessionStatuses
      );
      
      // Process reconnection actions
      for (const action of actions) {
        switch (action.type) {
          case 'refresh-terminal': {
            const terminalRef = terminalRefs.current.get(action.terminalId);
            if (terminalRef?.refresh) {
              terminalRef.refresh();
            }
            break;
          }
          case 'reload-task': {
            if (task.onReload) {
              await task.onReload();
            }
            break;
          }
          case 'show-notification': {
            showNotification(action.level, action.message);
            break;
          }
        }
      }
      
      if (actions.length === 0) {
        const terminal = findTerminalById(terminals, dbSessionId, 'dbSessionId');
        showNotification('error', `Failed to reconnect terminal "${terminal?.tabName || 'unknown'}"`);
      }
    } catch (error) {
      console.error(`[TerminalPanel] Failed to reconnect session:`, error);
      showNotification('error', 'Failed to reconnect terminal');
    }
  };

  // Use terminal status hook for session management
  const { handleSessionStatus, getSessionStatus } = useTerminalStatus({
    terminals,
    sessionStatuses,
    getNormalizedId: (terminal) => terminal.normalizedId,
    dispatch,
    showNotification,
    handleReconnectSession
  });
  
  const hasDisconnectedSessions = terminalRefreshService.hasDisconnectedSessions(sessionStatuses);


  // Render control buttons using the extracted component
  const renderControlButtons = () => (
    <ControlButtons
      layout={layout}
      canShowVertical={canShowVertical}
      canShowHorizontal={canShowHorizontal}
      canShowQuad={canShowQuad}
      isFullscreen={isFullscreen}
      isResetting={isResetting}
      validationMode={validationMode}
      sessionStatuses={sessionStatuses}
      taskProjectId={task.project_id}
      taskId={task.id}
      onLayoutUpdate={updateLayout}
      onLayoutSave={saveLayout}
      onToggleSidebar={onToggleSidebar}
      onRefreshSession={handleRefreshSession}
      onToggleValidation={onToggleValidation}
    />
  );

  // Convert terminals to Tab format for TerminalTabs component
  // Tabs are now provided by useTabManager
  
  // Register keyboard shortcuts
  useTerminalKeyboardShortcuts({
    isVisible,
    terminals,
    activeTabId,
    layout,
    canShowVertical,
    canShowHorizontal,
    canShowQuad,
    handleTabAdd: () => addTab(),
    handleTabClose: closeTab,
    handleTabSelect: selectTab,
    handleRefreshSession,
    updateLayout,
    saveLayout,
    onToggleSidebar
  });

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
              onTabSelect={selectTab}
              onTabAdd={() => addTab()}
              onTabAdvancedAdd={() => dispatch({ type: 'SHOW_SESSION_LAUNCHER' })}
              onTabRename={renameTab}
              onTabClose={closeTab}
              onTabReorder={reorderTabs}
              maxTabs={6}
            />
            <div className="flex items-center gap-2 pr-4">
              {/* Control buttons for tab mode */}
              {renderControlButtons()}
            </div>
          </div>
        </div>
      )}

      {/* Terminal Content - Delegated to TerminalGrid component */}
      <TerminalGridProvider
        value={{
          task,
          terminals,
          activeTabId,
          isVisible,
          focusedTerminalId,
          isResetting,
          terminalRefs,
          onSessionStatus: handleSessionStatus,
          onFocusRequest: (terminalId) => {
            terminalStore.updateTerminal(task.id, terminalId, {
              type: 'set-focus',
              focus: true
            });
          },
          onResetStateChange: (value) => 
            dispatch({ type: value ? 'START_RESET' : 'FINISH_RESET' })
        }}
      >
        <TerminalGrid
          ref={terminalContainerRef}
          layout={layout}
          onEmptyPanelAction={(action) => {
            switch (action) {
              case 'claude':
                addTab({ aiAgent: 'claude' });
                break;
              case 'bash':
                addTab({ aiAgent: 'none', tabName: 'Bash' });
                break;
              case 'advanced':
                dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                break;
            }
          }}
          onTerminalReorder={reorderTabs}
          renderControlButtons={renderControlButtons}
        />
      </TerminalGridProvider>

      {/* Session Launcher Modal */}
      <SessionLauncher
        isOpen={showSessionLauncher}
        onClose={() => dispatch({ type: 'HIDE_SESSION_LAUNCHER' })}
        onLaunch={(options) => {
          addTab(options);
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
            forceCloseTab(confirmClose.dbSessionId);
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