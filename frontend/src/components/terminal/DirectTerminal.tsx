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
  containerReady: boolean;
}>(({ sessionId, onSessionCreated, onSessionError, onSessionDisconnected, terminalRef, containerReady }) => {
  const [delayedMount, setDelayedMount] = useState(false);
  
  // Delay mounting the terminal until after the container is ready
  useEffect(() => {
    if (containerReady) {
      // Use requestAnimationFrame to ensure DOM is painted
      const frame = requestAnimationFrame(() => {
        setDelayedMount(true);
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [containerReady]);
  
  if (!delayedMount) {
    return null;
  }
  
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
  // Only re-render if sessionId or containerReady changes
  return prevProps.sessionId === nextProps.sessionId && 
         prevProps.containerReady === nextProps.containerReady;
});

export interface DirectTerminalHandle {
  focus: () => void;
  fit: () => void;
  refresh: () => void;
}

interface DirectTerminalProps {
  taskId: string;
  dbSessionId: string;          // Database session ID
  shelltenderSessionId: string; // Actual Shelltender session ID to connect to
  className?: string;
  worktreePath?: string;
  isVisible?: boolean;
  hasFocus?: boolean;
  onSessionStatus?: (status: 'connected' | 'disconnected' | 'error') => void;
  onFocusRequest?: () => void;
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
  
  // Force re-render counter to trigger reconnection
  const [reconnectCounter, setReconnectCounter] = useState(0);
  
  // Track container dimensions
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number } | null>(null);

  // Monitor container dimensions
  useEffect(() => {
    if (containerRef.current) {
      const updateDimensions = () => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (rect && rect.width > 0 && rect.height > 0) {
          setContainerDimensions({ width: rect.width, height: rect.height });
        }
      };
      
      // Initial check
      updateDimensions();
      
      // Use ResizeObserver to detect size changes
      const resizeObserver = new ResizeObserver(updateDimensions);
      resizeObserver.observe(containerRef.current);
      
      return () => {
        resizeObserver.disconnect();
      };
    }
  }, []);

  // Update ready state when connected AND container has dimensions
  useEffect(() => {
    if (isConnected && containerDimensions) {
      setIsReady(true);
    }
  }, [isConnected, shelltenderSessionId, containerDimensions]);

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
    },
    refresh: async () => {
      // Ensure WebSocket is connected first
      if (!isConnected && wsService?.connect) {
        await wsService.connect();
        // Wait a bit for connection to establish
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Force the terminal to reconnect by incrementing the counter
      // This will cause the Terminal component to unmount and remount with the same session ID
      setReconnectCounter(prev => prev + 1);
      
      // Mark as not ready temporarily to show connecting state
      setIsReady(false);
      
      // Re-enable after a short delay
      setTimeout(() => {
        setIsReady(true);
        
        // Fit terminal after it's ready
        setTimeout(() => {
          if (terminalRef.current?.fit) {
            terminalRef.current.fit();
          }
        }, 100);
      }, 300);
    }
  }), [dbSessionId, isConnected, wsService]);


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
  
  // Handle reconnection when counter changes
  useEffect(() => {
    if (reconnectCounter > 0 && terminalRef.current) {
      // Wait for the terminal to reconnect and then fit
      const timer = setTimeout(() => {
        terminalRef.current?.fit();
        onSessionStatus?.('connected');
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [reconnectCounter, onSessionStatus]);
  
  // Use capture phase to ensure we get the click event before xterm consumes it
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    
    const handleClickCapture = (e: MouseEvent) => {
      // Check if the click is within the terminal area
      if (container.contains(e.target as Node)) {
        if (onFocusRequest) {
          onFocusRequest();
        }
        
        // Also ensure the terminal itself gets focus
        if (terminalRef.current?.focus) {
          terminalRef.current.focus();
        } else {
          // Fallback for xterm focus
          const xtermTextarea = container.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
          if (xtermTextarea) {
            xtermTextarea.focus();
          }
        }
      }
    };
    
    // Also handle mousedown for more immediate response
    const handleMouseDownCapture = (e: MouseEvent) => {
      if (container.contains(e.target as Node)) {
        if (onFocusRequest) {
          onFocusRequest();
        }
      }
    };
    
    // Add listeners in capture phase
    container.addEventListener('click', handleClickCapture, true);
    container.addEventListener('mousedown', handleMouseDownCapture, true);
    
    return () => {
      container.removeEventListener('click', handleClickCapture, true);
      container.removeEventListener('mousedown', handleMouseDownCapture, true);
    };
  }, [onFocusRequest]);

  // Don't render terminal until WebSocket is connected AND container has dimensions
  if (!isReady || !containerDimensions) {
    return (
      <div 
        ref={containerRef} 
        className={`w-full h-full overflow-hidden ${className}`} 
        style={{ 
          height: '100%',
          width: '100%',
          minHeight: '200px',
          minWidth: '400px'
        }}
      >
        <div className="flex items-center justify-center h-full bg-gray-900">
          <div className="text-gray-400">
            {!isConnected ? 'Connecting to terminal service...' : 'Initializing terminal...'}
          </div>
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
      className={`relative w-full h-full ${className} ${hasFocus ? 'border-2 border-blue-500' : 'border border-gray-600'}`} 
      style={{ 
        height: '100%',
        width: '100%',
        boxSizing: 'border-box',
        minHeight: '200px',
        minWidth: '400px'
      }}
      onClick={handleContainerClick}
    >
      <MemoizedTerminal
        key={`${shelltenderSessionId}-${reconnectCounter}`}
        terminalRef={terminalRef}
        sessionId={shelltenderSessionId}
        containerReady={!!containerDimensions}
        onSessionCreated={(sessionId: string) => {
          onSessionStatus?.('connected');
          // Fit terminal after initialization
          if (terminalRef.current?.fit) {
            terminalRef.current.fit();
          }
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