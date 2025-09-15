import { useEffect, useState, useCallback } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { TaskState } from '../types/task';

/**
 * Hook for tracking task lifecycle state via WebSocket
 * 
 * Single responsibility: Track only the task's lifecycle state
 * (active, merged, archived) and nothing else.
 * 
 * @param taskId - The task ID to monitor
 * @returns Current task state
 */
export function useTaskState(taskId: string | undefined): TaskState {
  const [taskState, setTaskState] = useState<TaskState>(TaskState.Active);
  const { subscribe, unsubscribe } = useWebSocketContext();

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'task_state_change') {
      setTaskState(message.data.taskState);
    }
  }, []);

  useEffect(() => {
    if (!taskId) return;
    
    subscribe('task', taskId, handleMessage);
    return () => unsubscribe('task', taskId, handleMessage);
  }, [taskId, subscribe, unsubscribe, handleMessage]);

  return taskState;
}