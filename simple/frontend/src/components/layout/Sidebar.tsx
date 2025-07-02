import React from 'react';
import { GitBranch, CheckCircle, FileText, Activity, Plus } from 'lucide-react';
import type { Task } from '../../types/task';
import { TaskListItem } from '../task/TaskListItem';
import { TaskStatus } from '../task/TaskStatus';

interface SidebarProps {
  currentTask: Task;
  allTasks: Task[];
  onTaskSelect: (task: Task) => void;
  collapsed?: boolean;
  onCreateTask?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTask,
  allTasks,
  onTaskSelect,
  collapsed = false,
  onCreateTask
}) => {
  if (collapsed) return null;

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      {/* Current Task Details */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-900">#{currentTask.id.slice(-3)} {currentTask.title}</h2>
          <TaskStatus status={currentTask.sessionState.status} />
        </div>

        <div className="space-y-3">
          <div>
            <p className="text-sm text-gray-600">{currentTask.description}</p>
          </div>
        </div>
      </div>

      {/* Repository Status Section */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="font-medium text-gray-900 mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4" />
          {currentTask.branch}
        </h3>
        
        <div className="space-y-3">
          {/* Visual Git Status */}
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Working Tree</span>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-700">Clean</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Branch Status</span>
              <div className="flex items-center gap-1">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-xs text-green-700">Up to date</span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Changes</span>
              <span className="text-xs text-gray-600">5 files modified</span>
            </div>
          </div>

          {/* Git Actions */}
          <div className="space-y-2">
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <FileText className="w-4 h-4" />
              View File Changes
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <GitBranch className="w-4 h-4" />
              Show Git Log
            </button>
            <button className="w-full flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors">
              <Activity className="w-4 h-4" />
              Compare with Base
            </button>
          </div>
        </div>
      </div>

      {/* All Tasks List */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-gray-900">All Tasks</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">{allTasks.length} active</span>
              {onCreateTask && (
                <button
                  onClick={onCreateTask}
                  className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all duration-200 hover:scale-110 cursor-pointer"
                  title="Create new task"
                >
                  <Plus className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {allTasks.map(task => (
              <TaskListItem
                key={task.id}
                task={task}
                isActive={task.id === currentTask.id}
                onSelect={onTaskSelect}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};