import React from 'react';
import type { Task } from '../../types/task';
import { TaskStatus as TaskStatusComponent } from './TaskStatus';
import { WorkerStatus, TaskState } from '../../types/task';
import { useTaskStatus } from '../../hooks/useTaskStatus';
import { clsx } from 'clsx';

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
  // Get real-time status updates via WebSocket
  const { sessionState, sessionStates, taskState, gitStatus } = useTaskStatus(task.id);
  
  // Convert task.terminals to sessionStates format if needed
  const taskSessionStates = task.terminals?.map(terminal => ({
    id: terminal.dbSessionId,
    tabName: terminal.tabName,
    aiState: terminal.aiState || WorkerStatus.NotStarted,
    lastStateChange: terminal.lastStateChange || null
  }));
  
  // Use real-time sessionStates or fallback to terminals
  const currentSessionStates = sessionStates || taskSessionStates || task.sessionStates;
  
  // Calculate aggregated state based on priority
  const calculateAggregatedState = () => {
    if (!currentSessionStates || currentSessionStates.length === 0) {
      return sessionState.status !== WorkerStatus.NotStarted ? sessionState : task.sessionState;
    }
    
    // Priority order: waiting > working > idle > not-started
    const statePriority: Record<string, number> = {
      'waiting': 4,
      'working': 3,
      'idle': 2,
      'not-started': 1
    };
    
    let highestPriority = 0;
    let aggregatedStatus = WorkerStatus.NotStarted;
    
    for (const session of currentSessionStates) {
      const priority = statePriority[session.aiState] || 0;
      if (priority > highestPriority) {
        highestPriority = priority;
        aggregatedStatus = session.aiState as WorkerStatus;
      }
    }
    
    return { status: aggregatedStatus, lastStateChange: null };
  };
  
  // Merge initial data with real-time updates
  const currentSessionState = calculateAggregatedState();
  const currentTaskState = taskState || task.taskState;
  const currentGitStatus = gitStatus || task.gitStatus;
  
  // Style based on task state
  const isMerged = currentTaskState === TaskState.Merged;
  
  // Find the first tab that needs attention (waiting state)
  const handleClick = () => {
    const currentSessionStates = sessionStates || taskSessionStates || task.sessionStates;
    const waitingSession = currentSessionStates?.find(s => s.aiState === WorkerStatus.Waiting);
    onSelect(task, waitingSession?.id);
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
      <div 
        className="text-xs text-gray-500 mt-1"
        onClick={(e) => e.stopPropagation()}
      >
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