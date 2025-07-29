import { useRef, forwardRef, useImperativeHandle, useEffect, useState, memo } from 'react';
import { Terminal, useWebSocket } from '@shelltender/client';
import type { TerminalHandle } from '@shelltender/client';

// Memoized Terminal wrapper that only re-renders if sessionId changes
const MemoizedTerminal = memo<{ 
  sessionId: string;
  onSessionCreated?: (id: string) => void;
  onSessionError?: (error: any) => void;
  onSessionDisconnected?: () => void;
  terminalRef: any;
}>(({ sessionId, onSessionCreated, onSessionError, onSessionDisconnected, terminalRef }) => {
  return (
    <Terminal
      ref={terminalRef}
      sessionId={sessionId}
      onSessionCreated={onSessionCreated}
      onSessionError={onSessionError}
      onSessionDisconnected={onSessionDisconnected}
      cursorStyle="block"
      cursorBlink={false}
      useIncrementalUpdates={true}
    />
  );
}, (prevProps, nextProps) => {
  // Only re-render if sessionId changes
  return prevProps.sessionId === nextProps.sessionId;
});

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
  hasFocus = false,
  onSessionStatus,
  onFocusRequest
}, ref) => {
  const { isConnected, wsService } = useWebSocket();
  const [isReady, setIsReady] = useState(false);
  const terminalRef = useRef<TerminalHandle>(null);
  
  // Container ref for DOM-based fallback
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Track if we've already created the terminal to prevent re-creation
  const [terminalCreated, setTerminalCreated] = useState(false);

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
  }), [dbSessionId]);


  // Auto-fit and focus when terminal is ready
  useEffect(() => {
    if (terminalRef.current) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => {
        terminalRef.current?.fit();
        // Auto-focus
        if (terminalRef.current?.focus) {
          terminalRef.current.focus();
        } else {
          const xtermTextarea = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
          if (xtermTextarea) {
            xtermTextarea.focus();
          }
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [taskId, dbSessionId]);
  

  // Don't render terminal until WebSocket is connected
  if (!isReady) {
    return (
      <div 
        ref={containerRef} 
        className={`w-full h-full overflow-hidden ${className}`} 
        style={{ 
          height: '100%',
          width: '100%'
        }}
      >
        <div className="flex items-center justify-center h-full bg-gray-900">
          <div className="text-gray-400">Connecting to terminal service...</div>
        </div>
      </div>
    );
  }

  // Handle click to focus
  const handleContainerClick = () => {
    if (onFocusRequest) {
      onFocusRequest();
    }
  };
  
  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full ${className}`} 
      style={{ 
        height: '100%',
        width: '100%'
      }}
      onClick={handleContainerClick}
    >
      {/* Focus indicator border */}
      <div className={`absolute inset-0 pointer-events-none ${hasFocus ? 'border-2 border-blue-500' : 'border border-gray-600'}`} />
      <MemoizedTerminal
        terminalRef={terminalRef}
        sessionId={shelltenderSessionId}
        onSessionCreated={(sessionId: string) => {
          onSessionStatus?.('connected');
          // Removed - sending newline doesn't actually show prompt
        }}
        onSessionError={(error: any) => {
          onSessionStatus?.('error');
        }}
        onSessionDisconnected={() => {
          onSessionStatus?.('disconnected');
        }}
      />
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

// Memoize the component to prevent unnecessary re-renders
// This prevents the terminal from re-displaying its buffer when parent re-renders
export const DirectTerminal = memo(DirectTerminalComponent, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  const isEqual = (
    prevProps.taskId === nextProps.taskId &&
    prevProps.dbSessionId === nextProps.dbSessionId &&
    prevProps.shelltenderSessionId === nextProps.shelltenderSessionId &&
    prevProps.worktreePath === nextProps.worktreePath &&
    prevProps.hasFocus === nextProps.hasFocus
    // Don't compare isVisible - we want terminals to stay mounted
    // Don't compare onSessionStatus - it's recreated on every render
    // Don't compare onFocusRequest - it's recreated on every render
  );
  
  return isEqual;
});