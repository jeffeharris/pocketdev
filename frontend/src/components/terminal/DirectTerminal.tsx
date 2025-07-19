import { useRef, forwardRef, useImperativeHandle, useEffect, useState } from 'react';
import { Terminal, useWebSocket } from '@shelltender/client';
import type { TerminalHandle } from '@shelltender/client';

export interface DirectTerminalHandle {
  focus: () => void;
  fit: () => void;
}

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
  worktreePath: _worktreePath, // May be used for session initialization in future
  isVisible = true
}, ref) => {
  const { isConnected } = useWebSocket();
  const [isReady, setIsReady] = useState(false);
  const terminalSessionId = sessionId || `task-${taskId}`;
  const terminalRef = useRef<TerminalHandle>(null);
  
  // Container ref for DOM-based fallback
  const containerRef = useRef<HTMLDivElement>(null);

  // Update ready state when connected
  useEffect(() => {
    if (isConnected) {
      setIsReady(true);
    }
  }, [isConnected, terminalSessionId]);

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
        sessionId={terminalSessionId}
        // TODO: These callbacks were commented out to fix TS2322 error
        // Check @shelltender/client v0.6.0 documentation for supported callbacks
        // onSessionCreated={() => {
        //   // Auto-focus new terminals after a delay
        //   setTimeout(() => {
        //     terminalRef.current?.focus();
        //   }, 200);
        // }}
        // onError={(error: any) => {
        //   console.error('[DirectTerminal] Terminal error:', error);
        // }}
        // onReady={() => {
        //   // Terminal is ready
        // }}
        // Terminal customization
        // TODO: These props were commented out to fix TS2322 error
        // Check @shelltender/client v0.6.0 documentation for supported props
        // fontSize={14}
        // fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, monospace"
        // theme={{ 
        //   background: '#1e1e1e',
        //   foreground: '#d4d4d4',
        //   cursor: '#ffffff',
        //   selection: '#3a3d41'
        // }}
        // padding={{ left: 12, right: 4 }}
        cursorStyle="block"
        cursorBlink={false}
        // scrollback={10000}
      />
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

export const DirectTerminal = DirectTerminalComponent;