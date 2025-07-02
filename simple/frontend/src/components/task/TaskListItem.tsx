import React from 'react';
import type { Task } from '../../types/task';
import { TaskStatus } from './TaskStatus';
import { useTaskStatus } from '../../hooks/useTaskStatus';
import { clsx } from 'clsx';

interface TaskListItemProps {
  task: Task;
  isActive: boolean;
  onSelect: (task: Task) => void;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({ 
  task, 
  isActive, 
  onSelect
}) => {
  // Get real-time status updates
  const { sessionState, taskState, gitStatus, idleTime } = useTaskStatus(task.id);
  
  // Merge initial data with real-time updates
  const currentSessionState = sessionState.status !== 'not-started' ? sessionState : task.sessionState;
  const currentTaskState = taskState || task.taskState;
  const currentGitStatus = gitStatus || task.gitStatus;
  
  // Determine if task needs attention
  const needsAttention = currentSessionState.status === 'user-request';
  
  // Style based on task state
  const iseMerged = currentTaskState === 'merged';
  
  return (
    <div 
      className={clsx(
        'relative p-3 rounded-lg cursor-pointer transition-all border',
        isActive 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : iseMerged
          ? 'bg-green-50 border-green-200 hover:shadow-sm'
          : needsAttention
          ? 'bg-yellow-50 border-yellow-200 hover:shadow-sm'
          : 'bg-white border-gray-200 hover:shadow-sm hover:border-gray-300'
      )}
      onClick={() => onSelect(task)}
    >
      {needsAttention && (
        <div className="absolute top-2 right-2">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
        </div>
      )}
      
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-gray-900">#{task.id.slice(-3)}</span>
            <TaskStatus status={currentSessionState.status} />
            {iseMerged && (
              <span className="text-xs bg-green-100 text-green-800 px-1.5 py-0.5 rounded">Merged</span>
            )}
          </div>
          <h4 className="font-medium text-gray-900 text-sm truncate">{task.title}</h4>
        </div>
        
        {/* Git status indicators */}
        {currentGitStatus && (currentGitStatus.ahead > 0 || currentGitStatus.behind > 0) && (
          <div className="flex items-center gap-1 text-xs">
            {currentGitStatus.behind > 0 && (
              <span className="text-red-600">↓{currentGitStatus.behind}</span>
            )}
            {currentGitStatus.ahead > 0 && (
              <span className="text-green-600">↑{currentGitStatus.ahead}</span>
            )}
            {currentGitStatus.hasConflicts && (
              <span className="text-yellow-600">⚠️</span>
            )}
          </div>
        )}
      </div>
      
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{task.branch}</span>
        <span>
          {currentSessionState.status === 'idle' && idleTime 
            ? `Idle for ${idleTime}`
            : currentSessionState.status === 'working' 
            ? 'Working'
            : currentSessionState.status === 'thinking'
            ? 'Thinking'
            : currentSessionState.status === 'user-request'
            ? 'Needs input'
            : ''}
        </span>
      </div>
      
      {needsAttention && (
        <div className="mt-2 text-xs text-yellow-700 font-medium">
          AI needs your input
        </div>
      )}
    </div>
  );
};