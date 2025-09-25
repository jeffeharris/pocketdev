import { useEffect, useState, useCallback } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';

interface GitStatusData {
  ahead: number;
  behind: number;
  hasConflicts: boolean;
}

/**
 * Hook for tracking git status via WebSocket
 * 
 * Single responsibility: Track only git repository status
 * (ahead/behind counts, conflict state) and nothing else.
 * 
 * @param taskId - The task ID to monitor
 * @returns Git status information or null if not available
 */
export function useGitStatus(taskId: string | undefined): GitStatusData | null {
  const [gitStatus, setGitStatus] = useState<GitStatusData | null>(null);
  const { subscribe, unsubscribe } = useWebSocketContext();

  const handleMessage = useCallback((message: any) => {
    if (message.type === 'git-status-changed') {
      setGitStatus(message.data.gitStatus);
    }
  }, []);

  useEffect(() => {
    if (!taskId) return;
    
    subscribe('task', taskId, handleMessage);
    return () => unsubscribe('task', taskId, handleMessage);
  }, [taskId, subscribe, unsubscribe, handleMessage]);

  return gitStatus;
}