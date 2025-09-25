/**
 * Deep Module Terminal Store
 * 
 * This is a refactored version of terminalStore following Ousterhout's deep module principles.
 * The interface is reduced from 34+ methods to 8 high-level operations that hide implementation complexity.
 * 
 * Key improvements:
 * - Simple interface: 8 methods vs 34+ methods
 * - Hidden complexity: Map structure invisible to consumers
 * - Atomic operations: Actions are complete, not multi-step
 * - Business concepts: Operations match domain language
 * - Easy testing: Mock 8 operations instead of 34+
 * - Change resilience: Can optimize internals without breaking consumers
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Map/Set support in Immer
enableMapSet();

// Domain types
export interface Terminal {
  normalizedId: string;  // Primary identifier used throughout the app
  sessionId: string;
  dbSessionId: string;
  tabName: string;
  tabOrder: number;
  aiState?: 'idle' | 'working' | 'waiting' | 'not-started';
  isActive?: boolean;
  createdAt?: string;
  lastActivity?: string;
  hasFocus?: boolean;
}

// High-level action types that encapsulate complex operations
export type TerminalAction = 
  | { type: 'create'; config: TerminalConfig }
  | { type: 'update'; updates: Partial<Terminal> }
  | { type: 'remove' }
  | { type: 'rename'; name: string }
  | { type: 'reorder'; order: number }
  | { type: 'state-change'; aiState: Terminal['aiState'] }
  | { type: 'set-focus'; focus: boolean };

export interface TerminalConfig {
  normalizedId: string;
  sessionId: string;
  dbSessionId: string;
  tabName: string;
  tabOrder?: number;
  aiState?: Terminal['aiState'];
  autoFocus?: boolean;
  disposalCallback?: () => void;
}

// Rich return type encapsulates multiple current getters
export interface TaskTerminalState {
  terminals: Terminal[];
  activeTerminal: Terminal | null;
  focusedTerminal: Terminal | null;
  loading: boolean;
}

// Deep module interface - only 8 public methods
interface TerminalStore {
  // Task lifecycle (replaces 6 methods)
  initializeTask(taskId: string, terminals: Terminal[]): void;
  disposeTask(taskId: string): void;
  
  // Terminal management (replaces 12 methods)
  updateTerminal(taskId: string, terminalId: string, action: TerminalAction): void;
  
  // State queries (replaces 10 methods)  
  getTaskState(taskId: string): TaskTerminalState;
  getActiveTerminal(taskId: string): Terminal | undefined;
  
  // Navigation (replaces 4 methods)
  setActiveTerminal(taskId: string, terminalId: string): void;
  
  // Global operations (replaces 2 methods)
  reset(): void;
  isLoading(taskId: string): boolean;
}

// Private implementation state (hidden from consumers)
interface TerminalStoreImpl extends TerminalStore {
  // Hidden state - implementation details
  _terminals: Map<string, Map<string, Terminal>>;
  _activeTerminals: Map<string, string>;
  _focusedTerminals: Map<string, string>;  
  _loadingStates: Map<string, boolean>;
  _disposalCallbacks: Map<string, () => void>;
}

// Helper to convert Map to sorted array (hidden implementation detail)
const mapToSortedArray = (terminalMap: Map<string, Terminal> | undefined): Terminal[] => {
  if (!terminalMap) return [];
  return Array.from(terminalMap.values()).sort((a, b) => a.tabOrder - b.tabOrder);
};

// Create the deep module store
export const useTerminalStore = create<TerminalStoreImpl>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Hidden state
        _terminals: new Map(),
        _activeTerminals: new Map(),
        _focusedTerminals: new Map(),
        _loadingStates: new Map(),
        _disposalCallbacks: new Map(),
        
        // Simple public interface
        
        initializeTask: (taskId, terminals) => {
          set(state => {
            // Clear any existing terminals for this task
            const existingTerminals = state._terminals.get(taskId);
            if (existingTerminals) {
              existingTerminals.forEach(terminal => {
                const dispose = state._disposalCallbacks.get(terminal.dbSessionId);
                if (dispose) {
                  dispose();
                  state._disposalCallbacks.delete(terminal.dbSessionId);
                }
              });
            }
            
            // Set up new terminals
            const taskTerminals = new Map<string, Terminal>();
            terminals.forEach(terminal => {
              // Use normalizedId as the key if available, fallback to dbSessionId
              const key = terminal.normalizedId || terminal.dbSessionId;
              taskTerminals.set(key, terminal);
            });
            state._terminals.set(taskId, taskTerminals);
            
            // Set first terminal as active if none selected
            if (terminals.length > 0 && !state._activeTerminals.has(taskId)) {
              const firstTerminal = terminals[0];
              const activeId = firstTerminal.normalizedId || firstTerminal.dbSessionId;
              state._activeTerminals.set(taskId, activeId);
            }
            
            // Clear loading state
            state._loadingStates.delete(taskId);
          });
        },
        
        disposeTask: (taskId) => {
          set(state => {
            // Dispose all terminals for this task
            const taskTerminals = state._terminals.get(taskId);
            if (taskTerminals) {
              taskTerminals.forEach(terminal => {
                const dispose = state._disposalCallbacks.get(terminal.dbSessionId);
                if (dispose) {
                  dispose();
                  state._disposalCallbacks.delete(terminal.dbSessionId);
                }
              });
            }
            
            // Clean up all task state
            state._terminals.delete(taskId);
            state._activeTerminals.delete(taskId);
            state._focusedTerminals.delete(taskId);
            state._loadingStates.delete(taskId);
          });
        },
        
        updateTerminal: (taskId, terminalId, action) => {
          set(state => {
            let taskTerminals = state._terminals.get(taskId);
            if (!taskTerminals) {
              if (action.type === 'create') {
                // Initialize task if needed for create action
                taskTerminals = new Map();
                state._terminals.set(taskId, taskTerminals);
              } else {
                return; // Can't update non-existent task
              }
            }
            
            switch (action.type) {
              case 'create': {
                const { config } = action;
                const terminal: Terminal = {
                  sessionId: config.sessionId,
                  dbSessionId: config.dbSessionId,
                  tabName: config.tabName,
                  tabOrder: config.tabOrder ?? taskTerminals.size,
                  aiState: config.aiState ?? 'not-started',
                  isActive: false,
                  createdAt: new Date().toISOString(),
                  hasFocus: config.autoFocus ?? false
                };
                
                taskTerminals.set(terminal.dbSessionId, terminal);
                
                // Register disposal callback if provided
                if (config.disposalCallback) {
                  state._disposalCallbacks.set(terminal.dbSessionId, config.disposalCallback);
                }
                
                // Set as active if first terminal or autoFocus
                if (taskTerminals.size === 1 || config.autoFocus) {
                  state._activeTerminals.set(taskId, terminal.dbSessionId);
                }
                
                // Set focus if requested
                if (config.autoFocus) {
                  // Clear focus from others
                  taskTerminals.forEach(t => { t.hasFocus = false; });
                  terminal.hasFocus = true;
                  state._focusedTerminals.set(taskId, terminal.dbSessionId);
                }
                break;
              }
              
              case 'update': {
                const terminal = taskTerminals.get(terminalId);
                if (terminal) {
                  Object.assign(terminal, action.updates);
                  terminal.lastActivity = new Date().toISOString();
                }
                break;
              }
              
              case 'remove': {
                // Dispose the terminal
                const dispose = state._disposalCallbacks.get(terminalId);
                if (dispose) {
                  dispose();
                  state._disposalCallbacks.delete(terminalId);
                }
                
                taskTerminals.delete(terminalId);
                
                // Update active/focused if needed
                const activeId = state._activeTerminals.get(taskId);
                const focusedId = state._focusedTerminals.get(taskId);
                
                if (activeId === terminalId || focusedId === terminalId) {
                  const remaining = mapToSortedArray(taskTerminals);
                  if (remaining.length > 0) {
                    const newActive = remaining[0].dbSessionId;
                    if (activeId === terminalId) {
                      state._activeTerminals.set(taskId, newActive);
                    }
                    if (focusedId === terminalId) {
                      state._focusedTerminals.set(taskId, newActive);
                      remaining[0].hasFocus = true;
                    }
                  } else {
                    state._activeTerminals.delete(taskId);
                    state._focusedTerminals.delete(taskId);
                  }
                }
                
                // Clean up empty task
                if (taskTerminals.size === 0) {
                  state._terminals.delete(taskId);
                }
                break;
              }
              
              case 'rename': {
                const terminal = taskTerminals.get(terminalId);
                if (terminal) {
                  terminal.tabName = action.name;
                }
                break;
              }
              
              case 'reorder': {
                const terminal = taskTerminals.get(terminalId);
                if (terminal) {
                  terminal.tabOrder = action.order;
                }
                break;
              }
              
              case 'state-change': {
                const terminal = taskTerminals.get(terminalId);
                if (terminal) {
                  terminal.aiState = action.aiState;
                  terminal.lastActivity = new Date().toISOString();
                }
                break;
              }
              
              case 'set-focus': {
                const terminal = taskTerminals.get(terminalId);
                if (terminal) {
                  if (action.focus) {
                    // Clear focus from others
                    taskTerminals.forEach(t => { t.hasFocus = false; });
                    terminal.hasFocus = true;
                    state._focusedTerminals.set(taskId, terminalId);
                  } else {
                    terminal.hasFocus = false;
                    if (state._focusedTerminals.get(taskId) === terminalId) {
                      state._focusedTerminals.delete(taskId);
                    }
                  }
                }
                break;
              }
            }
          });
        },
        
        getTaskState: (taskId) => {
          const taskTerminals = get()._terminals.get(taskId);
          const terminals = mapToSortedArray(taskTerminals);
          const activeId = get()._activeTerminals.get(taskId);
          const focusedId = get()._focusedTerminals.get(taskId);
          
          return {
            terminals,
            activeTerminal: terminals.find(t => t.dbSessionId === activeId) || null,
            focusedTerminal: terminals.find(t => t.dbSessionId === focusedId) || null,
            loading: get()._loadingStates.get(taskId) || false
          };
        },
        
        getActiveTerminal: (taskId) => {
          const activeId = get()._activeTerminals.get(taskId);
          if (activeId) {
            return get()._terminals.get(taskId)?.get(activeId);
          }
          return undefined;
        },
        
        setActiveTerminal: (taskId, terminalId) => {
          set(state => {
            const taskTerminals = state._terminals.get(taskId);
            if (taskTerminals?.has(terminalId)) {
              state._activeTerminals.set(taskId, terminalId);
            }
          });
        },
        
        reset: () => {
          set(state => {
            // Dispose all terminals
            state._terminals.forEach(taskTerminals => {
              taskTerminals.forEach(terminal => {
                const dispose = state._disposalCallbacks.get(terminal.dbSessionId);
                if (dispose) {
                  dispose();
                }
              });
            });
            
            // Clear all state
            state._terminals.clear();
            state._activeTerminals.clear();
            state._focusedTerminals.clear();
            state._loadingStates.clear();
            state._disposalCallbacks.clear();
          });
        },
        
        isLoading: (taskId) => {
          return get()._loadingStates.get(taskId) || false;
        }
      }))
    ),
    { name: 'terminal-store-deep' }
  )
);

// Non-reactive access
export const terminalStore = useTerminalStore.getState;

// Convenience hooks that work with the deep module interface
export const useTaskTerminals = (taskId: string) => {
  return useTerminalStore(state => state.getTaskState(taskId).terminals);
};

export const useActiveTerminal = (taskId: string) => {
  return useTerminalStore(state => state.getActiveTerminal(taskId));
};

export const useTaskTerminalState = (taskId: string) => {
  return useTerminalStore(state => state.getTaskState(taskId));
};

// Selector hooks for terminal IDs
export const useActiveTerminalId = (taskId: string) => {
  return useTerminalStore(state => {
    const taskState = state.getTaskState(taskId);
    return taskState.activeTerminal?.dbSessionId || taskState.activeTerminal?.sessionId || '';
  });
};

export const useFocusedTerminalId = (taskId: string) => {
  return useTerminalStore(state => {
    const taskState = state.getTaskState(taskId);
    return taskState.focusedTerminal?.dbSessionId || taskState.focusedTerminal?.sessionId || '';
  });
};

// WebSocket integration with deep module
export const handleTerminalWebSocketEvent = (event: string, data: any) => {
  const store = terminalStore();
  
  switch (event) {
    case 'terminal-created': {
      const rawTerminal = data.data?.terminal || data.terminal;
      if (!rawTerminal) return;
      
      const taskId = data.taskId || rawTerminal.task_id || rawTerminal.taskId;
      const terminal: TerminalConfig = {
        sessionId: rawTerminal.session_id || rawTerminal.sessionId,
        dbSessionId: rawTerminal.id || rawTerminal.dbSessionId,
        tabName: rawTerminal.tab_name || rawTerminal.tabName,
        tabOrder: rawTerminal.tab_order ?? rawTerminal.tabOrder ?? 0,
        aiState: rawTerminal.ai_state || rawTerminal.aiState || 'not-started'
      };
      
      store.updateTerminal(taskId, terminal.dbSessionId, {
        type: 'create',
        config: terminal
      });
      break;
    }
    
    case 'terminal-updated': {
      const updateData = data.data || data;
      store.updateTerminal(data.taskId, updateData.dbSessionId, {
        type: 'update',
        updates: updateData.updates
      });
      break;
    }
    
    case 'terminal-deleted': {
      const deleteData = data.data || data;
      const terminalId = deleteData.dbSessionId || deleteData.sessionId;
      store.updateTerminal(data.taskId, terminalId, { type: 'remove' });
      break;
    }
    
    case 'terminal-state-changed': {
      const stateData = data.data || data;
      store.updateTerminal(data.taskId, stateData.dbSessionId, {
        type: 'state-change',
        aiState: stateData.aiState || stateData.state
      });
      break;
    }
    
    case 'terminal-renamed': {
      const renameData = data.data || data;
      store.updateTerminal(data.taskId, renameData.dbSessionId, {
        type: 'rename',
        name: renameData.newName
      });
      break;
    }
    
    case 'terminals-reordered': {
      data.terminals.forEach(({ dbSessionId, tabOrder }: any) => {
        store.updateTerminal(data.taskId, dbSessionId, {
          type: 'reorder',
          order: tabOrder
        });
      });
      break;
    }
  }
};