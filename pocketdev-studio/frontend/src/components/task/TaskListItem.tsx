import React from 'react';
import type { Task } from '../../types/task.ts';
import { TaskStatus as TaskStatusComponent } from './TaskStatus.tsx';
import { WorkerStatus, TaskState } from '../../types/task.ts';
import { useTaskStatus } from '../../hooks/useTaskStatus.ts';
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
  const { sessionState, taskState, gitStatus } = useTaskStatus(task.id);
  
  // Merge initial data with real-time updates
  const currentSessionState = sessionState.status !== WorkerStatus.NotStarted ? sessionState : task.sessionState;
  const currentTaskState = taskState || task.taskState;
  const currentGitStatus = gitStatus || task.gitStatus;
  
  // Style based on task state
  const isMerged = currentTaskState === TaskState.Merged;
  
  return (
    <div 
      data-task-id={task.id}
      className={clsx(
        "p-2 rounded cursor-pointer text-sm transition-all",
        isActive 
          ? "bg-blue-50 ring-2 ring-blue-500 ring-opacity-50" 
          : "hover:bg-gray-50"
      )}
      onClick={() => onSelect(task)}
    >
      <div className="font-medium text-gray-900">#{task.id} {task.name || 'Unnamed Task'}</div>
      <div className="text-xs text-gray-500 mt-1">
        <TaskStatusComponent 
          workerStatus={currentSessionState.status}
          gitStatus={currentGitStatus}
          isMerged={isMerged}
          variant="compact"
        />
      </div>
    </div>
  );
};