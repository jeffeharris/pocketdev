import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Bell, MoreHorizontal, Settings, AlertCircle, GitBranch } from 'lucide-react';
import type { Task } from '../../types/task';
import { TaskStatus } from '../../types/task';
import type { Project } from '../../types/project';
import { TaskListItem } from '../task/TaskListItem';

interface MainHeaderProps {
  project: Project;
  tasks: Task[];
  activeTaskId: string;
  onTaskSelect: (taskId: string) => void;
  notifications?: number;
}

export const MainHeader: React.FC<MainHeaderProps> = ({
  project,
  tasks,
  activeTaskId,
  onTaskSelect,
  notifications = 0
}) => {
  const [showTaskSwitcher, setShowTaskSwitcher] = useState(false);
  const activeTask = tasks.find(t => t.id === activeTaskId);
  const pendingValidation = tasks.filter(t => t.sessionState?.status === TaskStatus.Waiting).length;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm">
              <ChevronLeft className="w-4 h-4" />
              Back to Projects
            </button>
            
            <div className="h-4 w-px bg-gray-300"></div>
            
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <div>
                <h1 className="font-semibold text-gray-900">{project.name}</h1>
                <p className="text-xs text-gray-500">{tasks.length} active tasks</p>
              </div>
            </div>

            {/* Quick Task Switcher */}
            <div className="relative">
              <button 
                onClick={() => setShowTaskSwitcher(!showTaskSwitcher)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors"
              >
                <span>#{activeTask?.id.slice(-3)} {activeTask?.title}</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              {showTaskSwitcher && (
                <div className="absolute top-full left-0 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                  <div className="p-2 max-h-64 overflow-y-auto">
                    {tasks.map(task => (
                      <TaskListItem
                        key={task.id}
                        task={task}
                        isActive={task.id === activeTaskId}
                        onSelect={(task) => {
                          onTaskSelect(task.id);
                          setShowTaskSwitcher(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Notification Bell */}
            <NotificationButton count={pendingValidation} />
            
            {/* Task Actions Menu */}
            <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
              <MoreHorizontal className="w-4 h-4" />
              <span className="hidden sm:inline">Task Actions</span>
            </button>

            <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </div>
      </div>

      {/* Attention Bar */}
      {pendingValidation > 0 && (
        <AttentionBar count={pendingValidation} />
      )}
    </div>
  );
};

// Sub-components
const NotificationButton: React.FC<{ count: number }> = ({ count }) => (
  <div className="relative">
    <button className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors">
      <Bell className="w-4 h-4" />
      <span className="hidden sm:inline">Notifications</span>
    </button>
    {count > 0 && <NotificationBadge count={count} />}
  </div>
);

const NotificationBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count === 0) return null;
  return (
    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
      {count > 9 ? '9+' : count}
    </div>
  );
};

const AttentionBar: React.FC<{ count: number }> = ({ count }) => (
  <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2 text-yellow-800">
        <AlertCircle className="w-4 h-4" />
        <span className="text-sm font-medium">
          {count} task{count > 1 ? 's' : ''} need{count === 1 ? 's' : ''} user input
        </span>
      </div>
      <button className="text-yellow-800 hover:text-yellow-900 text-sm font-medium">
        Review Now →
      </button>
    </div>
  </div>
);