import React, { useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { Terminal } from '@shelltender/client';
import type { TerminalHandle } from '@shelltender/client';

export type DirectTerminalHandle = {
  focus: () => void;
  fit: () => void;
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
  const terminalRef = useRef<TerminalHandle>(null);

  // Expose both focus and fit methods to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      console.log('[DirectTerminal] Focus called for task:', taskId, { hasRef: !!terminalRef.current });
      terminalRef.current?.focus();
    },
    fit: () => {
      console.log('[DirectTerminal] Fit called for task:', taskId, { hasRef: !!terminalRef.current });
      terminalRef.current?.fit();
    }
  }), []); // Empty deps - methods are stable


  // Auto-fit when becoming visible
  useEffect(() => {
    if (isVisible) {
      // Try multiple times to get the ref
      const attempts = [50, 200, 500, 1000];
      const timers: NodeJS.Timeout[] = [];
      
      attempts.forEach(delay => {
        const timer = setTimeout(() => {
          console.log(`[DirectTerminal] Checking ref after ${delay}ms:`, {
            taskId,
            hasRef: !!terminalRef.current,
            hasFocus: !!terminalRef.current?.focus,
            hasFit: !!terminalRef.current?.fit
          });
          if (terminalRef.current) {
            console.log('[DirectTerminal] Auto-fitting terminal for task:', taskId);
            terminalRef.current.fit();
            // Clear remaining timers
            timers.forEach(t => clearTimeout(t));
          }
        }, delay);
        timers.push(timer);
      });
      
      return () => timers.forEach(timer => clearTimeout(timer));
    }
  }, [isVisible, taskId]);

  console.log('[DirectTerminal] Rendering terminal for task:', taskId, 'sessionId:', terminalSessionId);

  return (
    <div className={`w-full h-full overflow-hidden ${className}`} style={{ display: isVisible ? 'block' : 'none' }}>
      <Terminal
        ref={(el) => {
          console.log('[DirectTerminal] Terminal ref callback:', { 
            taskId, 
            el, 
            hasRef: !!el,
            hasFocus: !!el?.focus,
            hasFit: !!el?.fit
          });
          terminalRef.current = el;
        }}
        sessionId={terminalSessionId}
        onSessionCreated={(newSessionId: string) => {
          console.log('[DirectTerminal] Session created:', newSessionId);
          // Auto-focus new terminals
          setTimeout(() => {
            console.log('[DirectTerminal] Attempting focus after session created', {
              hasRef: !!terminalRef.current,
              hasFocus: !!terminalRef.current?.focus
            });
            terminalRef.current?.focus();
          }, 100);
        }}
        // New v0.4.0+ customization options
        fontSize={14}
        fontFamily="'JetBrains Mono', 'Cascadia Code', Consolas, Monaco, monospace"
        theme={{ 
          background: '#1e1e1e',
          foreground: '#d4d4d4',
          cursor: '#ffffff',
          selection: '#3a3d41'
        }}
        padding={{ left: 12, right: 4 }}
        cursorStyle="block"
        cursorBlink={true}
        scrollback={10000}
        debug={true}
      />
    </div>
  );
});

DirectTerminalComponent.displayName = 'DirectTerminal';

export const DirectTerminal = DirectTerminalComponent;