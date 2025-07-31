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
    id: terminal.dbSessionId, // Backend expects 'id' field
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
  
  // Find the highest priority tab to focus on
  const handleClick = () => {
    // Priority: real-time WebSocket data > mapped terminals > initial task data
    const currentSessionStates = sessionStates || taskSessionStates || task.sessionStates;
    
    
    if (!currentSessionStates || currentSessionStates.length === 0) {
      onSelect(task);
      return;
    }
    
    // Same priority logic as TaskStatus component
    const statePriority: Record<string, number> = {
      'waiting': 4,
      'working': 3,
      'idle': 2,
      'not-started': 1
    };
    
    // Sort sessions by priority, then by most recent update
    const sortedSessions = [...currentSessionStates].sort((a, b) => {
      const priorityA = statePriority[a.aiState] || 0;
      const priorityB = statePriority[b.aiState] || 0;
      
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // If same priority, use most recent update
      const timeA = a.lastStateChange ? new Date(a.lastStateChange).getTime() : 0;
      const timeB = b.lastStateChange ? new Date(b.lastStateChange).getTime() : 0;
      return timeB - timeA;
    });
    
    const prioritySessionId = sortedSessions[0]?.id;
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