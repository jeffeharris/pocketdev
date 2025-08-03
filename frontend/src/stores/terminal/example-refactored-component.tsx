/**
 * Example: TerminalPanel refactored to use Deep Module
 * 
 * This demonstrates how to refactor a component from the shallow
 * terminalStore (34+ methods) to the deep terminalStore (8 methods).
 * 
 * Key improvements:
 * - Reduced from 6 method calls to 2 for terminal creation
 * - Single state query instead of multiple getters
 * - Atomic operations instead of multi-step processes
 * - Cleaner, more maintainable code
 */

import React, { useEffect, useRef } from 'react';
import { useTerminalStore, useTaskTerminalState } from './terminalStore.deep';
import type { Task } from '../../types/task';

interface RefactoredTerminalPanelProps {
  task: Task;
}

export function RefactoredTerminalPanel({ task }: RefactoredTerminalPanelProps) {
  const store = useTerminalStore();
  
  // DEEP MODULE: Single state query replaces multiple hooks
  const { terminals, activeTerminal, focusedTerminal, loading } = useTaskTerminalState(task.id);
  
  // DEEP MODULE: Simple initialization
  useEffect(() => {
    if (task.terminals && task.terminals.length > 0) {
      store.initializeTask(task.id, task.terminals);
    }
    
    // Cleanup on unmount
    return () => {
      store.disposeTask(task.id);
    };
  }, [task.id]);
  
  // DEEP MODULE: Create terminal with single atomic operation
  const handleCreateTerminal = async (sessionId: string, name: string) => {
    const terminalId = `term-${Date.now()}`;
    
    store.updateTerminal(task.id, terminalId, {
      type: 'create',
      config: {
        sessionId,
        dbSessionId: terminalId,
        tabName: name,
        tabOrder: terminals.length,
        aiState: 'not-started',
        autoFocus: true,
        disposalCallback: () => {
          console.log(`Cleaning up terminal ${terminalId}`);
        }
      }
    });
  };
  
  // DEEP MODULE: Update terminal with typed actions
  const handleTerminalStateChange = (terminalId: string, newState: 'idle' | 'working' | 'waiting') => {
    store.updateTerminal(task.id, terminalId, {
      type: 'state-change',
      aiState: newState
    });
  };
  
  // DEEP MODULE: Remove terminal with automatic cleanup
  const handleRemoveTerminal = (terminalId: string) => {
    store.updateTerminal(task.id, terminalId, { type: 'remove' });
  };
  
  // DEEP MODULE: Rename with specific action
  const handleRenameTerminal = (terminalId: string, newName: string) => {
    store.updateTerminal(task.id, terminalId, {
      type: 'rename',
      name: newName
    });
  };
  
  // DEEP MODULE: Reorder terminals
  const handleReorderTerminals = (reorderedTerminals: Array<{ id: string; order: number }>) => {
    reorderedTerminals.forEach(({ id, order }) => {
      store.updateTerminal(task.id, id, {
        type: 'reorder',
        order
      });
    });
  };
  
  if (loading) {
    return <div>Loading terminals...</div>;
  }
  
  return (
    <div className="terminal-panel">
      <div className="terminal-tabs">
        {terminals.map(terminal => (
          <button
            key={terminal.dbSessionId}
            className={`tab ${terminal.dbSessionId === activeTerminal?.dbSessionId ? 'active' : ''}`}
            onClick={() => store.setActiveTerminal(task.id, terminal.dbSessionId)}
          >
            {terminal.tabName}
            <span className={`status ${terminal.aiState}`} />
          </button>
        ))}
        <button onClick={() => handleCreateTerminal('new-session', 'New Terminal')}>
          + Add Terminal
        </button>
      </div>
      
      <div className="terminal-content">
        {activeTerminal && (
          <div>
            <h3>{activeTerminal.tabName}</h3>
            <p>State: {activeTerminal.aiState}</p>
            <p>Session: {activeTerminal.sessionId}</p>
            <button onClick={() => handleRemoveTerminal(activeTerminal.dbSessionId)}>
              Close Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Comparison with Shallow Module Usage:
 * 
 * BEFORE (Shallow - 34+ methods):
 * ```
 * const store = useTerminalStore();
 * const terminals = useTaskTerminals(task.id);
 * const activeTerminalId = useActiveTerminalId(task.id);
 * const activeTerminal = useActiveTerminal(task.id);
 * const focusedTerminal = useFocusedTerminal(task.id);
 * const loading = useTerminalLoading(task.id);
 * 
 * // Create terminal - 6 method calls
 * store.addTerminal(task.id, terminal);
 * store.setActiveTerminal(task.id, terminal.dbSessionId);
 * store.setFocusedTerminal(task.id, terminal.dbSessionId);
 * store.registerDisposal(terminal.dbSessionId, cleanup);
 * store.setLoading(task.id, false);
 * const active = store.getActiveTerminal(task.id);
 * ```
 * 
 * AFTER (Deep - 8 methods):
 * ```
 * const store = useTerminalStore();
 * const { terminals, activeTerminal, focusedTerminal, loading } = useTaskTerminalState(task.id);
 * 
 * // Create terminal - 1 method call
 * store.updateTerminal(task.id, terminalId, {
 *   type: 'create',
 *   config: { ...config, autoFocus: true, disposalCallback: cleanup }
 * });
 * ```
 */