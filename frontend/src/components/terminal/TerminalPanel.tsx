import { useState, forwardRef, useImperativeHandle, useRef, useEffect } from 'react';
import { Eye, RefreshCw, ExternalLink, Monitor } from 'lucide-react';
import type { Task, TerminalSession } from '../../types/task';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';
import { TerminalTabs, type Tab } from './TerminalTabs';
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
  const [initializedTerminals, _setInitializedTerminals] = useState<Set<string>>(new Set());
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
    _setInitializedTerminals(prev => new Set(prev).add(sessionId));
    // Focus the terminal after switching
    setTimeout(() => {
      const terminalRef = terminalRefs.current.get(sessionId);
      terminalRef?.focus();
    }, 100);
  };

  const handleTabAdd = async () => {
    try {
      const tabCount = terminals.length;
      const newSession = await api.createTerminalSession(task.id, {
        tabName: `Tab ${tabCount + 1}`,
        aiAgent: 'claude'
      });
      
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
    } catch (error) {
      console.error('Failed to create new terminal:', error);
    }
  };

  // Convert terminals to Tab format for TerminalTabs component
  const tabs: Tab[] = terminals.map(t => ({
    sessionId: t.sessionId,
    dbSessionId: t.dbSessionId,
    tabName: t.tabName,
    tabOrder: t.tabOrder,
    aiState: t.aiState,
    aiAgent: t.aiAgent
  }));


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
            onTabAdd={handleTabAdd}
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
    </div>
  );
});

TerminalPanelComponent.displayName = 'TerminalPanel';

export const TerminalPanel = TerminalPanelComponent;