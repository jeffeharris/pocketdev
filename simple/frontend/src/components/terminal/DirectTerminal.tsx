import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal, WebSocketProvider } from '@shelltender/client';

export type DirectTerminalHandle = {
  focus: () => void;
};

interface DirectTerminalProps {
  taskId: string;
  sessionId?: string;
  className?: string;
  worktreePath?: string;
  isVisible?: boolean;
}

const DirectTerminalComponent = forwardRef<DirectTerminalHandle, DirectTerminalProps>(({ 
  taskId, 
  sessionId,
  className = '',
  worktreePath,
  isVisible = true
}, ref) => {
  const terminalSessionId = sessionId || `task-${taskId}`;

  // Since Terminal doesn't expose a ref, we can't directly control focus
  // We'll need to handle focus differently
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[DirectTerminal] Focus called for task:', taskId);
      // Terminal component doesn't expose focus method
      // Focus will be handled by the terminal internally when clicked
    }
  }), [taskId]);


  // Configure WebSocket URL to use our proxy
  const websocketUrl = window.location.protocol === 'https:' 
    ? `wss://${window.location.host}/shelltender-ws`
    : `ws://${window.location.host}/shelltender-ws`;

  console.log('[DirectTerminal] Rendering terminal for task:', taskId, 'sessionId:', terminalSessionId);

  return (
    <div className={`w-full h-full overflow-hidden ${className}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <WebSocketProvider config={{ url: websocketUrl }}>
        <Terminal
          sessionId={terminalSessionId}
          onSessionCreated={(newSessionId: string) => {
            console.log('[DirectTerminal] Session created:', newSessionId);
          }}
        />
      </WebSocketProvider>
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

export const DirectTerminal = DirectTerminalComponent;