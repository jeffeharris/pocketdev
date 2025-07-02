import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import type { TaskStatus } from '../types/task';
import { TaskStatus as TaskStatusEnum, TaskState } from '../types/task';

interface SessionState {
  status: TaskStatus;
  lastStateChange: string | null;
}

interface TaskStatusData {
  sessionState: SessionState;
  taskState: TaskState;
  gitStatus?: {
    ahead: number;
    behind: number;
    hasConflicts: boolean;
  };
}

export function useTaskStatus(taskId: string | undefined) {
  const [taskStatus, setTaskStatus] = useState<TaskStatusData | null>(null);
  const [idleTime, setIdleTime] = useState<string>('');
  const lastUpdateRef = useRef<number>(Date.now());
  const { subscribe, unsubscribe } = useWebSocketContext();

  // Handle WebSocket messages
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'ai_state_update':
        setTaskStatus(prev => ({
          ...prev!,
          sessionState: message.data.sessionState
        }));
        lastUpdateRef.current = Date.now();
        break;
        
      case 'task_state_change':
        setTaskStatus(prev => ({
          ...prev!,
          taskState: message.data.taskState
        }));
        break;
        
      case 'git_status_update':
        setTaskStatus(prev => ({
          ...prev!,
          gitStatus: message.data.gitStatus
        }));
        break;
    }
  }, []);

  // Subscribe to task updates
  useEffect(() => {
    if (!taskId) return;
    
    subscribe('task', taskId, handleMessage);
    return () => unsubscribe('task', taskId, handleMessage);
  }, [taskId, subscribe, unsubscribe, handleMessage]);

  // Calculate idle time
  useEffect(() => {
    if (!taskStatus?.sessionState?.lastStateChange) return;
    if (taskStatus.sessionState.status !== 'idle') {
      setIdleTime('');
      return;
    }

    const updateIdleTime = () => {
      const lastChange = new Date(taskStatus.sessionState.lastStateChange).getTime();
      const now = Date.now();
      const diffMinutes = Math.floor((now - lastChange) / 60000);
      
      if (diffMinutes < 1) {
        setIdleTime('< 1m');
      } else if (diffMinutes < 60) {
        setIdleTime(`${diffMinutes}m`);
      } else {
        const hours = Math.floor(diffMinutes / 60);
        setIdleTime(`${hours}h ${diffMinutes % 60}m`);
      }
    };

    updateIdleTime();
    const interval = setInterval(updateIdleTime, 60000); // Update every minute
    
    return () => clearInterval(interval);
  }, [taskStatus?.sessionState]);

  return {
    sessionState: taskStatus?.sessionState || { status: TaskStatusEnum.NotStarted, lastStateChange: null },
    taskState: taskStatus?.taskState || TaskState.Active,
    gitStatus: taskStatus?.gitStatus,
    idleTime
  };
}