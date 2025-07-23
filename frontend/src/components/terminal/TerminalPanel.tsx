import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Eye, RefreshCw, ExternalLink, Monitor } from 'lucide-react';
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
  const [terminals, setTerminals] = useState<TerminalSession[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [initializedTerminals, setInitializedTerminals] = useState<Set<string>>(new Set());
  const [launchingClaude, setLaunchingClaude] = useState<Set<string>>(new Set());
  const [showSessionLauncher, setShowSessionLauncher] = useState(false);
  const terminalRefs = useRef<Map<string, DirectTerminalHandle>>(new Map());

  // Load terminal sessions on mount or task change
  useEffect(() => {
    const loadTerminals = async () => {
      if (task.terminals && task.terminals.length > 0) {
        setTerminals(task.terminals);
        // Set first tab as active if none selected
        if (!activeTabId) {
          const firstTab = task.terminals.sort((a, b) => a.tabOrder - b.tabOrder)[0];
          if (firstTab) {
            setActiveTabId(firstTab.sessionId);
          }
        }
      } else {
        // Create first terminal if none exist
        try {
          const newSession = await api.createTerminalSession(task.id, {
            tabName: 'Main',
            aiAgent: 'claude'
          });
          setTerminals([{
            sessionId: newSession.sessionId,
            dbSessionId: newSession.dbSessionId,
            tabName: newSession.tabName,
            tabOrder: newSession.tabOrder,
            aiState: 'not-started',
            aiAgent: newSession.aiAgent
          }]);
          setActiveTabId(newSession.sessionId);
        } catch (error) {
          console.error('Failed to create initial terminal:', error);
        }
      }
    };
    
    loadTerminals();
  }, [task.id]);

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
      // TODO: Call shelltender API to reset the session
      // For now, we'll just show the animation
    } catch (error) {
      // Error resetting session
    } finally {
      setTimeout(() => setIsResetting(false), 1000);
    }
  };

  const handleTabSelect = (sessionId: string) => {
    setActiveTabId(sessionId);
    // Mark as initialized
    setInitializedTerminals(prev => new Set(prev).add(sessionId));
    // Focus the terminal after switching
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(sessionId);
      terminalRef?.focus();
    }, 100);
  };

  const handleTabAdd = async (options?: SessionOptions) => {
    console.log('[TerminalPanel] handleTabAdd called with options:', options);
    try {
      const tabCount = terminals.length;
      console.log('[TerminalPanel] Current tab count:', tabCount);
      
      // Get the currently active terminal to copy history from
      const activeTerminal = terminals.find(t => t.sessionId === activeTabId);
      
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
        tabName: newSession.tabName,
        tabOrder: newSession.tabOrder,
        aiState: 'not-started',
        aiAgent: newSession.aiAgent
      };
      
      setTerminals(prev => [...prev, newTerminal]);
      setActiveTabId(newSession.sessionId);
      
      // Only auto-launch Claude if no options provided (quick launch)
      if (!options) {
        // Mark this session as launching Claude
        console.log('[TerminalPanel] Marking session for Claude launch:', newSession.sessionId);
        setLaunchingClaude(prev => new Set(prev).add(newSession.sessionId));
      
      // Wait for terminal to be ready and prompt to appear, then launch Claude
      console.log('[TerminalPanel] Setting timeout for Claude launch...');
      setTimeout(async () => {
        try {
          console.log('[TerminalPanel] Auto-launching Claude for new tab:', newSession.sessionId);
          
          // First send a newline to ensure prompt is visible
          console.log('[TerminalPanel] Sending newline to force prompt...');
          await api.executeCommand(newSession.sessionId, '');
          
          // Small delay then send claude command
          setTimeout(async () => {
            console.log('[TerminalPanel] Sending claude command...');
            await api.executeCommand(newSession.sessionId, 'claude');
            console.log('[TerminalPanel] Claude command sent successfully');
            
            // Remove from launching set after some time
            setTimeout(() => {
              console.log('[TerminalPanel] Removing launching state for:', newSession.sessionId);
              setLaunchingClaude(prev => {
                const newSet = new Set(prev);
                newSet.delete(newSession.sessionId);
                return newSet;
              });
            }, 3000);
          }, 500);
        } catch (error) {
          console.error('[TerminalPanel] Failed to auto-launch Claude:', error);
          // Remove from launching set on error
          setLaunchingClaude(prev => {
            const newSet = new Set(prev);
            newSet.delete(newSession.sessionId);
            return newSet;
          });
        }
      }, 3000); // Wait 3 seconds for terminal to be ready
      } else {
        // Advanced launch with options
        console.log('[TerminalPanel] Advanced launch with options:', options);
        
        // Mark as launching if we have a prompt or need to change directory
        if (options.workingDirectory || options.initialPrompt) {
          setLaunchingClaude(prev => new Set(prev).add(newSession.sessionId));
          
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
                await api.executeCommand(newSession.sessionId, command);
                // Small delay between commands
                await new Promise(resolve => setTimeout(resolve, 500));
              }
              
              // Remove launching state
              setTimeout(() => {
                setLaunchingClaude(prev => {
                  const newSet = new Set(prev);
                  newSet.delete(newSession.sessionId);
                  return newSet;
                });
              }, 3000);
            } catch (error) {
              console.error('[TerminalPanel] Failed to execute advanced launch:', error);
              setLaunchingClaude(prev => {
                const newSet = new Set(prev);
                newSet.delete(newSession.sessionId);
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


  // Convert terminals to Tab format for TerminalTabs component
  const tabs: Tab[] = terminals.map(t => {
    const isLaunching = launchingClaude.has(t.sessionId);
    console.log(`[TerminalPanel] Tab ${t.sessionId} - isLaunching: ${isLaunching}, aiState: ${t.aiState}`);
    return {
      sessionId: t.sessionId,
      dbSessionId: t.dbSessionId,
      tabName: t.tabName,
      tabOrder: t.tabOrder,
      aiState: isLaunching ? 'working' : t.aiState,
      aiAgent: t.aiAgent
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
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              disabled={isResetting}
              title="Reset session to original state"
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
        {terminals.map(terminal => (
          <DirectTerminal
            key={terminal.sessionId}
            ref={(el) => {
              if (el) {
                terminalRefs.current.set(terminal.sessionId, el);
              } else {
                terminalRefs.current.delete(terminal.sessionId);
              }
            }}
            taskId={task.id}
            sessionId={terminal.sessionId}
            worktreePath={task.worktree_path}
            isVisible={isVisible && terminal.sessionId === activeTabId}
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