import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Bell, Settings, AlertCircle, GitBranch, Command } from 'lucide-react';
import type { Task } from '../../types/task';
import { WorkerStatus } from '../../types/task';
import type { Project } from '../../types/project';
import { TaskListItem } from '../task/TaskListItem';
import { SettingsModal } from '../settings/SettingsModal';
import { useQuickAccess } from '../../hooks/keyboard';

interface MainHeaderProps {
  project: Project;
  tasks: Task[];
  activeTaskId: string;
  onTaskSelect: (taskId: string, focusTabId?: string) => void;
  notifications?: number;
}

export const MainHeader: React.FC<MainHeaderProps> = ({
  project,
  tasks,
  activeTaskId,
  onTaskSelect
}) => {
  const navigate = useNavigate();
  const [showTaskSwitcher, setShowTaskSwitcher] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { toggleQuickAccess } = useQuickAccess();
  const activeTask = tasks.find(t => t.id === activeTaskId);
  const pendingValidation = tasks.filter(t => t.sessionState?.status === WorkerStatus.Waiting).length;

  return (
    <div className="bg-white border-b border-gray-200">
      <div className="px-1 py-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/projects')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-sm cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Back to Projects
            </button>
            
            <div className="h-4 w-px bg-gray-300"></div>
            
            <button 
              onClick={() => navigate(`/projects/${project.id}`)}
              className="flex items-center gap-3 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors cursor-pointer"
            >
              <div className="w-8 h-8 bg-gray-900 rounded-lg flex items-center justify-center">
                <GitBranch className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <h1 className="font-semibold text-gray-900">{project.name}</h1>
                <p className="text-xs text-gray-500">{tasks.length} active tasks</p>
              </div>
            </button>

            {/* Quick Task Switcher */}
            <div className="relative">
              <button 
                onClick={() => setShowTaskSwitcher(!showTaskSwitcher)}
                className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm transition-colors cursor-pointer"
              >
                <span>#{activeTask?.id.slice(-3)} {activeTask?.name || 'Unnamed Task'}</span>
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
                        onSelect={(task, focusTabId) => {
                          onTaskSelect(task.id, focusTabId);
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

            {/* Quick Access Button */}
            <button 
              onClick={toggleQuickAccess}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              title="Quick Access (Ctrl+K)"
            >
              <Command className="w-5 h-5" />
            </button>

            <button 
              onClick={() => setShowSettings(true)}
              className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Attention Bar */}
      {pendingValidation > 0 && (
        <AttentionBar count={pendingValidation} />
      )}
      
      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};

// Sub-components
const NotificationButton: React.FC<{ count: number }> = ({ count }) => (
  <div className="relative">
    <button 
      className="p-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors cursor-pointer"
      title={count > 0 ? `${count} task${count > 1 ? 's' : ''} need attention` : "Notifications"}
    >
      <Bell className="w-5 h-5" />
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
      <button className="text-yellow-800 hover:text-yellow-900 text-sm font-medium cursor-pointer">
        Review Now →
      </button>
    </div>
  </div>
);