import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

export interface SplitLayoutConfig {
  mode: 'tab' | 'split' | 'split-4';
  orientation: 'horizontal' | 'vertical';
  primaryTerminalId: string | null;
  secondaryTerminalId: string | null;
  tertiaryTerminalId?: string | null;
  quaternaryTerminalId?: string | null;
  splitRatio: number;
}

interface SplitViewState {
  // Current task context
  currentTaskId: string | null;
  currentProjectId: string | null;
  
  // Layout state
  currentLayout: SplitLayoutConfig | null;
  activePane: 'primary' | 'secondary';
  
  // UI state
  resizing: boolean;
  
  // Loading state
  layoutState: 'idle' | 'loading' | 'loaded' | 'error';
  layoutError: string | null;
  
  // Actions
  setCurrentTask: (taskId: string, projectId: string) => Promise<void>;
  updateLayout: (changes: Partial<SplitLayoutConfig>) => void;
  toggleSplitMode: () => void;
  cycleSplitMode: () => void;
  setSplitRatio: (ratio: number) => void;
  setActivePane: (pane: 'primary' | 'secondary') => void;
  setResizing: (resizing: boolean) => void;
  swapPanes: () => void;
  setPrimaryTerminal: (terminalId: string | null) => void;
  setSecondaryTerminal: (terminalId: string | null) => void;
  setTertiaryTerminal: (terminalId: string | null) => void;
  setQuaternaryTerminal: (terminalId: string | null) => void;
  clearLayout: () => void;
}

const defaultLayout: SplitLayoutConfig = {
  mode: 'tab',
  orientation: 'vertical',
  primaryTerminalId: null,
  secondaryTerminalId: null,
  splitRatio: 0.5
};

export const useSplitViewStore = create<SplitViewState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Initial state
        currentTaskId: null,
        currentProjectId: null,
        currentLayout: null,
        activePane: 'primary',
        resizing: false,
        layoutState: 'idle',
        layoutError: null,
        
        // Set current task and load its layout
        setCurrentTask: async (taskId, projectId) => {
          const state = get();
          
          // Skip if already current task
          if (state.currentTaskId === taskId) return;
          
          set(draft => {
            draft.currentTaskId = taskId;
            draft.currentProjectId = projectId;
            draft.layoutState = 'loading';
            draft.layoutError = null;
          });
          
          try {
            const response = await fetch(
              `/api/projects/${projectId}/tasks/${taskId}/split-layout`
            );
            
            if (response.ok) {
              const layout = await response.json();
              set(draft => {
                draft.currentLayout = layout;
                draft.layoutState = 'loaded';
              });
            } else {
              // Use default layout if none exists
              set(draft => {
                draft.currentLayout = { ...defaultLayout };
                draft.layoutState = 'loaded';
              });
            }
          } catch (error) {
            console.error('Error loading split layout:', error);
            set(draft => {
              draft.currentLayout = { ...defaultLayout };
              draft.layoutState = 'error';
              draft.layoutError = error instanceof Error ? error.message : 'Failed to load layout';
            });
          }
        },
        
        updateLayout: (changes) => {
          set(draft => {
            if (draft.currentLayout) {
              Object.assign(draft.currentLayout, changes);
            }
          });
        },
        
        toggleSplitMode: () => {
          set(draft => {
            if (draft.currentLayout) {
              draft.currentLayout.mode = draft.currentLayout.mode === 'tab' ? 'split' : 'tab';
            }
          });
        },
        
        cycleSplitMode: () => {
          set(draft => {
            if (!draft.currentLayout) return;
            
            // Cycle through: tab -> split -> split-4 -> tab
            switch (draft.currentLayout.mode) {
              case 'tab':
                draft.currentLayout.mode = 'split';
                break;
              case 'split':
                draft.currentLayout.mode = 'split-4';
                break;
              case 'split-4':
                draft.currentLayout.mode = 'tab';
                break;
            }
          });
        },
        
        setSplitRatio: (ratio) => {
          const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
          set(draft => {
            if (draft.currentLayout) {
              draft.currentLayout.splitRatio = clampedRatio;
            }
          });
        },
        
        setActivePane: (pane) => {
          set(draft => {
            draft.activePane = pane;
          });
        },
        
        setResizing: (resizing) => {
          set(draft => {
            draft.resizing = resizing;
          });
        },
        
        swapPanes: () => {
          set(draft => {
            if (!draft.currentLayout) return;
            
            if (draft.currentLayout.mode === 'split-4') {
              // For quad view, swap all four in a rotation
              const temp = draft.currentLayout.primaryTerminalId;
              draft.currentLayout.primaryTerminalId = draft.currentLayout.secondaryTerminalId;
              draft.currentLayout.secondaryTerminalId = draft.currentLayout.quaternaryTerminalId;
              draft.currentLayout.quaternaryTerminalId = draft.currentLayout.tertiaryTerminalId;
              draft.currentLayout.tertiaryTerminalId = temp;
            } else {
              // For split view, just swap primary and secondary
              const temp = draft.currentLayout.primaryTerminalId;
              draft.currentLayout.primaryTerminalId = draft.currentLayout.secondaryTerminalId;
              draft.currentLayout.secondaryTerminalId = temp;
            }
          });
        },
        
        setPrimaryTerminal: (terminalId) => {
          set(draft => {
            if (draft.currentLayout) {
              draft.currentLayout.primaryTerminalId = terminalId;
            }
          });
        },
        
        setSecondaryTerminal: (terminalId) => {
          set(draft => {
            if (draft.currentLayout) {
              draft.currentLayout.secondaryTerminalId = terminalId;
            }
          });
        },
        
        setTertiaryTerminal: (terminalId) => {
          set(draft => {
            if (draft.currentLayout) {
              draft.currentLayout.tertiaryTerminalId = terminalId;
            }
          });
        },
        
        setQuaternaryTerminal: (terminalId) => {
          set(draft => {
            if (draft.currentLayout) {
              draft.currentLayout.quaternaryTerminalId = terminalId;
            }
          });
        },
        
        clearLayout: () => {
          set(draft => {
            draft.currentTaskId = null;
            draft.currentProjectId = null;
            draft.currentLayout = null;
            draft.layoutState = 'idle';
            draft.layoutError = null;
            draft.activePane = 'primary';
          });
        }
      }))
    ),
    { name: 'split-view-store' }
  )
);

// Selectors for components
export const useSplitLayout = () => {
  return useSplitViewStore(state => state.currentLayout || defaultLayout);
};

export const useSplitMode = () => {
  return useSplitViewStore(state => state.currentLayout?.mode || 'tab');
};

export const useIsResizing = () => {
  return useSplitViewStore(state => state.resizing);
};

export const useLayoutState = () => {
  return useSplitViewStore(state => state.layoutState);
};

// Helper to save layout to backend
export const saveLayout = async () => {
  const state = useSplitViewStore.getState();
  const { currentTaskId, currentProjectId, currentLayout } = state;
  
  if (!currentTaskId || !currentProjectId || !currentLayout) {
    return;
  }
  
  try {
    const response = await fetch(
      `/api/projects/${currentProjectId}/tasks/${currentTaskId}/split-layout`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentLayout)
      }
    );
    
    if (!response.ok) {
      console.error('Failed to save split layout');
    }
  } catch (error) {
    console.error('Error saving split layout:', error);
  }
};