import { useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { Terminal, useWebSocket } from '@shelltender/client';
import type { TerminalHandle } from '@shelltender/client';

export interface DirectTerminalHandle {
  focus: () => void;
  fit: () => void;
}

interface DirectTerminalProps {
  taskId: string;
  dbSessionId: string;          // Database session ID
  shelltenderSessionId: string; // Actual Shelltender session ID to connect to
  className?: string;
  worktreePath?: string;
  isVisible?: boolean;
  onSessionStatus?: (status: 'connected' | 'disconnected' | 'error') => void;
}

const DirectTerminalComponent = forwardRef<DirectTerminalHandle, DirectTerminalProps>(({ 
  taskId, 
  dbSessionId,
  shelltenderSessionId,
  className = '',
  worktreePath: _worktreePath, // May be used for session initialization in future
  isVisible = true,
  onSessionStatus
}, ref) => {
  const { isConnected, wsService } = useWebSocket();
  const [isReady, setIsReady] = useState(false);
  const terminalRef = useRef<TerminalHandle>(null);
  
  // Container ref for DOM-based fallback
  const containerRef = useRef<HTMLDivElement>(null);

  // Update ready state when connected
  useEffect(() => {
    if (isConnected) {
      setIsReady(true);
    }
  }, [isConnected, shelltenderSessionId]);

  // Expose methods via imperative handle
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (terminalRef.current?.focus) {
        terminalRef.current.focus();
      } else {
        // TODO: Remove this workaround when upgrading to @shelltender/client v0.4.4+
        // v0.4.3 has a bug where forwardRef is stripped by Vite's bundler optimization
        // The Shelltender team has fixed this using Object.assign() to prevent optimization
        // See: simple/docs/shelltender/ for investigation details
        const xtermTextarea = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
        if (xtermTextarea) {
          xtermTextarea.focus();
        }
      }
    },
    fit: () => {
      if (terminalRef.current?.fit) {
        terminalRef.current.fit();
      } else {
        // Fallback: trigger window resize event
        window.dispatchEvent(new Event('resize'));
      }
    }
  }), []); // Empty deps array for stable reference


  // Auto-fit when becoming visible
  useEffect(() => {
    if (isVisible && terminalRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        terminalRef.current?.fit();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isVisible, taskId]);

  // Don't render terminal until WebSocket is connected
  if (!isReady) {
    return (
      <div ref={containerRef} className={`w-full h-full overflow-hidden ${className}`} style={{ display: isVisible ? 'block' : 'none' }}>
        <div className="flex items-center justify-center h-full bg-gray-900">
          <div className="text-gray-400">Connecting to terminal service...</div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`w-full h-full overflow-hidden ${className}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <Terminal
        ref={terminalRef}
        sessionId={shelltenderSessionId}
        onSessionCreated={(sessionId: string) => {
          console.log('[DirectTerminal] Session created:', sessionId);
          onSessionStatus?.('connected');
          // Force prompt display by sending a newline
          setTimeout(() => {
            if (wsService) {
              console.log('[DirectTerminal] Forcing prompt display');
              wsService.send({
                type: 'input',
                sessionId: sessionId,
                data: '\n'
              });
            }
          }, 500);
        }}
        onSessionError={(error: any) => {
          console.error('[DirectTerminal] Session error:', error);
          onSessionStatus?.('error');
        }}
        onSessionDisconnected={() => {
          console.log('[DirectTerminal] Session disconnected');
          onSessionStatus?.('disconnected');
        }}
        cursorStyle="block"
        cursorBlink={false}
      />
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

export const DirectTerminal = DirectTerminalComponent;