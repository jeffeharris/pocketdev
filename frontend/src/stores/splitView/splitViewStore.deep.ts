/**
 * Deep Module Split View Store
 * 
 * Refactored from shallow module (8+ methods) to deep module (5 methods).
 * Following Ousterhout's principles and AI-friendly architecture.
 * 
 * Key improvements:
 * - Simple interface: 5 methods vs 8+ methods
 * - Hidden complexity: Layout transitions and validation internal
 * - Separated concerns: Network operations moved to service layer
 * - Removed UI state: resizing/activePane belong in components
 * - Atomic operations: Complete state changes in single calls
 */

import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// Domain types - what consumers care about
export interface ViewLayout {
  mode: 'tab' | 'split' | 'quad';
  orientation?: 'horizontal' | 'vertical';
  splitRatio?: number;
}

export interface SplitViewState {
  currentTaskId: string | null;
  currentProjectId: string | null;
  layout: ViewLayout;
}

// High-level actions that encapsulate complex operations
export type LayoutAction =
  | { type: 'set-mode'; mode: ViewLayout['mode'] }
  | { type: 'set-orientation'; orientation: 'horizontal' | 'vertical' }
  | { type: 'set-ratio'; ratio: number }
  | { type: 'cycle' }
  | { type: 'reset' };

// Deep module interface - only 5 public methods
interface SplitViewStore {
  // Task context (no async, no network calls)
  setCurrentTask(taskId: string, projectId: string): void;
  
  // Layout management (replaces 5 granular methods)
  setLayout(layout: ViewLayout): void;
  updateLayout(action: LayoutAction): void;
  
  // State query (single method for all state)
  getState(): SplitViewState;
  
  // Cleanup
  reset(): void;
}

// Private implementation
interface SplitViewStoreImpl extends SplitViewStore {
  _taskId: string | null;
  _projectId: string | null;
  _layout: ViewLayout;
}

// Default layout configuration
const DEFAULT_LAYOUT: ViewLayout = {
  mode: 'tab',
  orientation: 'vertical',
  splitRatio: 0.5
};

// Layout cycle sequence
const LAYOUT_CYCLE: ViewLayout['mode'][] = ['tab', 'split', 'quad'];

// Create the deep module store
export const useSplitViewStore = create<SplitViewStoreImpl>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        // Hidden state
        _taskId: null,
        _projectId: null,
        _layout: { ...DEFAULT_LAYOUT },
        
        // Simple public interface
        
        setCurrentTask: (taskId, projectId) => {
          set(state => {
            state._taskId = taskId;
            state._projectId = projectId;
            // Note: Layout loading is handled by service layer
            // This store only manages state, not network operations
          });
        },
        
        setLayout: (layout) => {
          set(state => {
            // Validate and normalize layout
            state._layout = {
              mode: layout.mode,
              orientation: layout.orientation || 'vertical',
              splitRatio: Math.max(0.1, Math.min(0.9, layout.splitRatio || 0.5))
            };
          });
        },
        
        updateLayout: (action) => {
          set(state => {
            switch (action.type) {
              case 'set-mode':
                state._layout.mode = action.mode;
                break;
                
              case 'set-orientation':
                state._layout.orientation = action.orientation;
                break;
                
              case 'set-ratio': {
                // Clamp ratio to valid range
                state._layout.splitRatio = Math.max(0.1, Math.min(0.9, action.ratio));
                break;
              }
              
              case 'cycle': {
                // Cycle through layout modes
                const currentIndex = LAYOUT_CYCLE.indexOf(state._layout.mode);
                const nextIndex = (currentIndex + 1) % LAYOUT_CYCLE.length;
                state._layout.mode = LAYOUT_CYCLE[nextIndex];
                break;
              }
              
              case 'reset':
                state._layout = { ...DEFAULT_LAYOUT };
                break;
            }
          });
        },
        
        getState: () => {
          const state = get();
          return {
            currentTaskId: state._taskId,
            currentProjectId: state._projectId,
            layout: { ...state._layout }
          };
        },
        
        reset: () => {
          set(state => {
            state._taskId = null;
            state._projectId = null;
            state._layout = { ...DEFAULT_LAYOUT };
          });
        }
      }))
    ),
    { name: 'split-view-store-deep' }
  )
);

// Non-reactive access
export const splitViewStore = useSplitViewStore.getState;

// Convenience hooks that work with the deep module interface
export const useSplitLayout = () => {
  return useSplitViewStore(state => state._layout);
};

export const useSplitMode = () => {
  return useSplitViewStore(state => state._layout.mode);
};

export const useCurrentTaskContext = () => {
  return useSplitViewStore(state => ({
    taskId: state._taskId,
    projectId: state._projectId
  }));
};

// Removed hooks that exposed UI state:
// - useIsResizing: UI state belongs in ResizablePanel component
// - useActivePane: Focus state belongs in TerminalGrid component
// - useLayoutState: Loading states belong in service layer