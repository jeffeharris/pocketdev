import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Eye, RefreshCw, ExternalLink, Monitor } from 'lucide-react';
import { useToast } from '@shelltender/client';
import type { Task, TerminalSession } from '../../types/task';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { TerminalTabs, type Tab } from './TerminalTabs';
import { SessionLauncher, type SessionOptions } from './SessionLauncher';
import { api } from '../../services/api';

export type TerminalPanelHandle = {
  focus: () => void;
};

interface TerminalPanelProps {
  task: Task;
  validationMode: boolean;
  onToggleValidation: () => void;
  onToggleSidebar: () => void;
  isVisible?: boolean;
}

const TerminalPanelComponent = forwardRef<TerminalPanelHandle, TerminalPanelProps>(({
  task,
  validationMode,
  onToggleValidation,
  onToggleSidebar,
  isVisible = true
}, ref) => {
  const [isResetting, setIsResetting] = useState(false);
  const [activeTabId, setActiveTabId] = useState(() => {
    return localStorage.getItem(`activeTab-${task.id}`) || '';
  });
  const [launchingClaude, setLaunchingClaude] = useState<Set<string>>(new Set());
  const [showSessionLauncher, setShowSessionLauncher] = useState(false);
  const [sessionStatuses, setSessionStatuses] = useState<Map<string, 'connected' | 'disconnected' | 'error'>>(new Map());
  const terminalRefs = useRef<Map<string, DirectTerminalHandle>>(new Map());
  const { showToast } = useToast();

  // Simple effect - just validate the saved tab exists
  useEffect(() => {
    if (task.terminals?.length > 0) {
      const savedId = localStorage.getItem(`activeTab-${task.id}`);
      const validTab = task.terminals.find(t => t.dbSessionId === savedId);
      
      if (!validTab && task.terminals[0]) {
        setActiveTabId(task.terminals[0].dbSessionId);
      }
    }
  }, [task.id, task.terminals]);

  // Save when active tab changes
  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    localStorage.setItem(`activeTab-${task.id}`, tabId);
    // Focus the terminal after switching
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(tabId);
      terminalRef?.focus();
    }, 100);
  };

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      // Focus the active terminal
      const activeRef = terminalRefs.current.get(activeTabId);
      activeRef?.focus();
    }
  }), [activeTabId]);
  
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
    console.log('[TerminalPanel] handleTabAdd called with options:', options);
    try {
      const tabCount = task.terminals?.length || 0;
      console.log('[TerminalPanel] Current tab count:', tabCount);
      
      // Get the currently active terminal to copy history from
      const activeTerminal = task.terminals?.find(t => t.dbSessionId === activeTabId);
      
      // Use provided options or defaults
      const tabName = options?.tabName || `Tab ${tabCount + 1}`;
      const aiAgent = options?.aiAgent || 'claude';
      
      console.log('[TerminalPanel] Creating new terminal session...');
      const newSession = await api.createTerminalSession(task.id, {
        tabName,
        aiAgent,
        copyHistoryFrom: activeTerminal?.sessionId || null
      });
      console.log('[TerminalPanel] New session created:', newSession);
      
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
        // Mark this session as launching Claude
        console.log('[TerminalPanel] Marking session for Claude launch:', newSession.dbSessionId);
        setLaunchingClaude(prev => new Set(prev).add(newSession.dbSessionId));
      
      // Wait for terminal to be ready and prompt to appear, then launch Claude
      console.log('[TerminalPanel] Setting timeout for Claude launch...');
      setTimeout(async () => {
        try {
          console.log('[TerminalPanel] Auto-launching Claude for new tab:', newSession.dbSessionId);
          
          // First send a newline to ensure prompt is visible
          console.log('[TerminalPanel] Sending newline to force prompt...');
          await api.executeCommand(newSession.shelltenderSessionId, '');
          
          // Small delay then send claude command
          setTimeout(async () => {
            console.log('[TerminalPanel] Sending claude command...');
            await api.executeCommand(newSession.shelltenderSessionId, 'claude');
            console.log('[TerminalPanel] Claude command sent successfully');
            
            // Remove from launching set after some time
            setTimeout(() => {
              console.log('[TerminalPanel] Removing launching state for:', newSession.dbSessionId);
              setLaunchingClaude(prev => {
                const newSet = new Set(prev);
                newSet.delete(newSession.dbSessionId);
                return newSet;
              });
            }, 3000);
          }, 500);
        } catch (error) {
          console.error('[TerminalPanel] Failed to auto-launch Claude:', error);
          // Remove from launching set on error
          setLaunchingClaude(prev => {
            const newSet = new Set(prev);
            newSet.delete(newSession.dbSessionId);
            return newSet;
          });
        }
      }, 3000); // Wait 3 seconds for terminal to be ready
      } else {
        // Advanced launch with options
        console.log('[TerminalPanel] Advanced launch with options:', options);
        
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
                commands.push(`${aiCommand} "${escapedPrompt}"`);
              } else {
                commands.push(aiCommand);
              }
              
              // Execute commands in sequence
              for (const command of commands) {
                console.log('[TerminalPanel] Executing command:', command);
                await api.executeCommand(newSession.shelltenderSessionId, command);
                // Small delay between commands
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              // Remove launching state
              setTimeout(() => {
                setLaunchingClaude(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(newSession.dbSessionId);
                  return newSet;
                });
              }, 3000);
            } catch (error) {
              console.error('[TerminalPanel] Failed to execute advanced launch:', error);
              setLaunchingClaude(prev => {
                const newSet = new Set(prev);
                newSet.delete(newSession.dbSessionId);
                return newSet;
              });
            }
          }, 3000); // Wait for terminal to be ready
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

  // Handle tab rename
  const handleTabRename = async (dbSessionId: string, newName: string) => {
    try {
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
      showNotification('error', 'Failed to rename tab');
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
      console.log(`[TerminalPanel] Session connected for ${terminal.tabName}`);
      // Clear any error state
      const prevStatus = sessionStatuses.get(dbSessionId);
      if (prevStatus === 'disconnected' || prevStatus === 'error') {
        showNotification('success', `Terminal "${terminal.tabName}" reconnected`);
      }
    }
  };

  // Handle session reconnection
  const handleReconnectSession = async (dbSessionId: string) => {
    const terminal = task.terminals?.find(t => t.dbSessionId === dbSessionId);
    if (!terminal) return;

    console.log(`[TerminalPanel] Attempting to reconnect session ${dbSessionId}`);
    
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
    showToast({
      title: message,
      variant: type === 'error' ? 'destructive' : type === 'warning' ? 'default' : 'default',
      duration: 5000
    });
  };

  // Convert terminals to Tab format for TerminalTabs component
  const tabs: Tab[] = (task.terminals || []).map(t => {
    const isLaunching = launchingClaude.has(t.dbSessionId);
    const connectionStatus = sessionStatuses.get(t.dbSessionId) || 'connected';
    console.log(`[TerminalPanel] Tab ${t.dbSessionId} - isLaunching: ${isLaunching}, aiState: ${t.aiState}, connectionStatus: ${connectionStatus}`);
    return {
      sessionId: t.sessionId,
      dbSessionId: t.dbSessionId,
      tabName: t.tabName,
      tabOrder: t.tabOrder,
      aiState: isLaunching ? 'working' : t.aiState,
      aiAgent: t.aiAgent,
      connectionStatus: connectionStatus
    };
  });


  return (
    <div 
      className="bg-gray-900 flex flex-col"
      style={{ height: validationMode ? '60%' : '100%' }}
    >
      {/* Terminal Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {/* Terminal Tabs */}
          <TerminalTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabSelect={handleTabSelect}
            onTabAdd={() => handleTabAdd()}
            onTabAdvancedAdd={() => setShowSessionLauncher(true)}
            onTabRename={handleTabRename}
            maxTabs={6}
          />

          {/* Control Buttons */}
          <div className="flex items-center gap-2 pr-4">
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
          </div>
        </div>
      </div>

      {/* Terminal Content - Show only active terminal */}
      <div className="flex-1 bg-gray-900 relative overflow-hidden min-h-0">
        {(task.terminals || []).map(terminal => (
          <DirectTerminal
            key={terminal.dbSessionId}
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
            isVisible={isVisible && terminal.dbSessionId === activeTabId}
            onSessionStatus={(status) => handleSessionStatus(terminal.dbSessionId, status)}
          />
        ))}
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
    </div>
  );
});

TerminalPanelComponent.displayName = 'TerminalPanel';

export const TerminalPanel = TerminalPanelComponent;