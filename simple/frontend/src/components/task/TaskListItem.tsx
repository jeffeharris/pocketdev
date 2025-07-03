import React from 'react';
import type { Task } from '../../types/task';
import { TaskStatus as TaskStatusComponent } from './TaskStatus';
import { WorkerStatus, TaskState } from '../../types/task';
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
  // Get real-time status updates via WebSocket
  // idleTime shows elapsed time based on status:
  // - Working: updates every second (e.g., "45s", "2m 15s")
  // - Idle/Waiting: updates every minute (e.g., "5m", "2h 30m", "3d 4h")
  const { sessionState, taskState, gitStatus, idleTime } = useTaskStatus(task.id);
  
  // Merge initial data with real-time updates
  const currentSessionState = sessionState.status !== WorkerStatus.NotStarted ? sessionState : task.sessionState;
  const currentTaskState = taskState || task.taskState;
  const currentGitStatus = gitStatus || task.gitStatus;
  
  // Determine if task needs attention
  const needsAttention = currentSessionState.status === WorkerStatus.Waiting;
  
  // Style based on task state
  const isMerged = currentTaskState === TaskState.Merged;
  
  return (
    <div 
      className={clsx(
        'relative p-3 rounded-lg cursor-pointer transition-all border',
        isActive 
          ? 'bg-blue-50 border-blue-200 shadow-sm' 
          : isMerged
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
            <TaskStatusComponent 
              workerStatus={currentSessionState.status}
              gitStatus={currentGitStatus}
              isMerged={isMerged}
              variant="inline"
            />
          </div>
          <h4 className="font-medium text-gray-900 text-sm truncate">{task.title}</h4>
        </div>
        
      </div>
      
      {/* Bottom row: Branch name and elapsed time */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{task.branch}</span>
        <span>
          {/* Show elapsed time based on status - no time for "Not Started" */}
          {currentSessionState.status === WorkerStatus.Idle && idleTime 
            ? `Idle for ${idleTime}`
            : currentSessionState.status === WorkerStatus.Working && idleTime
            ? `Working for ${idleTime}`
            : currentSessionState.status === WorkerStatus.Waiting && idleTime
            ? `Waiting for ${idleTime}`
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