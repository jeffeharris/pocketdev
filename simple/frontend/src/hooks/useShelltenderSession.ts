import { useEffect, useState } from 'react';

interface SessionInfo {
  id: string;
  status: 'creating' | 'active' | 'error';
  websocketUrl?: string;
}

export const useShelltenderSession = (taskId: string, worktreePath: string) => {
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    id: `task-${taskId}`,
    status: 'creating'
  });

  useEffect(() => {
    const createSession = async () => {
      try {
        const response = await fetch('http://localhost:8081/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: `task-${taskId}`,
            name: `Task ${taskId}`,
            command: 'bash',
            cwd: worktreePath,
            env: {
              TASK_ID: taskId,
              WORKTREE_PATH: worktreePath
            },
            metadata: {
              taskId,
              worktreePath
            }
          })
        });

        if (!response.ok) {
          // Session might already exist, which is fine
          console.warn('Session creation response:', response.status);
        }

        const data = await response.json();
        setSessionInfo({
          id: data.id,
          status: 'active',
          websocketUrl: data.websocketUrl || `ws://localhost:8080?session=task-${taskId}`
        });
      } catch (error) {
        console.error('Failed to create Shelltender session:', error);
        // Still allow connection even if creation fails (session might exist)
        setSessionInfo({
          id: `task-${taskId}`,
          status: 'active',
          websocketUrl: `ws://localhost:8080?session=task-${taskId}`
        });
      }
    };

    createSession();
  }, [taskId, worktreePath]);

  return sessionInfo;
};