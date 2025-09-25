import React, { useState, useRef, useEffect } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { sortByTabOrder } from '../../utils/terminal-utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

export interface Tab {
  sessionId: string;
  dbSessionId: string;
  normalizedId: string;  // Normalized ID for consistent tracking
  tabName: string;
  tabOrder: number;
  aiState: 'not-started' | 'idle' | 'working' | 'waiting';
  aiAgent: string;
  connectionStatus?: 'connected' | 'disconnected' | 'error';
}

interface TerminalTabsProps {
  tabs: Tab[];
  activeTabId: string;
  onTabSelect: (sessionId: string) => void;
  onTabAdd: () => void;
  onTabAdvancedAdd?: () => void;
  onTabRename?: (dbSessionId: string, newName: string) => void;
  onTabClose?: (dbSessionId: string) => void;
  onTabReorder?: (tabs: Tab[]) => void;
  maxTabs?: number;
}

// Sortable Tab Component
interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  onSingleClick: () => void;
  onDoubleClick: () => void;
  onClose?: () => void;
  onEditChange: (value: string) => void;
  onEditKeyDown: (e: React.KeyboardEvent) => void;
  onEditBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  getStateColor: (state: Tab['aiState']) => string;
  canShowClose: boolean;
}

const SortableTab: React.FC<SortableTabProps> = ({
  tab,
  isActive,
  isEditing,
  editValue,
  onSingleClick,
  onDoubleClick,
  onClose,
  onEditChange,
  onEditKeyDown,
  onEditBlur,
  getStateColor,
  canShowClose
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.dbSessionId });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSingleClick}
      onDoubleClick={onDoubleClick}
      className={`px-2 py-2 text-sm border-r border-gray-600 relative transition-colors cursor-pointer flex items-center gap-1 ${
        isActive
          ? 'bg-gray-700 text-gray-200'
          : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-300'
      } ${isDragging ? 'z-50' : ''}`}
      title={`${tab.tabName} (${tab.aiAgent}) - Double-click to rename, drag to reorder`}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className="cursor-move opacity-50 hover:opacity-100"
      >
        <GripVertical className="w-3 h-3" />
      </div>
      
      <div className="flex items-center gap-2 flex-grow">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${getStateColor(tab.aiState)}`}></div>
          {/* Connection status indicator */}
          {tab.connectionStatus === 'disconnected' && (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="Disconnected - Reconnecting..."></div>
          )}
          {tab.connectionStatus === 'error' && (
            <div className="w-2 h-2 rounded-full bg-red-600" title="Connection Error"></div>
          )}
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => onEditChange(e.target.value)}
              onBlur={onEditBlur}
              onKeyDown={onEditKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-900 text-gray-200 px-1 py-0 text-sm border border-gray-600 rounded outline-none focus:border-blue-500"
              style={{ width: `${Math.max(50, editValue.length * 8)}px` }}
              autoFocus
            />
          ) : (
            <span>{tab.tabName}</span>
          )}
        </div>
      </div>
      
      {/* Close button - only show if more than one tab */}
      {canShowClose && onClose && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="ml-1 p-0.5 hover:bg-gray-600 rounded transition-colors opacity-60 hover:opacity-100"
          title="Close tab"
        >
          <X className="w-3 h-3" />
        </button>
      )}
      
      {isActive && (
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${getStateColor(tab.aiState)}`}></div>
      )}
    </div>
  );
};

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabAdd,
  onTabAdvancedAdd,
  onTabRename,
  onTabClose,
  onTabReorder,
  maxTabs = 6
}) => {
  // State for inline editing
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const clickTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Sort tabs by tabOrder
  const sortedTabs = sortByTabOrder(tabs);
  
  // Setup drag and drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = sortedTabs.findIndex((tab) => tab.dbSessionId === active.id);
      const newIndex = sortedTabs.findIndex((tab) => tab.dbSessionId === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newTabs = arrayMove(sortedTabs, oldIndex, newIndex);
        // Update tab orders
        const updatedTabs = newTabs.map((tab, index) => ({
          ...tab,
          tabOrder: index
        }));
        
        if (onTabReorder) {
          onTabReorder(updatedTabs);
        }
      }
    }
  };
  
  // Note: Focus handling is now done in the SortableTab component with autoFocus
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current) {
        clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);
  
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
  
  const handleSingleClick = (tab: Tab) => {
    // Clear any pending double-click timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    
    // Set a timeout for single click
    clickTimeoutRef.current = setTimeout(() => {
      if (!editingTabId) {
        onTabSelect(tab.normalizedId);
      }
      clickTimeoutRef.current = null;
    }, 200);
  };

  const handleDoubleClick = (tab: Tab) => {
    // Cancel single click timeout
    if (clickTimeoutRef.current) {
      clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
    
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex items-center bg-gray-800 border-b border-gray-700">
        <div className="flex overflow-x-auto">
          <SortableContext
            items={sortedTabs.map(tab => tab.dbSessionId)}
            strategy={horizontalListSortingStrategy}
          >
            {sortedTabs.map((tab) => {
              const isActive = tab.normalizedId === activeTabId;
              const isEditing = editingTabId === tab.dbSessionId;
              
              return (
                <SortableTab
                  key={tab.dbSessionId}
                  tab={tab}
                  isActive={isActive}
                  isEditing={isEditing}
                  editValue={editValue}
                  onSingleClick={() => handleSingleClick(tab)}
                  onDoubleClick={() => handleDoubleClick(tab)}
                  onClose={onTabClose ? () => onTabClose(tab.dbSessionId) : undefined}
                  onEditChange={setEditValue}
                  onEditKeyDown={handleKeyDown}
                  onEditBlur={(e) => {
                    // Only submit if we're not clicking within the same button
                    const relatedTarget = e.relatedTarget as HTMLElement;
                    if (!relatedTarget || !e.currentTarget.parentElement?.parentElement?.contains(relatedTarget)) {
                      handleRenameSubmit();
                    }
                  }}
                  getStateColor={getStateColor}
                  canShowClose={tabs.length > 1}
                />
              );
            })}
          </SortableContext>
          
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
              className="px-2 py-2 bg-gray-800 text-gray-500 text-sm hover:bg-gray-700 hover:text-gray-400 transition-colors"
              title="Add new terminal tab (right-click for advanced options)"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </DndContext>
  );
};