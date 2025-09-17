import { useEffect, useState, useCallback } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { WorkerStatus } from '@shared/types';
import type { SessionState, TerminalSession } from '@shared/types';

interface WorkerStatusData {
  sessionState: SessionState;
  sessionStates?: TerminalSession[];
}

/**
 * Hook for tracking AI worker status via WebSocket
 * 
 * Single responsibility: Track only the AI worker's status
 * (not-started, idle, working, waiting) and session states.
 * Does NOT handle time formatting - that's a presentation concern.
 * 
 * @param taskId - The task ID to monitor
 * @returns Worker status and session states
 */
export function useWorkerStatus(taskId: string | undefined): WorkerStatusData {
  const [workerStatus, setWorkerStatus] = useState<WorkerStatusData>({
    sessionState: {
      status: WorkerStatus.NotStarted,
      lastStateChange: null
    }
  });
  
  const { subscribe, unsubscribe } = useWebSocketContext();

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'ai-state-changed') {
      console.log('[useWorkerStatus] Received AI state update:', message.data);
      setWorkerStatus({
        sessionState: {
          status: message.data.sessionState.status,
          lastStateChange: message.data.sessionState.lastStateChange
        },
        sessionStates: message.data.sessionState.sessionStates
      });
    }
  }, []);

  useEffect(() => {
    if (!taskId) return;
    
    subscribe('task', taskId, handleMessage);
    return () => unsubscribe('task', taskId, handleMessage);
  }, [taskId, subscribe, unsubscribe, handleMessage]);

  return workerStatus;
}
