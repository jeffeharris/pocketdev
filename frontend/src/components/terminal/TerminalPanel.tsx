import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Eye, EyeOff, RefreshCw, ExternalLink, Monitor, Square, Columns, Rows, Grid2x2 } from 'lucide-react';
import { useToast } from '@shelltender/client';
import type { Task, TerminalSession } from '../../types/task';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { TerminalTabs, type Tab } from './TerminalTabs';
import { SessionLauncher, type SessionOptions } from './SessionLauncher';
import { api } from '../../services/api';
import { useTaskStatus } from '../../hooks/useTaskStatus';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { SplitViewContainer } from './SplitViewContainer';
import { useSplitViewStore, useSplitLayout, saveLayout } from '../../stores/splitViewStore';
import { useTerminalStore, useTaskTerminals, useActiveTerminalId, useFocusedTerminalId } from '../../stores/terminalStore';
import { useShortcutContext } from '../../hooks/keyboard';
import { useKeyboardShortcut } from '../../hooks/useKeyboardShortcut';
import { ThrottledTerminal } from './ThrottledTerminal';
import type { SplitLayoutConfig } from '../../stores/splitViewStore';
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
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();
  const [confirmClose, setConfirmClose] = useState<{ dbSessionId: string; tabName: string } | null>(null);
  
  // Get real-time session states from WebSocket
  const { sessionStates: realtimeSessionStates } = useTaskStatus(task.id);
  
  
  // Viewport constraints for split views
  const [canShowQuad, setCanShowQuad] = useState(false);
  const [canShowHorizontal, setCanShowHorizontal] = useState(false);
  const [canShowVertical, setCanShowVertical] = useState(false);
  
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
      setCanShowQuad(width >= 1400 && effectiveHeight >= minHeightForHorizontalSplits);
      
      // Horizontal split needs sufficient terminal height (same as quad)
      setCanShowHorizontal(effectiveHeight >= minHeightForHorizontalSplits);
      
      // Vertical split only depends on width - works with any height
      setCanShowVertical(width >= 1000);
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
  
  const handleRefreshSession = async () => {
    setIsResetting(true);
    try {
      // Tab mode - use the normal logic
      const activeTerminal = terminals.find(t => t.dbSessionId === activeTabId);
      if (!activeTerminal) {
        showNotification('warning', 'No active terminal to refresh');
        return;
      }

      // Check if session is disconnected
      const sessionStatus = sessionStatuses.get(activeTabId);
      const isDisconnected = sessionStatus === 'disconnected' || sessionStatus === 'error';
      
      // Get the terminal ref for the active terminal
      const terminalRef = terminalRefs.current.get(activeTabId);
      
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
      setTimeout(() => setIsResetting(false), 1000);
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
      const activeTerminal = terminals.find(t => t.dbSessionId === activeTabId);
      
      // Use provided options or generate next available "Tab #"
      const aiAgent = options?.aiAgent || 'claude';
      const tabName = options?.tabName || getNextAvailableTabName(terminals);
      
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

    const terminal = terminals.find(t => t.dbSessionId === dbSessionId);
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
      const terminalToClose = terminals.find(t => t.dbSessionId === dbSessionId);
      if (!terminalToClose) return;
      
      // Store next tab id if we need to switch
      let nextTabId: string | null = null;
      
      // If closing the active tab, determine which tab to switch to
      if (dbSessionId === activeTabId) {
        const remainingTabs = terminals.filter(t => t.dbSessionId !== dbSessionId);
        if (remainingTabs.length > 0) {
          // Find the next tab
          const nextTab = remainingTabs.sort((a, b) => a.tabOrder - b.tabOrder)[0];
          nextTabId = nextTab.dbSessionId;
        }
      }
      
      // Delete the terminal session
      await api.deleteTerminalSession(dbSessionId);
      
      // Clear confirm close state if it exists
      setConfirmClose(null);
      
      // Reload task to get updated terminals list
      if (task.onReload) {
        await task.onReload();
        
        // After reload completes, trigger tab selection if needed
        // Use a small timeout to ensure React has processed the state update
        if (nextTabId) {
          setTimeout(() => {
            // The handleTabSelect will verify the tab exists
            handleTabSelect(nextTabId);
          }, 50);
        }
      }
      
      // Skip the success notification to avoid terminal re-render issues
      // The tab closing is already visually apparent to the user
    } catch (error) {
      console.error('[TerminalPanel] Failed to close tab:', error);
      showNotification('error', 'Failed to close tab');
      // Clear confirm close state on error too
      setConfirmClose(null);
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
      {/* Split View Toggle - allow with 1+ terminals */}
      {terminals.length >= 1 && (
        <button 
          onClick={() => {
            if (layout.mode === 'tab') {
              // Switch to vertical split if allowed, otherwise horizontal, otherwise stay in tab
              if (canShowVertical) {
                updateLayout( { mode: 'split', orientation: 'vertical' });
                // Ensure focus remains on the active terminal
                if (activeTabId && !focusedTerminalId) {
                  setFocusedTerminal(task.id, activeTabId);
                }
              } else if (canShowHorizontal) {
                updateLayout( { mode: 'split', orientation: 'horizontal' });
                if (activeTabId && !focusedTerminalId) {
                  setFocusedTerminal(task.id, activeTabId);
                }
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
      )}
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
            const currentIndex = terminals.findIndex(t => t.dbSessionId === activeTabId);
            const nextIndex = (currentIndex + 1) % terminals.length;
            if (terminals[nextIndex]) {
              handleTabSelect(terminals[nextIndex].dbSessionId);
            }
          }
          break;
        case 'terminal-previous-tab':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          {
            const currentIndex = terminals.findIndex(t => t.dbSessionId === activeTabId);
            const prevIndex = currentIndex === 0 ? terminals.length - 1 : currentIndex - 1;
            if (terminals[prevIndex]) {
              handleTabSelect(terminals[prevIndex].dbSessionId);
            }
          }
          break;
        case 'terminal-switch-tab':
          // Only handle this event if this task is currently visible
          if (!isVisible) break;
          
          {
            const detail = (event as CustomEvent).detail;
            if (detail && typeof detail.index === 'number' && terminals[detail.index]) {
              handleTabSelect(terminals[detail.index].dbSessionId);
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
    switch (layout.mode) {
      case 'tab':
        return terminal.dbSessionId === activeTabId;
      case 'split':
        return terminal.dbSessionId === layout.primaryTerminalId ||
               terminal.dbSessionId === layout.secondaryTerminalId;
      case 'split-4':
        return terminal.dbSessionId === layout.primaryTerminalId ||
               terminal.dbSessionId === layout.secondaryTerminalId ||
               terminal.dbSessionId === layout.tertiaryTerminalId ||
               terminal.dbSessionId === layout.quaternaryTerminalId;
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
    
    // Assign grid positions for split modes
    if (terminal.dbSessionId === layout.primaryTerminalId) return 'terminal terminal-primary';
    if (terminal.dbSessionId === layout.secondaryTerminalId) return 'terminal terminal-secondary';
    if (terminal.dbSessionId === layout.tertiaryTerminalId) return 'terminal terminal-tertiary';
    if (terminal.dbSessionId === layout.quaternaryTerminalId) return 'terminal terminal-quaternary';
    
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

      {/* Terminal Content - All terminals rendered persistently */}
      <div ref={terminalContainerRef} className="flex-1 bg-gray-900 relative overflow-hidden min-h-0">
        {/* Render all terminals with CSS-based visibility */}
        <div className={`terminals-container mode-${layout.mode} ${layout.mode === 'split' ? `orientation-${layout.orientation}` : ''}`}>
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
                  hasFocus={focusedTerminalId === terminal.dbSessionId}
                  onSessionStatus={(status) => handleSessionStatus(terminal.dbSessionId, status)}
                  onFocusRequest={() => {
                    setFocusedTerminal(task.id, terminal.dbSessionId);
                  }}
                />
              </div>
            );
          })}
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
            setIsResetting={setIsResetting}
          />
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
}

const TerminalPanelWithRef = forwardRef<TerminalPanelHandle, TerminalPanelProps>(TerminalPanelComponent);
TerminalPanelWithRef.displayName = 'TerminalPanel';

export const TerminalPanel = TerminalPanelWithRef;