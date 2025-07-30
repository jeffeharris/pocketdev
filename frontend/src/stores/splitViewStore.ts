import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { enableMapSet } from 'immer';

// Enable Map/Set support in Immer
enableMapSet();

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
  // State
  layouts: Map<string, SplitLayoutConfig>;
  activePanes: Map<string, 'primary' | 'secondary'>;
  resizing: boolean;
  
  // Actions
  updateLayout: (taskId: string, config: Partial<SplitLayoutConfig>) => void;
  toggleSplitMode: (taskId: string) => void;
  setSplitRatio: (taskId: string, ratio: number) => void;
  setActivePane: (taskId: string, pane: 'primary' | 'secondary') => void;
  setResizing: (resizing: boolean) => void;
  swapPanes: (taskId: string) => void;
  setPrimaryTerminal: (taskId: string, terminalId: string | null) => void;
  setSecondaryTerminal: (taskId: string, terminalId: string | null) => void;
  setTertiaryTerminal: (taskId: string, terminalId: string | null) => void;
  setQuaternaryTerminal: (taskId: string, terminalId: string | null) => void;
  
  // Computed
  getLayout: (taskId: string) => SplitLayoutConfig;
  getActivePane: (taskId: string) => 'primary' | 'secondary';
}

const defaultLayout: SplitLayoutConfig = {
  mode: 'tab',
  orientation: 'vertical',
  primaryTerminalId: null,
  secondaryTerminalId: null,
  splitRatio: 0.5
};

// 2025 Pattern: Combine middleware for better DX
export const useSplitViewStore = create<SplitViewState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        layouts: new Map(),
        activePanes: new Map(),
        resizing: false,
        
        updateLayout: (taskId, config) => {
          set(state => {
            const currentLayout = state.layouts.get(taskId) || { ...defaultLayout };
            state.layouts.set(taskId, { ...currentLayout, ...config });
          });
        },
        
        toggleSplitMode: (taskId) => {
          set(state => {
            const currentLayout = state.layouts.get(taskId) || { ...defaultLayout };
            const newMode = currentLayout.mode === 'tab' ? 'split' : 'tab';
            state.layouts.set(taskId, { ...currentLayout, mode: newMode });
          });
        },
        
        setSplitRatio: (taskId, ratio) => {
          // Clamp ratio between 0.1 and 0.9
          const clampedRatio = Math.max(0.1, Math.min(0.9, ratio));
          set(state => {
            const currentLayout = state.layouts.get(taskId) || { ...defaultLayout };
            state.layouts.set(taskId, { ...currentLayout, splitRatio: clampedRatio });
          });
        },
        
        setActivePane: (taskId, pane) => {
          set(state => {
            state.activePanes.set(taskId, pane);
          });
        },
        
        setResizing: (resizing) => {
          set(state => {
            state.resizing = resizing;
          });
        },
        
        swapPanes: (taskId) => {
          set(state => {
            const layout = state.layouts.get(taskId);
            if (layout) {
              const temp = layout.primaryTerminalId;
              layout.primaryTerminalId = layout.secondaryTerminalId;
              layout.secondaryTerminalId = temp;
            }
          });
        },
        
        setPrimaryTerminal: (taskId, terminalId) => {
          set(state => {
            const currentLayout = state.layouts.get(taskId) || { ...defaultLayout };
            state.layouts.set(taskId, { ...currentLayout, primaryTerminalId: terminalId });
          });
        },
        
        setSecondaryTerminal: (taskId, terminalId) => {
          set(state => {
            const currentLayout = state.layouts.get(taskId) || { ...defaultLayout };
            state.layouts.set(taskId, { ...currentLayout, secondaryTerminalId: terminalId });
          });
        },
        
        setTertiaryTerminal: (taskId, terminalId) => {
          set(state => {
            const currentLayout = state.layouts.get(taskId) || { ...defaultLayout };
            state.layouts.set(taskId, { ...currentLayout, tertiaryTerminalId: terminalId });
          });
        },
        
        setQuaternaryTerminal: (taskId, terminalId) => {
          set(state => {
            const currentLayout = state.layouts.get(taskId) || { ...defaultLayout };
            state.layouts.set(taskId, { ...currentLayout, quaternaryTerminalId: terminalId });
          });
        },
        
        getLayout: (taskId) => {
          return get().layouts.get(taskId) || { ...defaultLayout };
        },
        
        getActivePane: (taskId) => {
          return get().activePanes.get(taskId) || 'primary';
        }
      }))
    ),
    { name: 'split-view-store' } // DevTools name
  )
);

// 2025 Pattern: Non-reactive access for effects
export const splitViewStore = useSplitViewStore.getState;

// 2025 Pattern: Selective subscriptions
export const useSplitLayout = (taskId: string) => {
  return useSplitViewStore(
    state => state.getLayout(taskId)
  );
};

export const useSplitMode = (taskId: string) => {
  return useSplitViewStore(
    state => state.getLayout(taskId).mode
  );
};

export const useIsResizing = () => {
  return useSplitViewStore(state => state.resizing);
};

// Helper to persist layout to backend
export const persistLayout = async (taskId: string, projectId: string) => {
  const layout = splitViewStore().getLayout(taskId);
  
  try {
    const response = await fetch(
      `/api/projects/${projectId}/tasks/${taskId}/split-layout`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(layout)
      }
    );
    
    if (!response.ok) {
      throw new Error('Failed to persist layout');
    }
  } catch (error) {
    console.error('Error persisting split layout:', error);
  }
};

// Helper to load layout from backend
export const loadLayout = async (taskId: string, projectId: string) => {
  try {
    const response = await fetch(
      `/api/projects/${projectId}/tasks/${taskId}/split-layout`
    );
    
    if (response.ok) {
      const layout = await response.json();
      splitViewStore().updateLayout(taskId, layout);
    }
  } catch (error) {
    console.error('Error loading split layout:', error);
  }
};