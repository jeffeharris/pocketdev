import React, { useState, useEffect, forwardRef, useImperativeHandle, useRef } from 'react';
import { Eye, RefreshCw, ExternalLink, Monitor, Plus } from 'lucide-react';
import type { Task } from '../../types/task';
import { DirectTerminal, type DirectTerminalHandle } from './DirectTerminal';

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
  const sessionId = `task-${task.id}`;
  const terminalRef = useRef<DirectTerminalHandle>(null);

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[TerminalPanel] Forwarding focus to terminal for task:', task.id);
      terminalRef.current?.focus();
    }
  }), [task.id]);
  
  const handleResetSession = async () => {
    setIsResetting(true);
    try {
      // TODO: Call shelltender API to reset the session
      // For now, we'll just show the animation
    } catch (error) {
      console.error('Error resetting session:', error);
    } finally {
      setTimeout(() => setIsResetting(false), 1000);
    }
  };


  return (
    <div 
      className="bg-gray-900 flex flex-col"
      style={{ height: validationMode ? '60%' : '100%' }}
    >
      {/* Terminal Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="flex items-center justify-between">
          {/* Session Tabs - Currently just visual placeholders */}
          <div className="flex">
            <button className="px-4 py-2 bg-gray-700 text-gray-200 text-sm border-r border-gray-600 relative">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                <span>Implementation</span>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-400"></div>
            </button>
            <button className="px-4 py-2 bg-gray-800 text-gray-400 text-sm border-r border-gray-600 hover:bg-gray-700 hover:text-gray-300 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span>Planning</span>
              </div>
            </button>
            <button className="px-4 py-2 bg-gray-800 text-gray-400 text-sm border-r border-gray-600 hover:bg-gray-700 hover:text-gray-300 transition-colors">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                <span>Testing</span>
              </div>
            </button>
            <button className="px-3 py-2 bg-gray-800 text-gray-500 text-sm hover:bg-gray-700 hover:text-gray-400 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
          </div>

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

      {/* Shelltender Content */}
      <div className="flex-1 bg-gray-900 relative overflow-hidden">
        <DirectTerminal 
          ref={terminalRef}
          taskId={task.id} 
          sessionId={sessionId} 
          worktreePath={task.worktree_path || task.worktree} 
          isVisible={isVisible}
        />
      </div>
    </div>
  );
});

TerminalPanelComponent.displayName = 'TerminalPanel';

export const TerminalPanel = TerminalPanelComponent;