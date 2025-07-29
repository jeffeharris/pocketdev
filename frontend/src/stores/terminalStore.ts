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
}

interface TerminalStoreState {
  // State - nested Map for efficient lookups by taskId and terminalId
  terminals: Map<string, Map<string, Terminal>>; // taskId -> sessionId -> Terminal
  activeTerminals: Map<string, string>; // taskId -> activeSessionId
  loadingStates: Map<string, boolean>; // taskId -> isLoading
  
  // Actions
  setTerminals: (taskId: string, terminals: Terminal[]) => void;
  addTerminal: (taskId: string, terminal: Terminal) => void;
  updateTerminal: (taskId: string, sessionId: string, updates: Partial<Terminal>) => void;
  removeTerminal: (taskId: string, sessionId: string) => void;
  setActiveTerminal: (taskId: string, sessionId: string) => void;
  clearTaskTerminals: (taskId: string) => void;
  setLoading: (taskId: string, loading: boolean) => void;
  
  // Bulk updates (for WebSocket events)
  updateTerminalState: (taskId: string, sessionId: string, aiState: Terminal['aiState']) => void;
  renameTerminal: (taskId: string, sessionId: string, newName: string) => void;
  reorderTerminals: (taskId: string, terminals: Array<{ sessionId: string; tabOrder: number }>) => void;
  
  // Selectors
  getTerminals: (taskId: string) => Terminal[];
  getTerminal: (taskId: string, sessionId: string) => Terminal | undefined;
  getActiveTerminal: (taskId: string) => Terminal | undefined;
  getActiveTerminalId: (taskId: string) => string | undefined;
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
        loadingStates: new Map(),
        
        setTerminals: (taskId, terminals) => {
          set(state => {
            const taskTerminals = new Map<string, Terminal>();
            terminals.forEach(terminal => {
              taskTerminals.set(terminal.sessionId, terminal);
            });
            state.terminals.set(taskId, taskTerminals);
            
            // Set first terminal as active if none selected
            if (!state.activeTerminals.has(taskId) && terminals.length > 0) {
              state.activeTerminals.set(taskId, terminals[0].sessionId);
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
            taskTerminals.set(terminal.sessionId, terminal);
            
            // Set as active if it's the first terminal
            if (taskTerminals.size === 1) {
              state.activeTerminals.set(taskId, terminal.sessionId);
            }
          });
        },
        
        updateTerminal: (taskId, sessionId, updates) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              const terminal = taskTerminals.get(sessionId);
              if (terminal) {
                taskTerminals.set(sessionId, { ...terminal, ...updates });
              }
            }
          });
        },
        
        removeTerminal: (taskId, sessionId) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              taskTerminals.delete(sessionId);
              
              // Update active terminal if removed
              const activeId = state.activeTerminals.get(taskId);
              if (activeId === sessionId) {
                const remaining = mapToSortedArray(taskTerminals);
                if (remaining.length > 0) {
                  state.activeTerminals.set(taskId, remaining[0].sessionId);
                } else {
                  state.activeTerminals.delete(taskId);
                }
              }
              
              // Clean up empty task entries
              if (taskTerminals.size === 0) {
                state.terminals.delete(taskId);
              }
            }
          });
        },
        
        setActiveTerminal: (taskId, sessionId) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals?.has(sessionId)) {
              state.activeTerminals.set(taskId, sessionId);
            }
          });
        },
        
        clearTaskTerminals: (taskId) => {
          set(state => {
            state.terminals.delete(taskId);
            state.activeTerminals.delete(taskId);
            state.loadingStates.delete(taskId);
          });
        },
        
        setLoading: (taskId, loading) => {
          set(state => {
            state.loadingStates.set(taskId, loading);
          });
        },
        
        updateTerminalState: (taskId, sessionId, aiState) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              const terminal = taskTerminals.get(sessionId);
              if (terminal) {
                terminal.aiState = aiState;
                terminal.lastActivity = new Date().toISOString();
              }
            }
          });
        },
        
        renameTerminal: (taskId, sessionId, newName) => {
          set(state => {
            const taskTerminals = state.terminals.get(taskId);
            if (taskTerminals) {
              const terminal = taskTerminals.get(sessionId);
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
              terminals.forEach(({ sessionId, tabOrder }) => {
                const terminal = taskTerminals.get(sessionId);
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
        
        getTerminal: (taskId, sessionId) => {
          return get().terminals.get(taskId)?.get(sessionId);
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
        
        isLoading: (taskId) => {
          return get().loadingStates.get(taskId) || false;
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
      store.updateTerminal(data.taskId, data.sessionId, data.updates);
      break;
      
    case 'terminal-deleted':
      store.removeTerminal(data.taskId, data.sessionId);
      break;
      
    case 'terminal-state-changed':
      store.updateTerminalState(data.taskId, data.sessionId, data.aiState);
      break;
      
    case 'terminal-renamed':
      store.renameTerminal(data.taskId, data.sessionId, data.newName);
      break;
      
    case 'terminals-reordered':
      store.reorderTerminals(data.taskId, data.terminals);
      break;
  }
};