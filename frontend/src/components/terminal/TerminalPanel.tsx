import { useState, forwardRef, useImperativeHandle, useRef, useEffect, useReducer } from 'react';
import { useToast } from '@shelltender/client';
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
import { useTabManager, type TabAction } from './useTabManager';
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
  
  // Use tab manager for all tab operations
  const {
    tabs,
    activeTabId,
    confirmClose,
    modifyTab,
    cancelCloseConfirmation
  } = useTabManager({
    task,
    terminals,
    terminalService,
    sessionStatuses,
    realtimeSessionStates,
    onTabsChange: () => setShouldForceRefresh(prev => prev + 1)
  });
  
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
  
  // Focus terminal when tab is selected
  useEffect(() => {
    if (activeTabId) {
      terminalStore.updateTerminal(task.id, activeTabId, {
        type: 'set-focus',
        focus: true
      });
      // Focus the terminal after switching
      setTimeout(() => {
        const terminalRef = terminalRefs.current.get(activeTabId);
        terminalRef?.focus();
      }, 100);
    }
  }, [activeTabId, task.id, terminalStore]);

  // Expose methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      // Focus the active terminal
      const activeTerminal = terminals.find(t => t.normalizedId === activeTabId);
      const activeRef = activeTerminal ? terminalRefs.current.get(activeTerminal.dbSessionId) : undefined;
      activeRef?.focus();
    },
    switchToTab: (dbSessionId: string) => {
      // Check if the tab exists
      const tab = terminals.find(t => t.dbSessionId === dbSessionId);
      if (tab) {
        const normalizedId = terminal.normalizedId;
        handleTabSelect(normalizedId);
      }
    }
  }), [activeTabId, terminals, handleTabSelect]);
  
  const handleRefreshSession = async () => {
    dispatch({ type: 'START_RESET' });
    try {
      const result = await terminalRefreshService.refreshSession({
        taskId: task.id,
        activeTerminalId: activeTabId,
        terminals,
        terminalRefs: terminalRefs.current,
        sessionStatuses,
        task
      });
      
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
      const success = await terminalRefreshService.reconnectSession(
        dbSessionId,
        terminals,
        terminalRefs.current,
        task
      );
      
      if (!success) {
        const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
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
    handleTabAdd,
    handleTabClose,
    handleTabSelect,
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
              onTabSelect={(tabId) => modifyTab({ type: 'select', tabId })}
              onTabAdd={() => modifyTab({ type: 'add' })}
              onTabAdvancedAdd={() => dispatch({ type: 'SHOW_SESSION_LAUNCHER' })}
              onTabRename={(dbSessionId, newName) => modifyTab({ type: 'rename', dbSessionId, newName })}
              onTabClose={(dbSessionId) => modifyTab({ type: 'close', dbSessionId })}
              onTabReorder={(tabs) => modifyTab({ type: 'reorder', tabs })}
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
                modifyTab({ type: 'add', options: { aiAgent: 'claude' } });
                break;
              case 'bash':
                modifyTab({ type: 'add', options: { aiAgent: 'none', tabName: 'Bash' } });
                break;
              case 'advanced':
                dispatch({ type: 'SHOW_SESSION_LAUNCHER' });
                break;
            }
          }}
          onTerminalReorder={(tabs) => modifyTab({ type: 'reorder', tabs })}
          renderControlButtons={renderControlButtons}
        />
      </TerminalGridProvider>

      {/* Session Launcher Modal */}
      <SessionLauncher
        isOpen={showSessionLauncher}
        onClose={() => dispatch({ type: 'HIDE_SESSION_LAUNCHER' })}
        onLaunch={(options) => {
          modifyTab({ type: 'add', options });
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
            modifyTab({ type: 'forceClose', dbSessionId: confirmClose.dbSessionId });
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