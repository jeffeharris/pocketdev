import React from 'react';
import type { Task } from '@shared/types';
import { TaskStatus as TaskStatusComponent } from './TaskStatus';
import { WorkerStatus, TaskState } from '@shared/types';
import { useTaskState } from '../../hooks/useTaskState';
import { useWorkerStatus } from '../../hooks/useWorkerStatus';
import { useGitStatus } from '../../hooks/useGitStatus';
import { clsx } from 'clsx';
import { getAggregatedState, getHighestPrioritySessionId } from '../../utils/terminal-utils';

interface TaskListItemProps {
  task: Task;
  isActive: boolean;
  onSelect: (task: Task, focusTabId?: string) => void;
}

export const TaskListItem: React.FC<TaskListItemProps> = ({ 
  task, 
  isActive, 
  onSelect
}) => {
  // Get real-time status updates via WebSocket - now split into focused hooks
  const taskState = useTaskState(task.id);
  const { sessionState, sessionStates } = useWorkerStatus(task.id);
  const gitStatus = useGitStatus(task.id);
  
  // Convert task.terminals to sessionStates format if needed
  const taskSessionStates = task.terminals?.map(terminal => ({
    id: terminal.dbSessionId, // Backend expects 'id' field
    tabName: terminal.tabName,
    aiState: terminal.aiState || WorkerStatus.NotStarted,
    lastStateChange: terminal.lastStateChange || null
  }));
  
  // Use real-time sessionStates or fallback to terminals
  const currentSessionStates = sessionStates || taskSessionStates || task.sessionStates;
  
  // Calculate aggregated state using consolidated utility
  const currentSessionState = currentSessionStates && currentSessionStates.length > 0
    ? getAggregatedState(currentSessionStates)
    : sessionState.status !== WorkerStatus.NotStarted ? sessionState : task.sessionState;
  const currentTaskState = taskState || task.taskState;
  const currentGitStatus = gitStatus || task.gitStatus;
  
  // Style based on task state
  const isMerged = currentTaskState === TaskState.Merged;
  
  // Find the highest priority tab to focus on
  const handleClick = () => {
    // Priority: real-time WebSocket data > mapped terminals > initial task data
    const sessionsToCheck = sessionStates || taskSessionStates || task.sessionStates;
    
    if (!sessionsToCheck || sessionsToCheck.length === 0) {
      onSelect(task);
      return;
    }
    
    // Use consolidated utility to find highest priority session
    const prioritySessionId = getHighestPrioritySessionId(sessionsToCheck);
    onSelect(task, prioritySessionId);
  };
  
  return (
    <div 
      data-task-id={task.id}
      className={clsx(
        "p-2 rounded cursor-pointer text-sm transition-all",
        isActive 
          ? "bg-blue-50 ring-2 ring-blue-500 ring-opacity-50" 
          : "hover:bg-gray-50"
      )}
      onClick={handleClick}
    >
      <div className="font-medium text-gray-900">#{task.id} {task.name || 'Unnamed Task'}</div>
      <div className="text-xs text-gray-500 mt-1">
        <TaskStatusComponent 
          workerStatus={currentSessionState.status}
          gitStatus={currentGitStatus}
          isMerged={isMerged}
          variant="compact"
          sessionStates={currentSessionStates}
          onStatusClick={(prioritySessionId) => {
            onSelect(task, prioritySessionId);
          }}
        />
      </div>
    </div>
  );
};