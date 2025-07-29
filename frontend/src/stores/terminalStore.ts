import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Map/Set support in Immer
enableMapSet();

export interface Terminal {
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

interface TerminalStoreState {
  // State - nested Map for efficient lookups by taskId and terminalId
  terminals: Map<string, Map<string, Terminal>>; // taskId -> dbSessionId -> Terminal
  activeTerminals: Map<string, string>; // taskId -> activeDbSessionId
  focusedTerminals: Map<string, string>; // taskId -> focusedDbSessionId
  loadingStates: Map<string, boolean>; // taskId -> isLoading
  disposalCallbacks: Map<string, () => void>; // dbSessionId -> disposal callback
  
  // Actions
  setTerminals: (taskId: string, terminals: Terminal[]) => void;
  addTerminal: (taskId: string, terminal: Terminal) => void;
  updateTerminal: (taskId: string, dbSessionId: string, updates: Partial<Terminal>) => void;
  removeTerminal: (taskId: string, dbSessionId: string) => void;
  setActiveTerminal: (taskId: string, dbSessionId: string) => void;
  setFocusedTerminal: (taskId: string, dbSessionId: string) => void;
  clearTaskTerminals: (taskId: string) => void;
  setLoading: (taskId: string, loading: boolean) => void;
  registerDisposal: (dbSessionId: string, callback: () => void) => void;
  disposeTerminal: (dbSessionId: string) => void;
  
  // Bulk updates (for WebSocket events)
  updateTerminalState: (taskId: string, dbSessionId: string, aiState: Terminal['aiState']) => void;
  renameTerminal: (taskId: string, dbSessionId: string, newName: string) => void;
  reorderTerminals: (taskId: string, terminals: Array<{ dbSessionId: string; tabOrder: number }>) => void;
  
  // Selectors
  getTerminals: (taskId: string) => Terminal[];
  getTerminal: (taskId: string, dbSessionId: string) => Terminal | undefined;
  getActiveTerminal: (taskId: string) => Terminal | undefined;
  getActiveTerminalId: (taskId: string) => string | undefined;
  getFocusedTerminal: (taskId: string) => Terminal | undefined;
  getFocusedTerminalId: (taskId: string) => string | undefined;
  isLoading: (taskId: string) => boolean;
}

// Helper to convert Map to sorted array
const mapToSortedArray = (terminalMap: Map<string, Terminal> | undefined): Terminal[] => {
  if (!terminalMap) return [];
  return Array.from(terminalMap.values()).sort((a, b) => a.tabOrder - b.tabOrder);
};

export const useTerminalStore = create<TerminalStoreState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        terminals: new Map(),
        activeTerminals: new Map(),
        focusedTerminals: new Map(),
        loadingStates: new Map(),
        disposalCallbacks: new Map(),
        
        setTerminals: (taskId, terminals) => {
          set(state => {
            const taskTerminals = new Map<string, Terminal>();
            terminals.forEach(terminal => {
              // Use dbSessionId as the key for consistency
              taskTerminals.set(terminal.dbSessionId, terminal);
            });
            state.terminals.set(taskId, taskTerminals);
            
            // Set first terminal as active if none selected
            if (!state.activeTerminals.has(taskId) && terminals.length > 0) {
              state.activeTerminals.set(taskId, terminals[0].dbSessionId);
            }
          });
        },
        
        addTerminal: (taskId, terminal) => {
          set(state => {
            let taskTerminals = state.terminals.get(taskId);
            if (!taskTerminals) {
              taskTerminals = new Map();
              state.terminals.set(taskId, taskTerminals);
            }
            taskTerminals.set(terminal.dbSessionId, terminal);
            
            // Set as active if it's the first terminal
            if (taskTerminals.size === 1) {
              state.activeTerminals.set(taskId, terminal.dbSessionId);
            }
          });
        },
        
        updateTerminal: (taskId, dbSessionId, updates) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              const terminal = taskTerminals.get(dbSessionId);
              if (terminal) {
                taskTerminals.set(dbSessionId, { ...terminal, ...updates });
              }
            }
          });
        },
        
        removeTerminal: (taskId, dbSessionId) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              // Dispose the terminal
              const dispose = state.disposalCallbacks.get(dbSessionId);
              if (dispose) {
                dispose();
                state.disposalCallbacks.delete(dbSessionId);
              }
              
              taskTerminals.delete(dbSessionId);
              
              // Update active terminal if removed
              const activeId = state.activeTerminals.get(taskId);
              if (activeId === dbSessionId) {
                const remaining = mapToSortedArray(taskTerminals);
                if (remaining.length > 0) {
                  state.activeTerminals.set(taskId, remaining[0].dbSessionId);
                } else {
                  state.activeTerminals.delete(taskId);
                }
              }
              
              // Update focused terminal if removed
              const focusedId = state.focusedTerminals.get(taskId);
              if (focusedId === dbSessionId) {
                const remaining = mapToSortedArray(taskTerminals);
                if (remaining.length > 0) {
                  state.focusedTerminals.set(taskId, remaining[0].dbSessionId);
                  remaining[0].hasFocus = true;
                } else {
                  state.focusedTerminals.delete(taskId);
                }
              }
              
              // Clean up empty task entries
              if (taskTerminals.size === 0) {
                state.terminals.delete(taskId);
              }
            }
          });
        },
        
        setActiveTerminal: (taskId, dbSessionId) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals?.has(dbSessionId)) {
              state.activeTerminals.set(taskId, dbSessionId);
            }
          });
        },
        
        setFocusedTerminal: (taskId, dbSessionId) => {
          console.log('[terminalStore] setFocusedTerminal called:', { taskId, dbSessionId });
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            console.log('[terminalStore] taskTerminals:', taskTerminals);
            if (taskTerminals?.has(dbSessionId)) {
              // Clear focus from other terminals in this task
              taskTerminals.forEach(terminal => {
                terminal.hasFocus = false;
              });
              // Set focus on the selected terminal
              const terminal = taskTerminals.get(dbSessionId);
              console.log('[terminalStore] Found terminal:', terminal);
              if (terminal) {
                terminal.hasFocus = true;
                state.focusedTerminals.set(taskId, dbSessionId);
                console.log('[terminalStore] Focus set successfully');
              }
            } else {
              console.log('[terminalStore] Terminal not found in task');
            }
          });
        },
        
        clearTaskTerminals: (taskId) => {
          set(state => {
            // Dispose all terminals for this task
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              taskTerminals.forEach((terminal) => {
                const dispose = state.disposalCallbacks.get(terminal.dbSessionId);
                if (dispose) {
                  dispose();
                  state.disposalCallbacks.delete(terminal.dbSessionId);
                }
              });
            }
            
            state.terminals.delete(taskId);
            state.activeTerminals.delete(taskId);
            state.focusedTerminals.delete(taskId);
            state.loadingStates.delete(taskId);
          });
        },
        
        setLoading: (taskId, loading) => {
          set(state => {
            state.loadingStates.set(taskId, loading);
          });
        },
        
        updateTerminalState: (taskId, dbSessionId, aiState) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              const terminal = taskTerminals.get(dbSessionId);
              if (terminal) {
                terminal.aiState = aiState;
                terminal.lastActivity = new Date().toISOString();
              }
            }
          });
        },
        
        renameTerminal: (taskId, dbSessionId, newName) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              const terminal = taskTerminals.get(dbSessionId);
              if (terminal) {
                terminal.tabName = newName;
              }
            }
          });
        },
        
        reorderTerminals: (taskId, terminals) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              terminals.forEach(({ dbSessionId, tabOrder }) => {
                const terminal = taskTerminals.get(dbSessionId);
                if (terminal) {
                  terminal.tabOrder = tabOrder;
                }
              });
            }
          });
        },
        
        getTerminals: (taskId) => {
          const taskTerminals = get().terminals.get(taskId);
          return mapToSortedArray(taskTerminals);
        },
        
        getTerminal: (taskId, dbSessionId) => {
          return get().terminals.get(taskId)?.get(dbSessionId);
        },
        
        getActiveTerminal: (taskId) => {
          const activeId = get().activeTerminals.get(taskId);
          if (activeId) {
            return get().terminals.get(taskId)?.get(activeId);
          }
          return undefined;
        },
        
        getActiveTerminalId: (taskId) => {
          return get().activeTerminals.get(taskId);
        },
        
        getFocusedTerminal: (taskId) => {
          const focusedId = get().focusedTerminals.get(taskId);
          if (focusedId) {
            return get().terminals.get(taskId)?.get(focusedId);
          }
          return undefined;
        },
        
        getFocusedTerminalId: (taskId) => {
          return get().focusedTerminals.get(taskId);
        },
        
        isLoading: (taskId) => {
          return get().loadingStates.get(taskId) || false;
        },
        
        registerDisposal: (dbSessionId, callback) => {
          set(state => {
            state.disposalCallbacks.set(dbSessionId, callback);
          });
        },
        
        disposeTerminal: (dbSessionId) => {
          set(state => {
            const dispose = state.disposalCallbacks.get(dbSessionId);
            if (dispose) {
              dispose();
              state.disposalCallbacks.delete(dbSessionId);
            }
          });
        }
      }))
    ),
    { name: 'terminal-store' }
  )
);

// Non-reactive access
export const terminalStore = useTerminalStore.getState;

// Convenience hooks with proper memoization
export const useTaskTerminals = (taskId: string) => {
  return useTerminalStore(state => state.getTerminals(taskId));
};

export const useActiveTerminal = (taskId: string) => {
  return useTerminalStore(state => state.getActiveTerminal(taskId));
};

export const useActiveTerminalId = (taskId: string) => {
  return useTerminalStore(state => state.getActiveTerminalId(taskId));
};

export const useFocusedTerminal = (taskId: string) => {
  return useTerminalStore(state => state.getFocusedTerminal(taskId));
};

export const useFocusedTerminalId = (taskId: string) => {
  return useTerminalStore(state => state.getFocusedTerminalId(taskId));
};

export const useTerminalLoading = (taskId: string) => {
  return useTerminalStore(state => state.isLoading(taskId));
};

// WebSocket integration helpers
export const handleTerminalWebSocketEvent = (event: string, data: any) => {
  const store = terminalStore();
  
  switch (event) {
    case 'terminal-created':
      store.addTerminal(data.taskId, data.terminal);
      break;
      
    case 'terminal-updated':
      store.updateTerminal(data.taskId, data.dbSessionId, data.updates);
      break;
      
    case 'terminal-deleted':
      store.removeTerminal(data.taskId, data.dbSessionId);
      break;
      
    case 'terminal-state-changed':
      store.updateTerminalState(data.taskId, data.dbSessionId, data.aiState);
      break;
      
    case 'terminal-renamed':
      store.renameTerminal(data.taskId, data.dbSessionId, data.newName);
      break;
      
    case 'terminals-reordered':
      store.reorderTerminals(data.taskId, data.terminals);
      break;
  }
};