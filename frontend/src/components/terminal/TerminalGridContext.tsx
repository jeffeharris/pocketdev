/**
 * TerminalGridContext - Shared context for terminal grid components
 * 
 * Reduces prop drilling by providing common values through context.
 * This simplifies the TerminalGrid interface from 16+ props to ~6 props.
 */

import { createContext, useContext, type ReactNode } from 'react';
import type { Task, TerminalSession } from '../../types/task';
import type { DirectTerminalHandle } from './DirectTerminal';

interface TerminalGridContextValue {
  // Core data
  task: Task;
  terminals: TerminalSession[];
  activeTabId: string;
  
  // State
  isVisible: boolean;
  focusedTerminalId: string | null;
  isResetting: boolean;
  
  // Refs
  terminalRefs: React.MutableRefObject<Map<string, DirectTerminalHandle>>;
  
  // Callbacks
  onSessionStatus: (dbSessionId: string, status: 'connected' | 'disconnected' | 'error') => void;
  onFocusRequest: (terminalId: string) => void;
  onResetStateChange: (isResetting: boolean) => void;
}

const TerminalGridContext = createContext<TerminalGridContextValue | null>(null);

export function useTerminalGridContext() {
  const context = useContext(TerminalGridContext);
  if (!context) {
    throw new Error('useTerminalGridContext must be used within TerminalGridProvider');
  }
  return context;
}

interface TerminalGridProviderProps {
  value: TerminalGridContextValue;
  children: ReactNode;
}

export function TerminalGridProvider({ value, children }: TerminalGridProviderProps) {
  return (
    <TerminalGridContext.Provider value={value}>
      {children}
    </TerminalGridContext.Provider>
  );
}