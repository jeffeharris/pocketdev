import React, { useEffect, useState, useCallback } from 'react';
import { Terminal } from '@shelltender/client';

interface ShelltenderFrameProps {
  taskId: string;
  sessionId?: string;
  className?: string;
  worktreePath?: string;
}

export const ShelltenderFrame: React.FC<ShelltenderFrameProps> = ({ 
  taskId, 
  sessionId,
  className = '',
  worktreePath
}) => {
  const [isInitializing, setIsInitializing] = useState(true);
  // Use the provided sessionId or generate one based on taskId
  const terminalSessionId = sessionId || `task-${taskId}`;

  useEffect(() => {
    // Try to create/verify the session exists on Shelltender server
    const initSession = async () => {
      try {
        // Try to create session on Shelltender server with auth
        const response = await fetch('/shelltender-api/sessions', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Auth-Key': 'pocketdev-monitor-key-2024'
          },
          body: JSON.stringify({
            id: terminalSessionId,
            name: `Task ${taskId}`,
            // Don't specify command - let it use the default pocketdev-shell
            cwd: worktreePath || `/projects/${taskId}`,
            // Directory restrictions - only allow access to task worktree
            restrictToPath: worktreePath || `/projects/${taskId}`,
            allowUpwardNavigation: false,
            blockedCommands: ['sudo', 'su', 'chmod', 'chown'],
            readOnlyMode: false,
            env: {
              TASK_ID: taskId,
              WORKTREE_PATH: worktreePath || `/projects/${taskId}`
            },
            metadata: {
              taskId,
              worktreePath: worktreePath || `/projects/${taskId}`
            }
          })
        });
        
        if (!response.ok) {
          // Session might already exist, which is fine
          console.warn('Session creation response:', response.status);
        }
      } catch (error) {
        console.error('Failed to initialize Shelltender session:', error);
        // Continue anyway - session might already exist
      } finally {
        setIsInitializing(false);
      }
    };

    initSession();
  }, [taskId, terminalSessionId, worktreePath]);

  const handleSessionCreated = useCallback((newSessionId: string) => {
    console.log('Terminal session created:', newSessionId);
  }, []);

  if (isInitializing) {
    return (
      <div className={`w-full h-full flex items-center justify-center ${className}`}>
        <div className="text-gray-400">Initializing terminal...</div>
      </div>
    );
  }

  // For now, let's use the iframe approach that we know works
  // The @shelltender/client Terminal component seems to expect port 8081 by default
  // but our WebSocket server is on 8080
  const iframeSrc = `http://localhost:3005/shelltender-terminal.html?task=${taskId}&session=${terminalSessionId}`;

  return (
    <div className={`w-full h-full ${className}`}>
      <iframe
        src={iframeSrc}
        className="w-full h-full border-0"
        title={`Terminal - Task ${taskId}`}
      />
    </div>
  );
};