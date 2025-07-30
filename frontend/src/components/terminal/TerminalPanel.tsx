import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Eye, RefreshCw, ExternalLink, Monitor, Square, Columns, Rows, Grid2x2 } from 'lucide-react';
import { useToast } from '@shelltender/client';
import type { Task, TerminalSession } from '../../types/task';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { TerminalTabs, type Tab } from './TerminalTabs';
import { SessionLauncher, type SessionOptions } from './SessionLauncher';
import { api } from '../../services/api';
import { useTaskStatus } from '../../hooks/useTaskStatus';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SplitViewContainer } from './SplitViewContainer';
import { loadLayout, persistLayout, useSplitViewStore, useSplitLayout } from '../../stores/splitViewStore';
import { useTerminalStore, useTaskTerminals, useActiveTerminalId, useFocusedTerminalId } from '../../stores/terminalStore';
import { useShortcutContext } from '../../hooks/keyboard';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';

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
}

const TerminalPanelComponent = forwardRef<TerminalPanelHandle, TerminalPanelProps>((props, ref) => {
  const {
    task,
    validationMode,
    onToggleValidation,
    onToggleSidebar,
    isVisible = true
  } = props;
  const [isResetting, setIsResetting] = useState(false);
  const [activeTabId, setActiveTabId] = useState(() => {
    // Check if there's a focus request first
    const focusTabKey = `focus-tab-${task.id}`;
    const focusTabId = sessionStorage.getItem(focusTabKey);
    if (focusTabId) return focusTabId;
    
    // Otherwise use saved preference
    return localStorage.getItem(`activeTab-${task.id}`) || '';
  });
  const [showSessionLauncher, setShowSessionLauncher] = useState(false);
  const [sessionStatuses, setSessionStatuses] = useState<Map<string, 'connected' | 'disconnected' | 'error'>>(new Map());
  const [launchingClaude, setLaunchingClaude] = useState<Set<string>>(new Set());
  const terminalRefs = useRef<Map<string, DirectTerminalHandle>>(new Map());
  const { showToast } = useToast();
  const [confirmClose, setConfirmClose] = useState<{ dbSessionId: string; tabName: string } | null>(null);
  
  // Get real-time session states from WebSocket
  const { sessionStates: realtimeSessionStates } = useTaskStatus(task.id);
  
  // Feature flag for split view
  const splitViewEnabled = import.meta.env.VITE_FEATURE_SPLIT_VIEW === 'true';
  
  // Viewport constraints for split views
  const [canShowQuad, setCanShowQuad] = useState(false);
  const [canShowHorizontal, setCanShowHorizontal] = useState(false);
  const [canShowVertical, setCanShowVertical] = useState(false);
  
  useEffect(() => {
    const checkViewport = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Quad view needs large screen (1400x800)
      setCanShowQuad(width >= 1400 && height >= 800);
      
      // Horizontal split (top/bottom) needs sufficient height
      setCanShowHorizontal(height >= 600);
      
      // Vertical split (side by side) needs sufficient width
      setCanShowVertical(width >= 1000);
    };
    
    checkViewport();
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);
  
  // Auto-downgrade layout if viewport becomes too small
  useEffect(() => {
    // If in quad view but screen too small, downgrade
    if (layout.mode === 'split-4' && !canShowQuad) {
      // Try horizontal split first, then vertical, then tab
      if (canShowHorizontal) {
        updateLayout(task.id, { mode: 'split', orientation: 'horizontal' });
      } else if (canShowVertical) {
        updateLayout(task.id, { mode: 'split', orientation: 'vertical' });
      } else {
        updateLayout(task.id, { mode: 'tab' });
      }
    }
    // If in horizontal split but screen too short, switch to vertical or tab
    else if (layout.mode === 'split' && layout.orientation === 'horizontal' && !canShowHorizontal) {
      if (canShowVertical) {
        updateLayout(task.id, { orientation: 'vertical' });
      } else {
        updateLayout(task.id, { mode: 'tab' });
      }
    }
    // If in vertical split but screen too narrow, switch to horizontal or tab
    else if (layout.mode === 'split' && layout.orientation === 'vertical' && !canShowVertical) {
      if (canShowHorizontal) {
        updateLayout(task.id, { orientation: 'horizontal' });
      } else {
        updateLayout(task.id, { mode: 'tab' });
      }
    }
  }, [layout.mode, layout.orientation, canShowQuad, canShowHorizontal, canShowVertical, task.id, updateLayout]);
  
  // Split view state
  const layout = useSplitLayout(task.id);
  const { toggleSplitMode, updateLayout } = useSplitViewStore();
  
  // Load split layout on mount
  useEffect(() => {
    if (splitViewEnabled && task.project_id) {
      loadLayout(task.id, task.project_id);
    }
  }, [task.id, task.project_id, splitViewEnabled]);

  // Get terminals from the store
  const terminals = useTaskTerminals(task.id);
  const activeTerminalId = useActiveTerminalId(task.id);
  const focusedTerminalId = useFocusedTerminalId(task.id);
  const { setTerminals, setActiveTerminal, addTerminal, removeTerminal, updateTerminal, setFocusedTerminal } = useTerminalStore();
  
  // Activate terminal keyboard context only when visible (priority 10 for feature-level)
  useShortcutContext('terminal', { enabled: isVisible, priority: 10 });
  
  // Initialize terminals from task prop on mount or when task changes
  useEffect(() => {
    if (task.terminals && task.terminals.length > 0) {
      setTerminals(task.id, task.terminals);
      // Set initial focus to active terminal if no focus set
      if (!focusedTerminalId && activeTabId) {
        setFocusedTerminal(task.id, activeTabId);
      }
    }
  }, [task.id, task.terminals, setTerminals, focusedTerminalId, activeTabId, setFocusedTerminal]);
  
  // Simple effect - just validate the saved tab exists
  useEffect(() => {
    if (terminals.length > 0) {
      const savedId = localStorage.getItem(`activeTab-${task.id}`);
      const validTab = terminals.find(t => t.dbSessionId === savedId);
      
      if (!validTab && terminals[0]) {
        setActiveTabId(terminals[0].dbSessionId);
        // Don't set focus here - let the initial terminals effect handle it
      }
    }
  }, [task.id, terminals]);

  // Check for focus tab request
  useEffect(() => {
    const focusTabKey = `focus-tab-${task.id}`;
    const focusTabId = sessionStorage.getItem(focusTabKey);
    
    if (focusTabId && terminals.length > 0) {
      const tabToFocus = terminals.find(t => t.dbSessionId === focusTabId);
      if (tabToFocus) {
        setActiveTabId(focusTabId);
        setActiveTerminal(task.id, focusTabId);
        localStorage.setItem(`activeTab-${task.id}`, focusTabId);
        // Clean up after using
        sessionStorage.removeItem(focusTabKey);
      }
    }
  }, [task.id, terminals, setActiveTerminal]);

  // Save when active tab changes
  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    setActiveTerminal(task.id, tabId);
    setFocusedTerminal(task.id, tabId);
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
      const activeRef = terminalRefs.current.get(activeTabId);
      activeRef?.focus();
    },
    switchToTab: (dbSessionId: string) => {
      // Check if the tab exists
      const tab = terminals.find(t => t.dbSessionId === dbSessionId);
      if (tab) {
        handleTabSelect(dbSessionId);
      }
    }
  }), [activeTabId, terminals, handleTabSelect]);
  
  const handleResetSession = async () => {
    setIsResetting(true);
    try {
      // If any session is disconnected, try to reconnect it
      const disconnectedSession = Array.from(sessionStatuses.entries())
        .find(([_, status]) => status === 'disconnected' || status === 'error');
      
      if (disconnectedSession) {
        const [dbSessionId] = disconnectedSession;
        await handleReconnectSession(dbSessionId);
        showNotification('success', 'Attempting to reconnect session...');
      } else {
        // TODO: Implement actual session reset
        showNotification('warning', 'Session reset not yet implemented');
      }
    } catch (error) {
      showNotification('error', 'Failed to reset session');
    } finally {
      setTimeout(() => setIsResetting(false), 1000);
    }
  };


  const handleTabAdd = async (options?: SessionOptions) => {
    try {
      const tabCount = task.terminals?.length || 0;
      
      // Get the currently active terminal to copy history from
      const activeTerminal = task.terminals?.find(t => t.dbSessionId === activeTabId);
      
      // Use provided options or generate next available "Tab #"
      const aiAgent = options?.aiAgent || 'claude';
      const tabName = options?.tabName || getNextAvailableTabName(task.terminals || []);
      
      const newSession = await api.createTerminalSession(task.id, {
        tabName,
        aiAgent,
        copyHistoryFrom: activeTerminal?.sessionId || null
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
      
      // Just update the active tab - backend has already added it to the database
      setActiveTabId(newSession.dbSessionId);
      localStorage.setItem(`activeTab-${task.id}`, newSession.dbSessionId);
      
      // Reload task to get updated terminals list
      if (task.onReload) {
        task.onReload();
      }
      
      // Only auto-launch Claude if no options provided (quick launch)
      if (!options) {
      // Wait for terminal to be ready and prompt to appear, then launch Claude
      setTimeout(async () => {
        try {
          
          // First send a newline to ensure prompt is visible
          // COMMENTED OUT - DirectTerminal already sends a newline
          // await api.executeCommand(newSession.shelltenderSessionId, '');
          
          // Small delay then send claude command
          setTimeout(async () => {
            await api.executeCommand(newSession.shelltenderSessionId, 'claude');
          }, 500);
        } catch (error) {
          console.error('[TerminalPanel] Failed to auto-launch Claude:', error);
        }
      }, 500); // Quick delay to ensure terminal connection is established
      } else {
        // Advanced launch with options
        
        // Mark as launching if we have a prompt or need to change directory
        if (options.workingDirectory || options.initialPrompt) {
          setLaunchingClaude(prev => new Set(prev).add(newSession.dbSessionId));
          
          setTimeout(async () => {
            try {
              let commands: string[] = [];
              
              // Change directory if specified
              if (options.workingDirectory) {
                // Make path relative to task path
                const fullPath = options.workingDirectory.startsWith('/') 
                  ? options.workingDirectory 
                  : `${task.worktree_path}/${options.workingDirectory}`;
                commands.push(`cd ${fullPath}`);
              }
              
              // Launch AI with or without prompt
              const aiCommand = getAiCommand(aiAgent);
              if (options.initialPrompt) {
                // Properly escape the prompt for shell
                const escapedPrompt = options.initialPrompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
                
                // Different syntax for different agents
                switch (aiAgent) {
                  case 'aider':
                    commands.push(`${aiCommand} --message "${escapedPrompt}"`);
                    break;
                  case 'claude':
                  case 'codex':
                    commands.push(`${aiCommand} "${escapedPrompt}"`);
                    break;
                  case 'gemini':
                    // Use -p flag for prompt
                    commands.push(`${aiCommand} -p "${escapedPrompt}"`);
                    break;
                  default:
                    commands.push(`${aiCommand} "${escapedPrompt}"`);
                }
              } else {
                commands.push(aiCommand);
              }
              
              // Execute commands in sequence
              for (const command of commands) {
                await api.executeCommand(newSession.shelltenderSessionId, command);
                // Minimal delay between commands
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              
              // Remove launching state
              setTimeout(() => {
                setLaunchingClaude(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(newSession.dbSessionId);
                  return newSet;
                });
              }, 1000);
            } catch (error) {
              console.error('[TerminalPanel] Failed to execute advanced launch:', error);
              setLaunchingClaude(prev => {
                const newSet = new Set(prev);
                newSet.delete(newSession.dbSessionId);
                return newSet;
              });
            }
          }, 500); // Quick delay to ensure terminal connection is established
        }
      }
    } catch (error) {
      console.error('[TerminalPanel] Failed to create new terminal:', error);
    }
  };

  // Helper function to get AI command from agent name
  const getAiCommand = (agent: string): string => {
    const commands: Record<string, string> = {
      claude: 'claude',
      aider: 'aider',
      codex: 'codex',
      gemini: 'gemini'
    };
    return commands[agent] || 'claude';
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
      updateTerminal(task.id, terminal.dbSessionId, { tabName: newName });
      
      // Update via API
      await api.updateTerminalTab(dbSessionId, {
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
        updateTerminal(task.id, terminal.dbSessionId, { tabName: currentName });
      }
      showNotification('error', 'Failed to rename tab');
    }
  };

  // Handle tab reorder
  const handleTabReorder = async (reorderedTabs: Tab[]) => {
    try {
      // Update each tab's order in the backend
      const updatePromises = reorderedTabs.map(tab => 
        api.updateTerminalTab(tab.dbSessionId, {
          tabOrder: tab.tabOrder
        })
      );
      
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
    // Update status map
    setSessionStatuses(prev => {
      const newMap = new Map(prev);
      newMap.set(dbSessionId, status);
      return newMap;
    });

    const terminal = task.terminals?.find(t => t.dbSessionId === dbSessionId);
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
    const terminalToClose = task.terminals?.find(t => t.dbSessionId === dbSessionId);
    if (!terminalToClose) return;
    
    // Get the real-time state for this session
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
    try {
      // Find the terminal being closed
      const terminalToClose = task.terminals?.find(t => t.dbSessionId === dbSessionId);
      if (!terminalToClose) return;
      
      // Store next tab id if we need to switch
      let nextTabId: string | null = null;
      
      // If closing the active tab, determine which tab to switch to
      if (dbSessionId === activeTabId) {
        const remainingTabs = task.terminals?.filter(t => t.dbSessionId !== dbSessionId) || [];
        if (remainingTabs.length > 0) {
          // Find the next tab
          const nextTab = remainingTabs.sort((a, b) => a.tabOrder - b.tabOrder)[0];
          nextTabId = nextTab.dbSessionId;
        }
      }
      
      // Delete the terminal session
      await api.deleteTerminalSession(dbSessionId);
      
      // Reload task to get updated terminals list
      if (task.onReload) {
        await task.onReload();
      }
      
      // Now trigger tab selection after reload completes
      if (nextTabId) {
        // Use handleTabSelect to trigger the same flow as clicking a tab
        handleTabSelect(nextTabId);
      }
      
      // Skip the success notification to avoid terminal re-render issues
      // The tab closing is already visually apparent to the user
    } catch (error) {
      console.error('[TerminalPanel] Failed to close tab:', error);
      showNotification('error', 'Failed to close tab');
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
      {/* Split View Toggle - show if split view enabled (allow with 1+ terminals) */}
      {splitViewEnabled && terminals.length >= 1 && (
        <button 
          onClick={() => {
            if (layout.mode === 'tab') {
              // Switch to vertical split if allowed, otherwise horizontal, otherwise stay in tab
              if (canShowVertical) {
                updateLayout(task.id, { mode: 'split', orientation: 'vertical' });
                // Ensure focus remains on the active terminal
                if (activeTabId && !focusedTerminalId) {
                  setFocusedTerminal(task.id, activeTabId);
                }
              } else if (canShowHorizontal) {
                updateLayout(task.id, { mode: 'split', orientation: 'horizontal' });
                if (activeTabId && !focusedTerminalId) {
                  setFocusedTerminal(task.id, activeTabId);
                }
              }
              // If neither split view is possible, stay in tab mode
            } else if (layout.mode === 'split' && layout.orientation === 'vertical') {
              // Switch to horizontal split if allowed, otherwise quad if allowed, otherwise tab
              if (canShowHorizontal) {
                updateLayout(task.id, { orientation: 'horizontal' });
              } else if (canShowQuad) {
                updateLayout(task.id, { mode: 'split-4' });
              } else {
                updateLayout(task.id, { mode: 'tab' });
              }
            } else if (layout.mode === 'split' && layout.orientation === 'horizontal') {
              // Switch to quad view if allowed, otherwise back to tab
              if (canShowQuad) {
                updateLayout(task.id, { mode: 'split-4' });
              } else {
                updateLayout(task.id, { mode: 'tab' });
              }
            } else {
              // From quad view, always go back to tab mode
              updateLayout(task.id, { mode: 'tab' });
            }
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
      )}
      <button 
        onClick={onToggleSidebar}
        className="text-gray-400 hover:text-gray-200 p-1"
        title="Toggle sidebar"
      >
        <Eye className="w-4 h-4" />
      </button>
      <button 
        onClick={handleResetSession}
        className={`p-1 transition-colors ${
          isResetting 
            ? 'text-blue-400 animate-spin' 
            : Array.from(sessionStatuses.values()).some(s => s === 'disconnected' || s === 'error')
            ? 'text-orange-400 hover:text-orange-300'
            : 'text-gray-400 hover:text-gray-200'
        }`}
        disabled={isResetting}
        title={Array.from(sessionStatuses.values()).some(s => s === 'disconnected' || s === 'error') 
          ? "Reconnect disconnected sessions" 
          : "Reset session to original state"}
      >
        <RefreshCw className="w-4 h-4" />
      </button>
      <button 
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
    const connectionStatus = sessionStatuses.get(t.dbSessionId) || 'connected';
    
    // Use real-time AI state if available, otherwise fall back to initial state
    const realtimeState = realtimeSessionStates?.find(s => s.id === t.dbSessionId);
    const currentAiState = realtimeState?.aiState || t.aiState;
    
    
    return {
      sessionId: t.sessionId,
      dbSessionId: t.dbSessionId,
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
          if (terminals.length < 6) {
            handleTabAdd();
          }
          break;
        case 'terminal-close-tab':
          if (activeTabId && terminals.length > 1) {
            handleTabClose(activeTabId);
          }
          break;
        case 'terminal-next-tab':
          {
            const currentIndex = terminals.findIndex(t => t.dbSessionId === activeTabId);
            const nextIndex = (currentIndex + 1) % terminals.length;
            if (terminals[nextIndex]) {
              handleTabSelect(terminals[nextIndex].dbSessionId);
            }
          }
          break;
        case 'terminal-previous-tab':
          {
            const currentIndex = terminals.findIndex(t => t.dbSessionId === activeTabId);
            const prevIndex = currentIndex === 0 ? terminals.length - 1 : currentIndex - 1;
            if (terminals[prevIndex]) {
              handleTabSelect(terminals[prevIndex].dbSessionId);
            }
          }
          break;
        case 'terminal-switch-tab':
          {
            const detail = (event as CustomEvent).detail;
            if (detail && typeof detail.index === 'number' && terminals[detail.index]) {
              handleTabSelect(terminals[detail.index].dbSessionId);
            }
          }
          break;
        case 'terminal-toggle-split':
          if (splitViewEnabled) {
            if (layout.mode === 'tab') {
              // Switch to vertical split if allowed, otherwise horizontal, otherwise stay in tab
              if (canShowVertical) {
                updateLayout(task.id, { mode: 'split', orientation: 'vertical' });
              } else if (canShowHorizontal) {
                updateLayout(task.id, { mode: 'split', orientation: 'horizontal' });
              }
              // If neither split view is possible, stay in tab mode
            } else if (layout.mode === 'split' && layout.orientation === 'vertical') {
              // Switch to horizontal split if allowed, otherwise quad if allowed, otherwise tab
              if (canShowHorizontal) {
                updateLayout(task.id, { orientation: 'horizontal' });
              } else if (canShowQuad) {
                updateLayout(task.id, { mode: 'split-4' });
              } else {
                updateLayout(task.id, { mode: 'tab' });
              }
            } else if (layout.mode === 'split' && layout.orientation === 'horizontal') {
              // Switch to quad view if allowed, otherwise back to tab
              if (canShowQuad) {
                updateLayout(task.id, { mode: 'split-4' });
              } else {
                updateLayout(task.id, { mode: 'tab' });
              }
            } else {
              // From quad view, always go back to tab mode
              updateLayout(task.id, { mode: 'tab' });
            }
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

    return () => {
      // Remove event listeners
      document.removeEventListener('terminal-new-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-close-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-next-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-previous-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-switch-tab', handleTerminalShortcut as EventListener);
      document.removeEventListener('terminal-toggle-split', handleTerminalShortcut as EventListener);
    };
  }, [terminals, activeTabId, splitViewEnabled, layout.mode, layout.orientation, task.id, toggleSplitMode, updateLayout, canShowVertical, canShowHorizontal, canShowQuad]);



  return (
    <div 
      className="bg-gray-900 flex flex-col"
      style={{ height: validationMode ? '60%' : '100%' }}
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
              onTabAdvancedAdd={() => setShowSessionLauncher(true)}
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

      {/* Terminal Content - Split view or single terminal */}
      <div className="flex-1 bg-gray-900 relative overflow-hidden min-h-0">
        {splitViewEnabled && (layout.mode === 'split' || layout.mode === 'split-4') ? (
          <SplitViewContainer
            taskId={task.id}
            projectId={task.project_id}
            worktreePath={task.worktree_path}
            isVisible={isVisible}
            onSessionStatus={handleSessionStatus}
            activeTabId={activeTabId}
            controlButtons={renderControlButtons()}
          />
        ) : (
          // Tab mode - show single terminal
          (() => {
            const activeTerminal = terminals.find(t => t.dbSessionId === activeTabId);
            if (!activeTerminal) return null;
            
            return (
              <DirectTerminal
                key={activeTerminal.dbSessionId}
                ref={(el) => {
                  if (el) {
                    terminalRefs.current.set(activeTerminal.dbSessionId, el);
                  } else {
                    terminalRefs.current.delete(activeTerminal.dbSessionId);
                  }
                }}
                taskId={task.id}
                dbSessionId={activeTerminal.dbSessionId}
                shelltenderSessionId={activeTerminal.shelltenderSessionId || activeTerminal.sessionId}
                worktreePath={task.worktree_path}
                isVisible={isVisible}
                hasFocus={focusedTerminalId === activeTerminal.dbSessionId}
                onSessionStatus={(status) => handleSessionStatus(activeTerminal.dbSessionId, status)}
                onFocusRequest={() => {
                  setFocusedTerminal(task.id, activeTerminal.dbSessionId);
                }}
              />
            );
          })()
        )}
      </div>

      {/* Session Launcher Modal */}
      <SessionLauncher
        isOpen={showSessionLauncher}
        onClose={() => setShowSessionLauncher(false)}
        onLaunch={(options) => {
          handleTabAdd(options);
          setShowSessionLauncher(false);
        }}
        taskPath={task.worktree_path}
      />
      
      {/* Confirm Close Dialog */}
      <ConfirmDialog
        isOpen={!!confirmClose}
        onClose={() => setConfirmClose(null)}
        onConfirm={() => {
          if (confirmClose) {
            performTabClose(confirmClose.dbSessionId);
            setConfirmClose(null);
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
});

TerminalPanelComponent.displayName = 'TerminalPanel';

export const TerminalPanel = TerminalPanelComponent;