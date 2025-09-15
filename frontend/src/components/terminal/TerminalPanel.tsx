import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { useToast } from '@shelltender/client';
import { findTerminalById } from '../../utils/terminal-utils';
import type { Task } from '../../types/task';
import type { DirectTerminalHandle } from './DirectTerminal';
import { TerminalTabs } from './TerminalTabs';
import { SessionLauncher } from './SessionLauncher';
import { useService } from '../../services';
import { useTerminalTabs } from '../../features/terminal-tabs';
import { useWorkerStatus } from '../../hooks/useWorkerStatus';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { useSplitViewStore, useSplitLayout, saveLayout } from '../../stores/splitViewStore';
import { useTerminalStore, useTaskTerminals, useFocusedTerminalId } from '../../stores/terminal/terminalStore.deep';
import { useShortcutContext } from '../../hooks/keyboard';
import { useTerminalKeyboardShortcuts } from './useTerminalKeyboardShortcuts';
import { TerminalGrid } from './TerminalGrid';
import { TerminalGridProvider } from './TerminalGridContext';
import { useSplitView } from '../../features/split-view';
import { useTerminalStatus } from './useTerminalStatus';
import { ControlButtons } from './ControlButtons';
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
  
  // Simple UI state (replaced reducer with useState for clarity)
  const [isResetting, setIsResetting] = useState(false);
  const [showSessionLauncher, setShowSessionLauncher] = useState(false);
  const [sessionStatuses, setSessionStatuses] = useState<Map<string, 'connected' | 'disconnected' | 'error'>>(new Map());
  
  const terminalRefs = useRef<Map<string, DirectTerminalHandle>>(new Map());
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  
  // Get real-time session states from WebSocket
  const { sessionStates: realtimeSessionStates } = useWorkerStatus(task.id);
  
  
  // Use split view feature for layout management
  const splitView = useSplitView({
    taskId: task.id,
    projectId: task.project_id,
    terminals,
    activeTabId,
    containerRef: terminalContainerRef,
    isVisible
  });
  
  const { canShowQuad, canShowHorizontal, canShowVertical } = splitView.constraints;
  
  // Split view state
  const layout = useSplitLayout();
  const { updateLayout, setCurrentTask } = useSplitViewStore();
  
  // Layout constraints hook handles auto-downgrade logic internally
  
  // Get terminals from the store (single source of truth)
  const terminals = useTaskTerminals(task.id);
  const focusedTerminalId = useFocusedTerminalId(task.id);
  const terminalStore = useTerminalStore();
  
  // Activate terminal keyboard context only when visible (priority 10 for feature-level)
  useShortcutContext('terminal', { enabled: isVisible, priority: 10 });
  
  // Set current task for split view on mount
  useEffect(() => {
    if (task.project_id) {
      setCurrentTask(task.id, task.project_id);
    }
  }, [task.id, task.project_id, setCurrentTask]);
  
  // Note: Terminal store initialization happens at task load level (TaskWorkspace/StandaloneTerminal)
  // This component only reads from the store, maintaining clear data flow
  
  // Use consolidated terminal tabs feature
  const terminalTabs = useTerminalTabs({
    task,
    terminals,
    terminalService,
    sessionStatuses,
    terminalRefs,
    realtimeSessionStates,
    callbacks: {
      showNotification,
      dispatch: (action: { type: string; dbSessionId?: string; status?: 'connected' | 'disconnected' | 'error' }) => {
        // Map legacy dispatch calls to new state setters
        switch (action.type) {
          case 'START_RESET':
            setIsResetting(true);
            break;
          case 'FINISH_RESET':
            setIsResetting(false);
            break;
          case 'SHOW_SESSION_LAUNCHER':
            setShowSessionLauncher(true);
            break;
          case 'HIDE_SESSION_LAUNCHER':
            setShowSessionLauncher(false);
            break;
          case 'UPDATE_SESSION_STATUS':
            setSessionStatuses(prev => {
              const next = new Map(prev);
              next.set(action.dbSessionId, action.status);
              return next;
            });
            break;
        }
      },
      reloadTask: task.onReload || (() => Promise.resolve())
    }
  });
  
  // Destructure for easier access
  const { tabs, activeTabId, confirmClose } = terminalTabs.state;
  const { selectTab, addTab, closeTab, updateTab, reorderTabs, cancelCloseConfirmation, refreshActiveTab, reconnectTab, switchToTab } = terminalTabs;
  
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
    switchToTab
  }), [activeTabId, terminals, switchToTab]);
  
  const handleRefreshSession = refreshActiveTab;


  // Show notification using Shelltender's toast system
  const showNotification = (type: 'success' | 'error' | 'warning', message: string) => {
    // showToast expects (message: string, duration?: number)
    // For now, ignore the type parameter as the toast library doesn't support variants
    showToast(message, 5000);
  };
  

  // Handle session reconnection
  const handleReconnectSession = reconnectTab;

  // Use terminal status hook for session management
  const { handleSessionStatus } = useTerminalStatus({
    terminals,
    sessionStatuses,
    getNormalizedId: (terminal) => terminal.normalizedId,
    dispatch: (action: { type: string; dbSessionId?: string; status?: 'connected' | 'disconnected' | 'error' }) => {
      // Map dispatch calls for useTerminalStatus
      if (action.type === 'UPDATE_SESSION_STATUS' && action.dbSessionId && action.status) {
        setSessionStatuses(prev => {
          const next = new Map(prev);
          next.set(action.dbSessionId, action.status);
          return next;
        });
      }
    },
    showNotification,
    handleReconnectSession
  });


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
              onTabAdvancedAdd={() => setShowSessionLauncher(true)}
              onTabRename={(dbSessionId, newName) => updateTab(dbSessionId, { name: newName })}
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
            value ? setIsResetting(true) : setIsResetting(false)
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
                setShowSessionLauncher(true);
                break;
            }
          }}
        />
      </TerminalGridProvider>

      {/* Session Launcher Modal */}
      <SessionLauncher
        isOpen={showSessionLauncher}
        onClose={() => setShowSessionLauncher(false)}
        onLaunch={(options) => {
          addTab(options);
          setShowSessionLauncher(false);
        }}
        taskPath={task.worktree_path}
      />
      
      {/* Confirm Close Dialog */}
      <ConfirmDialog
        isOpen={!!confirmClose}
        onClose={cancelCloseConfirmation}
        onConfirm={() => {
          if (confirmClose) {
            closeTab(confirmClose.dbSessionId, { force: true });
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