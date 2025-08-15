import { useEffect, useState, useRef, useCallback } from 'react';
import { useWebSocketContext } from '../contexts/WebSocketContext';
import { WorkerStatus, TaskState } from '../types/task';
import type { SessionState, IndividualSessionState } from '../types/task';

interface TaskStatusData {
  sessionState: SessionState;
  sessionStates?: IndividualSessionState[];
  taskState: TaskState;
  gitStatus?: {
    ahead: number;
    behind: number;
    hasConflicts: boolean;
  };
}

/**
 * Hook for real-time task status updates via WebSocket
 * 
 * This hook subscribes to WebSocket events for a specific task and provides:
 * - sessionState: Current AI worker status (not-started, idle, working, waiting)
 * - taskState: Overall task state (active, merged, archived)
 * - gitStatus: Real-time git branch status (ahead/behind/conflicts)
 * - idleTime: Human-readable elapsed time (format varies by status):
 *   - Not Started: Empty string (no time display)
 *   - Idle: "Xm" or "Xh Xm" (minutes/hours)
 *   - Working: "Xs" or "Xm Xs" (seconds, updates every second)
 *   - Waiting: "Xm", "Xh Xm", or "Xd Xh" (minutes/hours/days)
 * 
 * The hook automatically manages WebSocket subscriptions and cleans up on unmount.
 */
export function useTaskStatus(taskId: string | undefined) {
  const [taskStatus, setTaskStatus] = useState<TaskStatusData | null>(null);
  const [idleTime, setIdleTime] = useState<string>('');
  const lastUpdateRef = useRef<number>(Date.now());
  const { subscribe, unsubscribe } = useWebSocketContext();

  // Handle WebSocket messages for this task
  // Message types:
  // - ai_state_update: AI worker state changed (from backend AI monitor)
  // - task_state_change: Task lifecycle state changed (active->merged, etc)
  // - git_status_update: Git branch status changed
  const handleMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'ai_state_update':
        console.log('[useTaskStatus] Received AI state update:', message.data);
        // Update AI worker state - this comes from terminal pattern matching
        setTaskStatus(prev => ({
          ...prev!,
          sessionState: {
            status: message.data.sessionState.status,
            lastStateChange: message.data.sessionState.lastStateChange
          },
          sessionStates: message.data.sessionState.sessionStates
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

  // Calculate elapsed time for display based on status
  // - Idle: "Idle for X minutes/hours"
  // - Waiting: "Waiting for X minutes/hours/days"
  // - Working: "Working for X seconds"
  // - Not Started: No time display
  useEffect(() => {
    if (!taskStatus?.sessionState?.lastStateChange) return;
    
    const status = taskStatus.sessionState.status;
    if (status === WorkerStatus.NotStarted) {
      setIdleTime('');
      return;
    }

    const updateIdleTime = () => {
      if (!taskStatus.sessionState.lastStateChange) {
        setIdleTime('');
        return;
      }
      const lastChange = new Date(taskStatus.sessionState.lastStateChange).getTime();
      const now = Date.now();
      const diffMs = now - lastChange;
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMinutes / 60);
      const diffDays = Math.floor(diffHours / 24);
      
      let timeStr = '';
      
      if (status === WorkerStatus.Working) {
        // For working status, show seconds
        if (diffSeconds < 60) {
          timeStr = `${diffSeconds}s`;
        } else if (diffMinutes < 60) {
          const seconds = diffSeconds % 60;
          timeStr = `${diffMinutes}m ${seconds}s`;
        } else {
          timeStr = `${diffHours}h ${diffMinutes % 60}m`;
        }
      } else {
        // For idle/waiting, show minutes/hours/days
        if (diffMinutes < 1) {
          timeStr = '< 1m';
        } else if (diffMinutes < 60) {
          timeStr = `${diffMinutes}m`;
        } else if (diffHours < 24) {
          timeStr = `${diffHours}h ${diffMinutes % 60}m`;
        } else {
          timeStr = `${diffDays}d ${diffHours % 24}h`;
        }
      }
      
      setIdleTime(timeStr);
    };

    updateIdleTime();
    
    // Update more frequently for working status (every second)
    // Less frequently for idle/waiting (every minute)
    const interval = setInterval(
      updateIdleTime, 
      status === WorkerStatus.Working ? 1000 : 60000
    );
    
    return () => clearInterval(interval);
  }, [taskStatus?.sessionState]);

  return {
    sessionState: taskStatus?.sessionState || { status: WorkerStatus.NotStarted, lastStateChange: null },
    sessionStates: taskStatus?.sessionStates,
    taskState: taskStatus?.taskState || TaskState.Active,
    gitStatus: taskStatus?.gitStatus,
    idleTime
  };
}