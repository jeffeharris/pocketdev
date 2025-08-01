import { useRef, forwardRef, useImperativeHandle, useEffect, useState, memo } from 'react';
import { Terminal, useWebSocket } from '@shelltender/client';
import type { TerminalHandle } from '@shelltender/client';

// Debug wrapper to intercept WebSocket messages
const DebugTerminal = memo<{ 
  sessionId: string;
  onSessionCreated?: (id: string) => void;
  onSessionError?: (error: any) => void;
  onSessionDisconnected?: () => void;
  terminalRef: any;
}>(({ sessionId, onSessionCreated, onSessionError, onSessionDisconnected, terminalRef }) => {
  useEffect(() => {
    console.log('[DirectTerminalDebug] Mounting terminal with sessionId:', sessionId);
    
    // Add WebSocket message interceptor
    const originalSend = WebSocket.prototype.send;
    const originalOnMessage = Object.getOwnPropertyDescriptor(WebSocket.prototype, 'onmessage');
    
    WebSocket.prototype.send = function(data) {
      console.log('[DirectTerminalDebug] WS Send:', data);
      return originalSend.call(this, data);
    };
    
    Object.defineProperty(WebSocket.prototype, 'onmessage', {
      set: function(handler) {
        this._onmessage = handler;
        this.addEventListener('message', function(event) {
          try {
            const data = JSON.parse(event.data);
            console.log('[DirectTerminalDebug] WS Receive:', data);
            
            // Check for connect message with scrollback
            if (data.type === 'connect') {
              console.log('[DirectTerminalDebug] Connect response:', {
                hasIncrementalData: !!data.incrementalData,
                hasScrollback: !!data.scrollback,
                scrollbackLength: data.scrollback?.length,
                lastSequence: data.lastSequence
              });
            }
          } catch (e) {
            console.log('[DirectTerminalDebug] WS Receive (non-JSON):', event.data);
          }
          
          if (this._onmessage) {
            this._onmessage(event);
          }
        });
      },
      get: function() {
        return this._onmessage;
      }
    });
    
    return () => {
      // Restore original methods
      WebSocket.prototype.send = originalSend;
      if (originalOnMessage) {
        Object.defineProperty(WebSocket.prototype, 'onmessage', originalOnMessage);
      }
    };
  }, [sessionId]);
  
  return (
    <Terminal
      ref={terminalRef}
      sessionId={sessionId}
      onSessionCreated={(id) => {
        console.log('[DirectTerminalDebug] Session created:', id);
        onSessionCreated?.(id);
      }}
      onSessionError={(error) => {
        console.log('[DirectTerminalDebug] Session error:', error);
        onSessionError?.(error);
      }}
      onSessionDisconnected={() => {
        console.log('[DirectTerminalDebug] Session disconnected');
        onSessionDisconnected?.();
      }}
      cursorStyle="block"
      cursorBlink={false}
      useIncrementalUpdates={true}
    />
  );
}, (prevProps, nextProps) => {
  return prevProps.sessionId === nextProps.sessionId;
});

export interface DirectTerminalHandle {
  focus: () => void;
  fit: () => void;
}

interface DirectTerminalDebugProps {
  taskId: string;
  dbSessionId: string;
  shelltenderSessionId: string;
  className?: string;
  worktreePath?: string;
  isVisible?: boolean;
  onSessionStatus?: (status: 'connected' | 'disconnected' | 'error') => void;
}

const DirectTerminalDebugComponent = forwardRef<DirectTerminalHandle, DirectTerminalDebugProps>(({ 
  taskId, 
  dbSessionId,
  shelltenderSessionId,
  className = '',
  worktreePath: _worktreePath,
  isVisible = true,
  onSessionStatus
}, ref) => {
  const { isConnected, wsService } = useWebSocket();
  const [isReady, setIsReady] = useState(false);
  const terminalRef = useRef<TerminalHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [terminalCreated, setTerminalCreated] = useState(false);

  useEffect(() => {
    if (isConnected) {
      console.log('[DirectTerminalDebug] WebSocket connected, setting ready');
      setIsReady(true);
    }
  }, [isConnected, shelltenderSessionId]);

  useImperativeHandle(ref, () => ({
    focus: () => {
      if (!isVisible) return;
      
      if (terminalRef.current?.focus) {
        terminalRef.current.focus();
      } else {
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
        window.dispatchEvent(new Event('resize'));
      }
    }
  }), [isVisible, dbSessionId]);

  useEffect(() => {
    if (isVisible && terminalRef.current) {
      const timer = setTimeout(() => {
        terminalRef.current?.fit();
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
    } else if (!isVisible) {
      const xtermTextarea = containerRef.current?.querySelector('.xterm-helper-textarea') as HTMLTextAreaElement;
      if (xtermTextarea && document.activeElement === xtermTextarea) {
        xtermTextarea.blur();
      }
    }
  }, [isVisible, taskId]);

  if (!isReady) {
    console.log('[DirectTerminalDebug] Not ready, showing loading state');
    return (
      <div 
        ref={containerRef} 
        className={`w-full h-full overflow-hidden ${className}`} 
        style={{ 
          visibility: isVisible ? 'visible' : 'hidden',
          height: '100%',
          position: isVisible ? 'relative' : 'absolute',
          width: '100%'
        }}
      >
        <div className="flex items-center justify-center h-full bg-gray-900">
          <div className="text-gray-400">Connecting to terminal service...</div>
        </div>
      </div>
    );
  }

  console.log('[DirectTerminalDebug] Rendering terminal for sessionId:', shelltenderSessionId);
  
  return (
    <div 
      ref={containerRef} 
      className={`w-full h-full overflow-hidden ${className}`} 
      style={{ 
        visibility: isVisible ? 'visible' : 'hidden',
        height: '100%',
        position: isVisible ? 'relative' : 'absolute',
        width: '100%'
      }}
    >
      <DebugTerminal
        terminalRef={terminalRef}
        sessionId={shelltenderSessionId}
        onSessionCreated={(sessionId: string) => {
          onSessionStatus?.('connected');
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

DirectTerminalDebugComponent.displayName = 'DirectTerminalDebug';

export const DirectTerminalDebug = memo(DirectTerminalDebugComponent, (prevProps, nextProps) => {
  const isEqual = (
    prevProps.taskId === nextProps.taskId &&
    prevProps.dbSessionId === nextProps.dbSessionId &&
    prevProps.shelltenderSessionId === nextProps.shelltenderSessionId &&
    prevProps.worktreePath === nextProps.worktreePath
  );
  
  return isEqual;
});