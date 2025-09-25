import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { 
  useSplitViewStore, 
  splitViewStore,
  useSplitLayout,
  useSplitMode,
  useIsResizing,
  persistLayout,
  loadLayout,
  type SplitLayoutConfig
} from '../splitViewStore';

describe('splitViewStore', () => {
  beforeEach(() => {
    // Reset store state before each test
    useSplitViewStore.setState({
      layouts: new Map(),
      activePanes: new Map(),
      resizing: false
    });
  });

  describe('State Management', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      expect(result.current.layouts.size).toBe(0);
      expect(result.current.activePanes.size).toBe(0);
      expect(result.current.resizing).toBe(false);
    });

    it('should use Map for layouts and activePanes', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      expect(result.current.layouts).toBeInstanceOf(Map);
      expect(result.current.activePanes).toBeInstanceOf(Map);
    });
  });

  describe('updateLayout', () => {
    it('should create new layout with defaults if not exists', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', { mode: 'split' });
      });

      const layout = result.current.getLayout('task-1');
      expect(layout).toEqual({
        mode: 'split',
        orientation: 'horizontal',
        primaryTerminalId: null,
        secondaryTerminalId: null,
        splitRatio: 0.5
      });
    });

    it('should update existing layout', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', { 
          mode: 'split',
          primaryTerminalId: 'term-1' 
        });
      });

      act(() => {
        result.current.updateLayout('task-1', { 
          secondaryTerminalId: 'term-2',
          splitRatio: 0.7 
        });
      });

      const layout = result.current.getLayout('task-1');
      expect(layout.mode).toBe('split');
      expect(layout.primaryTerminalId).toBe('term-1');
      expect(layout.secondaryTerminalId).toBe('term-2');
      expect(layout.splitRatio).toBe(0.7);
    });

    it('should handle partial updates', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', { orientation: 'vertical' });
      });

      const layout = result.current.getLayout('task-1');
      expect(layout.orientation).toBe('vertical');
      expect(layout.mode).toBe('tab'); // default value
    });
  });

  describe('toggleSplitMode', () => {
    it('should toggle from tab to split', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.toggleSplitMode('task-1');
      });

      expect(result.current.getLayout('task-1').mode).toBe('split');
    });

    it('should toggle from split to tab', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', { mode: 'split' });
        result.current.toggleSplitMode('task-1');
      });

      expect(result.current.getLayout('task-1').mode).toBe('tab');
    });

    it('should preserve other layout properties when toggling', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', {
          mode: 'tab',
          orientation: 'vertical',
          primaryTerminalId: 'term-1',
          splitRatio: 0.3
        });
        result.current.toggleSplitMode('task-1');
      });

      const layout = result.current.getLayout('task-1');
      expect(layout.mode).toBe('split');
      expect(layout.orientation).toBe('vertical');
      expect(layout.primaryTerminalId).toBe('term-1');
      expect(layout.splitRatio).toBe(0.3);
    });
  });

  describe('setSplitRatio', () => {
    it('should set split ratio within valid range', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setSplitRatio('task-1', 0.7);
      });

      expect(result.current.getLayout('task-1').splitRatio).toBe(0.7);
    });

    it('should clamp ratio to minimum 0.1', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setSplitRatio('task-1', 0.05);
      });

      expect(result.current.getLayout('task-1').splitRatio).toBe(0.1);
    });

    it('should clamp ratio to maximum 0.9', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setSplitRatio('task-1', 0.95);
      });

      expect(result.current.getLayout('task-1').splitRatio).toBe(0.9);
    });

    it('should handle negative values', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setSplitRatio('task-1', -0.5);
      });

      expect(result.current.getLayout('task-1').splitRatio).toBe(0.1);
    });

    it('should handle values greater than 1', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setSplitRatio('task-1', 1.5);
      });

      expect(result.current.getLayout('task-1').splitRatio).toBe(0.9);
    });
  });

  describe('setActivePane', () => {
    it('should set active pane to primary', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setActivePane('task-1', 'primary');
      });

      expect(result.current.getActivePane('task-1')).toBe('primary');
    });

    it('should set active pane to secondary', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setActivePane('task-1', 'secondary');
      });

      expect(result.current.getActivePane('task-1')).toBe('secondary');
    });

    it('should maintain separate active panes for different tasks', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setActivePane('task-1', 'secondary');
        result.current.setActivePane('task-2', 'primary');
      });

      expect(result.current.getActivePane('task-1')).toBe('secondary');
      expect(result.current.getActivePane('task-2')).toBe('primary');
    });
  });

  describe('setResizing', () => {
    it('should set resizing state to true', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setResizing(true);
      });

      expect(result.current.resizing).toBe(true);
    });

    it('should set resizing state to false', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setResizing(true);
        result.current.setResizing(false);
      });

      expect(result.current.resizing).toBe(false);
    });
  });

  describe('swapPanes', () => {
    it('should swap primary and secondary terminals', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', {
          primaryTerminalId: 'term-1',
          secondaryTerminalId: 'term-2'
        });
        result.current.swapPanes('task-1');
      });

      const layout = result.current.getLayout('task-1');
      expect(layout.primaryTerminalId).toBe('term-2');
      expect(layout.secondaryTerminalId).toBe('term-1');
    });

    it('should handle swap when one terminal is null', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', {
          primaryTerminalId: 'term-1',
          secondaryTerminalId: null
        });
        result.current.swapPanes('task-1');
      });

      const layout = result.current.getLayout('task-1');
      expect(layout.primaryTerminalId).toBe(null);
      expect(layout.secondaryTerminalId).toBe('term-1');
    });

    it('should do nothing if layout does not exist', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.swapPanes('non-existent-task');
      });

      expect(result.current.layouts.has('non-existent-task')).toBe(false);
    });
  });

  describe('setPrimaryTerminal', () => {
    it('should set primary terminal ID', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setPrimaryTerminal('task-1', 'term-1');
      });

      expect(result.current.getLayout('task-1').primaryTerminalId).toBe('term-1');
    });

    it('should update existing layout', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', { 
          mode: 'split',
          secondaryTerminalId: 'term-2' 
        });
        result.current.setPrimaryTerminal('task-1', 'term-1');
      });

      const layout = result.current.getLayout('task-1');
      expect(layout.primaryTerminalId).toBe('term-1');
      expect(layout.secondaryTerminalId).toBe('term-2');
      expect(layout.mode).toBe('split');
    });
  });

  describe('setSecondaryTerminal', () => {
    it('should set secondary terminal ID', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setSecondaryTerminal('task-1', 'term-2');
      });

      expect(result.current.getLayout('task-1').secondaryTerminalId).toBe('term-2');
    });

    it('should update existing layout', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', { 
          mode: 'split',
          primaryTerminalId: 'term-1' 
        });
        result.current.setSecondaryTerminal('task-1', 'term-2');
      });

      const layout = result.current.getLayout('task-1');
      expect(layout.primaryTerminalId).toBe('term-1');
      expect(layout.secondaryTerminalId).toBe('term-2');
      expect(layout.mode).toBe('split');
    });
  });

  describe('getLayout', () => {
    it('should return existing layout', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      const testLayout: SplitLayoutConfig = {
        mode: 'split',
        orientation: 'vertical',
        primaryTerminalId: 'term-1',
        secondaryTerminalId: 'term-2',
        splitRatio: 0.6
      };

      act(() => {
        result.current.updateLayout('task-1', testLayout);
      });

      expect(result.current.getLayout('task-1')).toEqual(testLayout);
    });

    it('should return default layout for non-existent task', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      const layout = result.current.getLayout('non-existent');
      expect(layout).toEqual({
        mode: 'tab',
        orientation: 'horizontal',
        primaryTerminalId: null,
        secondaryTerminalId: null,
        splitRatio: 0.5
      });
    });
  });

  describe('getActivePane', () => {
    it('should return active pane', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.setActivePane('task-1', 'secondary');
      });

      expect(result.current.getActivePane('task-1')).toBe('secondary');
    });

    it('should return primary as default for non-existent task', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      expect(result.current.getActivePane('non-existent')).toBe('primary');
    });
  });

  describe('Non-reactive access', () => {
    it('should provide non-reactive access via splitViewStore', () => {
      act(() => {
        splitViewStore().updateLayout('task-1', { mode: 'split' });
      });

      const layout = splitViewStore().getLayout('task-1');
      expect(layout.mode).toBe('split');
    });
  });

  describe('Selective subscription hooks', () => {
    it('useSplitLayout should return layout for task', () => {
      const { result: storeResult } = renderHook(() => useSplitViewStore());
      
      act(() => {
        storeResult.current.updateLayout('task-1', { 
          mode: 'split',
          splitRatio: 0.7 
        });
      });

      const { result: layoutResult } = renderHook(() => useSplitLayout('task-1'));
      
      expect(layoutResult.current.mode).toBe('split');
      expect(layoutResult.current.splitRatio).toBe(0.7);
    });

    it('useSplitMode should return only mode', () => {
      const { result: storeResult } = renderHook(() => useSplitViewStore());
      
      act(() => {
        storeResult.current.updateLayout('task-1', { mode: 'split' });
      });

      const { result: modeResult } = renderHook(() => useSplitMode('task-1'));
      
      expect(modeResult.current).toBe('split');
    });

    it('useIsResizing should return resizing state', () => {
      const { result: storeResult } = renderHook(() => useSplitViewStore());
      
      act(() => {
        storeResult.current.setResizing(true);
      });

      const { result: resizingResult } = renderHook(() => useIsResizing());
      
      expect(resizingResult.current).toBe(true);
    });
  });

  describe('Integration with Immer', () => {
    it('should maintain immutability with immer', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      const initialLayouts = result.current.layouts;
      
      act(() => {
        result.current.updateLayout('task-1', { mode: 'split' });
      });

      // Immer should create a new Map instance
      expect(result.current.layouts).not.toBe(initialLayouts);
    });

    it('should handle complex nested updates', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        // Multiple updates in sequence
        result.current.updateLayout('task-1', { mode: 'split' });
        result.current.setPrimaryTerminal('task-1', 'term-1');
        result.current.setSecondaryTerminal('task-1', 'term-2');
        result.current.setSplitRatio('task-1', 0.7);
        result.current.swapPanes('task-1');
      });

      const layout = result.current.getLayout('task-1');
      expect(layout).toEqual({
        mode: 'split',
        orientation: 'horizontal',
        primaryTerminalId: 'term-2',
        secondaryTerminalId: 'term-1',
        splitRatio: 0.7
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple tasks independently', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        result.current.updateLayout('task-1', { 
          mode: 'split',
          primaryTerminalId: 'term-1'
        });
        result.current.updateLayout('task-2', { 
          mode: 'tab',
          primaryTerminalId: 'term-3'
        });
        result.current.setActivePane('task-1', 'secondary');
        result.current.setActivePane('task-2', 'primary');
      });

      expect(result.current.getLayout('task-1').mode).toBe('split');
      expect(result.current.getLayout('task-2').mode).toBe('tab');
      expect(result.current.getActivePane('task-1')).toBe('secondary');
      expect(result.current.getActivePane('task-2')).toBe('primary');
    });

    it('should handle rapid updates', () => {
      const { result } = renderHook(() => useSplitViewStore());
      
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.toggleSplitMode('task-1');
        }
      });

      // After 10 toggles, should be back to tab mode
      expect(result.current.getLayout('task-1').mode).toBe('tab');
    });
  });

  describe('persistLayout helper', () => {
    it('should make PUT request with layout data', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      });
      global.fetch = mockFetch;

      act(() => {
        splitViewStore().updateLayout('task-1', {
          mode: 'split',
          primaryTerminalId: 'term-1',
          secondaryTerminalId: 'term-2',
          splitRatio: 0.7
        });
      });

      await persistLayout('task-1', 'project-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/project-1/tasks/task-1/split-layout',
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'split',
            orientation: 'horizontal',
            primaryTerminalId: 'term-1',
            secondaryTerminalId: 'term-2',
            splitRatio: 0.7
          })
        }
      );
    });

    it('should handle persist errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await persistLayout('task-1', 'project-1');

      expect(consoleError).toHaveBeenCalledWith(
        'Error persisting split layout:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });
  });

  describe('loadLayout helper', () => {
    it('should load and update layout from backend', async () => {
      const mockLayout = {
        mode: 'split',
        orientation: 'vertical',
        primaryTerminalId: 'term-1',
        secondaryTerminalId: 'term-2',
        splitRatio: 0.6
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLayout
      });
      global.fetch = mockFetch;

      await loadLayout('task-1', 'project-1');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/projects/project-1/tasks/task-1/split-layout'
      );

      const layout = splitViewStore().getLayout('task-1');
      expect(layout).toEqual(mockLayout);
    });

    it('should handle load errors gracefully', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
      global.fetch = mockFetch;
      
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      await loadLayout('task-1', 'project-1');

      expect(consoleError).toHaveBeenCalledWith(
        'Error loading split layout:',
        expect.any(Error)
      );

      consoleError.mockRestore();
    });

    it('should handle non-ok responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      });
      global.fetch = mockFetch;

      await loadLayout('task-1', 'project-1');

      // Should not update the store
      const layout = splitViewStore().getLayout('task-1');
      expect(layout).toEqual({
        mode: 'tab',
        orientation: 'horizontal',
        primaryTerminalId: null,
        secondaryTerminalId: null,
        splitRatio: 0.5
      });
    });
  });
});