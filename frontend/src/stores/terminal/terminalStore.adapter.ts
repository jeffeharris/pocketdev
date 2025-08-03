/**
 * Terminal Store Adapter
 * 
 * Provides compatibility layer for migrating from shallow terminalStore (34+ methods)
 * to deep terminalStore (8 methods). This allows gradual migration of components.
 * 
 * Usage:
 * 1. Import from this adapter instead of terminalStore
 * 2. Components continue to work with old interface
 * 3. Gradually refactor components to use new deep interface
 * 4. Remove adapter once all components migrated
 */

import { useTerminalStore as useDeepStore, terminalStore as deepStore } from './terminalStore.deep';
import type { Terminal, TerminalAction, TerminalConfig } from './terminalStore.deep';

// Create adapter hooks that map old interface to new deep module
export const useTerminalStore = () => {
  const store = useDeepStore();
  
  return {
    // Map old methods to new deep module operations
    setTerminals: (taskId: string, terminals: Terminal[]) => {
      store.initializeTask(taskId, terminals);
    },
    
    addTerminal: (taskId: string, terminal: Terminal) => {
      const config: TerminalConfig = {
        sessionId: terminal.sessionId,
        dbSessionId: terminal.dbSessionId,
        tabName: terminal.tabName,
        tabOrder: terminal.tabOrder,
        aiState: terminal.aiState,
        autoFocus: terminal.hasFocus
      };
      
      store.updateTerminal(taskId, terminal.dbSessionId, {
        type: 'create',
        config
      });
    },
    
    updateTerminal: (taskId: string, dbSessionId: string, updates: Partial<Terminal>) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'update',
        updates
      });
    },
    
    removeTerminal: (taskId: string, dbSessionId: string) => {
      store.updateTerminal(taskId, dbSessionId, { type: 'remove' });
    },
    
    setActiveTerminal: (taskId: string, dbSessionId: string) => {
      store.setActiveTerminal(taskId, dbSessionId);
    },
    
    setFocusedTerminal: (taskId: string, dbSessionId: string) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'set-focus',
        focus: true
      });
    },
    
    clearTaskTerminals: (taskId: string) => {
      store.disposeTask(taskId);
    },
    
    setLoading: (taskId: string, loading: boolean) => {
      // Note: Loading state is now managed internally by the deep module
      // This is a no-op for compatibility
      console.warn('setLoading is deprecated in deep terminalStore');
    },
    
    registerDisposal: (dbSessionId: string, callback: () => void) => {
      // Note: Disposal callbacks should now be passed in terminal config
      console.warn('registerDisposal is deprecated - pass disposal callback in terminal config');
    },
    
    disposeTerminal: (dbSessionId: string) => {
      // Note: Use removeTerminal instead
      console.warn('disposeTerminal is deprecated - use removeTerminal');
    },
    
    updateTerminalState: (taskId: string, dbSessionId: string, aiState: Terminal['aiState']) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'state-change',
        aiState
      });
    },
    
    renameTerminal: (taskId: string, dbSessionId: string, newName: string) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'rename',
        name: newName
      });
    },
    
    reorderTerminals: (taskId: string, terminals: Array<{ dbSessionId: string; tabOrder: number }>) => {
      terminals.forEach(({ dbSessionId, tabOrder }) => {
        store.updateTerminal(taskId, dbSessionId, {
          type: 'reorder',
          order: tabOrder
        });
      });
    },
    
    // Selectors map directly to new interface
    getTerminals: (taskId: string) => store.getTaskState(taskId).terminals,
    getTerminal: (taskId: string, dbSessionId: string) => {
      const terminals = store.getTaskState(taskId).terminals;
      return terminals.find(t => t.dbSessionId === dbSessionId);
    },
    getActiveTerminal: (taskId: string) => store.getActiveTerminal(taskId),
    getActiveTerminalId: (taskId: string) => store.getActiveTerminal(taskId)?.dbSessionId,
    getFocusedTerminal: (taskId: string) => store.getTaskState(taskId).focusedTerminal || undefined,
    getFocusedTerminalId: (taskId: string) => store.getTaskState(taskId).focusedTerminal?.dbSessionId,
    isLoading: (taskId: string) => store.isLoading(taskId)
  };
};

// Export convenience hooks that work with both interfaces
export { 
  useTaskTerminals,
  useActiveTerminal,
  useTaskTerminalState
} from './terminalStore.deep';

// Additional adapter hooks for old interface
export const useActiveTerminalId = (taskId: string) => {
  const terminal = useDeepStore(state => state.getActiveTerminal(taskId));
  return terminal?.dbSessionId;
};

export const useFocusedTerminal = (taskId: string) => {
  const state = useDeepStore(state => state.getTaskState(taskId));
  return state.focusedTerminal || undefined;
};

export const useFocusedTerminalId = (taskId: string) => {
  const state = useDeepStore(state => state.getTaskState(taskId));
  return state.focusedTerminal?.dbSessionId;
};

export const useTerminalLoading = (taskId: string) => {
  return useDeepStore(state => state.isLoading(taskId));
};

// Export non-reactive access
export const terminalStore = () => {
  const store = deepStore();
  
  return {
    // Wrap methods for compatibility
    setTerminals: (taskId: string, terminals: Terminal[]) => {
      store.initializeTask(taskId, terminals);
    },
    
    addTerminal: (taskId: string, terminal: Terminal) => {
      const config: TerminalConfig = {
        sessionId: terminal.sessionId,
        dbSessionId: terminal.dbSessionId,
        tabName: terminal.tabName,
        tabOrder: terminal.tabOrder,
        aiState: terminal.aiState,
        autoFocus: terminal.hasFocus
      };
      
      store.updateTerminal(taskId, terminal.dbSessionId, {
        type: 'create',
        config
      });
    },
    
    updateTerminal: (taskId: string, dbSessionId: string, updates: Partial<Terminal>) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'update',
        updates
      });
    },
    
    removeTerminal: (taskId: string, dbSessionId: string) => {
      store.updateTerminal(taskId, dbSessionId, { type: 'remove' });
    },
    
    updateTerminalState: (taskId: string, dbSessionId: string, aiState: Terminal['aiState']) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'state-change',
        aiState
      });
    },
    
    renameTerminal: (taskId: string, dbSessionId: string, newName: string) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'rename',
        name: newName
      });
    },
    
    reorderTerminals: (taskId: string, terminals: Array<{ dbSessionId: string; tabOrder: number }>) => {
      terminals.forEach(({ dbSessionId, tabOrder }) => {
        store.updateTerminal(taskId, dbSessionId, {
          type: 'reorder',
          order: tabOrder
        });
      });
    },
    
    // Additional methods for compatibility
    setActiveTerminal: (taskId: string, dbSessionId: string) => {
      store.setActiveTerminal(taskId, dbSessionId);
    },
    
    setFocusedTerminal: (taskId: string, dbSessionId: string) => {
      store.updateTerminal(taskId, dbSessionId, {
        type: 'set-focus',
        focus: true
      });
    },
    
    clearTaskTerminals: (taskId: string) => {
      store.disposeTask(taskId);
    },
    
    setLoading: (taskId: string, loading: boolean) => {
      // Note: Loading state is now managed internally by the deep module
      console.warn('setLoading is deprecated in deep terminalStore');
    },
    
    registerDisposal: (dbSessionId: string, callback: () => void) => {
      // Note: Disposal callbacks should now be passed in terminal config
      console.warn('registerDisposal is deprecated - pass disposal callback in terminal config');
    },
    
    disposeTerminal: (dbSessionId: string) => {
      // Note: Use removeTerminal instead
      console.warn('disposeTerminal is deprecated - use removeTerminal');
    },
    
    // Include all getters for compatibility
    getTerminals: (taskId: string) => store.getTaskState(taskId).terminals,
    getTerminal: (taskId: string, dbSessionId: string) => {
      const terminals = store.getTaskState(taskId).terminals;
      return terminals.find(t => t.dbSessionId === dbSessionId);
    },
    getActiveTerminal: (taskId: string) => store.getActiveTerminal(taskId),
    getActiveTerminalId: (taskId: string) => store.getActiveTerminal(taskId)?.dbSessionId,
    getFocusedTerminal: (taskId: string) => store.getTaskState(taskId).focusedTerminal || undefined,
    getFocusedTerminalId: (taskId: string) => store.getTaskState(taskId).focusedTerminal?.dbSessionId,
    isLoading: (taskId: string) => store.isLoading(taskId)
  };
};

// Add getState static method for compatibility with old usage pattern
(useTerminalStore as any).getState = () => terminalStore();

// Re-export WebSocket handler
export { handleTerminalWebSocketEvent } from './terminalStore.deep';
export type { Terminal } from './terminalStore.deep';