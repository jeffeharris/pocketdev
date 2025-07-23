import React, { useState, useRef, useEffect } from 'react';
import { Plus } from 'lucide-react';

export interface Tab {
  sessionId: string;
  dbSessionId: string;
  tabName: string;
  tabOrder: number;
  aiState: 'not-started' | 'idle' | 'working' | 'waiting';
  aiAgent: string;
}

interface TerminalTabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (sessionId: string) => void;
  onTabAdd: () => void;
  onTabAdvancedAdd?: () => void;
  onTabRename?: (dbSessionId: string, newName: string) => void;
  onTabClose?: (sessionId: string) => void; // For future implementation
  maxTabs?: number;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabAdd,
  onTabAdvancedAdd,
  onTabRename,
  onTabClose: _onTabClose, // Prefixed with _ to indicate intentionally unused
  maxTabs = 6
}) => {
  // State for inline editing
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Sort tabs by tabOrder
  const sortedTabs = [...tabs].sort((a, b) => a.tabOrder - b.tabOrder);
  
  // Focus input when editing starts
  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);
  
  // Determine indicator color based on AI state
  const getStateColor = (state: Tab['aiState']) => {
    switch (state) {
      case 'waiting':
        return 'bg-purple-400';
      case 'working':
        return 'bg-yellow-400';
      case 'idle':
        return 'bg-blue-400';
      default:
        return 'bg-gray-500';
    }
  };
  
  const handleDoubleClick = (tab: Tab) => {
    setEditingTabId(tab.dbSessionId);
    setEditValue(tab.tabName);
  };
  
  const handleRenameSubmit = () => {
    if (editingTabId && editValue.trim() && onTabRename) {
      const tab = tabs.find(t => t.dbSessionId === editingTabId);
      if (tab && editValue.trim() !== tab.tabName) {
        onTabRename(editingTabId, editValue.trim());
      }
    }
    setEditingTabId(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameSubmit();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  return (
    <div className="flex items-center bg-gray-800 border-b border-gray-700">
      <div className="flex overflow-x-auto">
        {sortedTabs.map((tab) => {
          const isActive = tab.dbSessionId === activeTabId;
          return (
            <button
              key={tab.dbSessionId}
              onClick={() => onTabSelect(tab.dbSessionId)}
              onDoubleClick={() => handleDoubleClick(tab)}
              className={`px-4 py-2 text-sm border-r border-gray-600 relative transition-colors ${
                isActive
                  ? 'bg-gray-700 text-gray-200'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
              }`}
              title={`${tab.tabName} (${tab.aiAgent}) - Double-click to rename`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStateColor(tab.aiState)}`}></div>
                {editingTabId === tab.dbSessionId ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={handleRenameSubmit}
                    onKeyDown={handleKeyDown}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-gray-900 text-gray-200 px-1 py-0 text-sm border border-gray-600 rounded outline-none focus:border-blue-500"
                    style={{ width: `${Math.max(50, editValue.length * 8)}px` }}
                  />
                ) : (
                  <span>{tab.tabName}</span>
                )}
              </div>
              {isActive && (
                <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${getStateColor(tab.aiState)}`}></div>
              )}
            </button>
          );
        })}
        
        {/* Plus button for adding new tabs */}
        {tabs.length < maxTabs && (
          <button
            onClick={onTabAdd}
            onContextMenu={(e) => {
              e.preventDefault();
              if (onTabAdvancedAdd) {
                onTabAdvancedAdd();
              }
            }}
            className="px-3 py-2 bg-gray-800 text-gray-500 text-sm hover:bg-gray-700 hover:text-gray-400 transition-colors"
            title="Add new terminal tab (right-click for advanced options)"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
};