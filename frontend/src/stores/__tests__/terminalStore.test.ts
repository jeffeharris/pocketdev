import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { 
  useTerminalStore,
  terminalStore,
  useTaskTerminals,
  useActiveTerminal,
  useActiveTerminalId,
  useTerminalLoading,
  handleTerminalWebSocketEvent,
  type Terminal
} from '../terminalStore';

describe('terminalStore', () => {
  const mockTerminal1: Terminal = {
    sessionId: 'session-1',
    dbSessionId: 'db-session-1',
    tabName: 'Terminal 1',
    tabOrder: 0,
    aiState: 'idle',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastActivity: '2024-01-01T00:00:00Z'
  };

  const mockTerminal2: Terminal = {
    sessionId: 'session-2',
    dbSessionId: 'db-session-2',
    tabName: 'Terminal 2',
    tabOrder: 1,
    aiState: 'working',
    isActive: false,
    createdAt: '2024-01-01T00:00:00Z',
    lastActivity: '2024-01-01T00:00:00Z'
  };

  beforeEach(() => {
    // Reset store state before each test
    useTerminalStore.setState({
      terminals: new Map(),
      activeTerminals: new Map(),
      loadingStates: new Map()
    });
  });

  describe('State Management', () => {
    it('should initialize with empty state', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      expect(result.current.terminals.size).toBe(0);
      expect(result.current.activeTerminals.size).toBe(0);
      expect(result.current.loadingStates.size).toBe(0);
    });

    it('should use nested Maps for efficient lookups', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      expect(result.current.terminals).toBeInstanceOf(Map);
      expect(result.current.activeTerminals).toBeInstanceOf(Map);
      expect(result.current.loadingStates).toBeInstanceOf(Map);
    });
  });

  describe('setTerminals', () => {
    it('should set multiple terminals for a task', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals).toHaveLength(2);
      expect(terminals[0]).toEqual(mockTerminal1);
      expect(terminals[1]).toEqual(mockTerminal2);
    });

    it('should set first terminal as active if none selected', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
      });

      expect(result.current.getActiveTerminalId('task-1')).toBe('session-1');
    });

    it('should maintain active terminal if already set', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        // First set terminals so the task exists
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        // Then set active terminal to session-2
        result.current.setActiveTerminal('task-1', 'session-2');
        // Now set terminals again - should maintain session-2 as active
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
      });

      expect(result.current.getActiveTerminalId('task-1')).toBe('session-2');
    });

    it('should handle empty terminal array', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', []);
      });

      expect(result.current.getTerminals('task-1')).toHaveLength(0);
      expect(result.current.getActiveTerminalId('task-1')).toBeUndefined();
    });

    it('should replace existing terminals', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1]);
        result.current.setTerminals('task-1', [mockTerminal2]);
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals).toHaveLength(1);
      expect(terminals[0]).toEqual(mockTerminal2);
    });
  });

  describe('addTerminal', () => {
    it('should add a new terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals).toHaveLength(1);
      expect(terminals[0]).toEqual(mockTerminal1);
    });

    it('should set as active if first terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
      });

      expect(result.current.getActiveTerminalId('task-1')).toBe('session-1');
    });

    it('should not change active terminal if not first', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.addTerminal('task-1', mockTerminal2);
      });

      expect(result.current.getActiveTerminalId('task-1')).toBe('session-1');
    });

    it('should create task map if not exists', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('new-task', mockTerminal1);
      });

      expect(result.current.terminals.has('new-task')).toBe(true);
      expect(result.current.getTerminals('new-task')).toHaveLength(1);
    });
  });

  describe('updateTerminal', () => {
    it('should update existing terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.updateTerminal('task-1', 'session-1', {
          tabName: 'Updated Terminal',
          aiState: 'working'
        });
      });

      const terminal = result.current.getTerminal('task-1', 'session-1');
      expect(terminal?.tabName).toBe('Updated Terminal');
      expect(terminal?.aiState).toBe('working');
      expect(terminal?.sessionId).toBe('session-1'); // Unchanged
    });

    it('should handle non-existent task', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.updateTerminal('non-existent', 'session-1', {
          tabName: 'Updated'
        });
      });

      expect(result.current.getTerminal('non-existent', 'session-1')).toBeUndefined();
    });

    it('should handle non-existent terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.updateTerminal('task-1', 'non-existent', {
          tabName: 'Updated'
        });
      });

      expect(result.current.getTerminal('task-1', 'non-existent')).toBeUndefined();
    });

    it('should merge updates with existing data', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.updateTerminal('task-1', 'session-1', {
          aiState: 'waiting'
        });
      });

      const terminal = result.current.getTerminal('task-1', 'session-1');
      expect(terminal).toEqual({
        ...mockTerminal1,
        aiState: 'waiting'
      });
    });
  });

  describe('removeTerminal', () => {
    it('should remove terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        result.current.removeTerminal('task-1', 'session-1');
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals).toHaveLength(1);
      expect(terminals[0]).toEqual(mockTerminal2);
    });

    it('should update active terminal if removed was active', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        result.current.removeTerminal('task-1', 'session-1');
      });

      expect(result.current.getActiveTerminalId('task-1')).toBe('session-2');
    });

    it('should clear active terminal if last one removed', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.removeTerminal('task-1', 'session-1');
      });

      expect(result.current.getActiveTerminalId('task-1')).toBeUndefined();
    });

    it('should clean up empty task entries', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.removeTerminal('task-1', 'session-1');
      });

      expect(result.current.terminals.has('task-1')).toBe(false);
    });

    it('should handle non-existent task', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.removeTerminal('non-existent', 'session-1');
      });

      // Should not throw
      expect(result.current.terminals.size).toBe(0);
    });

    it('should maintain correct order after removal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      const terminal3: Terminal = { ...mockTerminal1, sessionId: 'session-3', tabOrder: 2 };
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2, terminal3]);
        result.current.removeTerminal('task-1', 'session-2');
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals).toHaveLength(2);
      expect(terminals[0].sessionId).toBe('session-1');
      expect(terminals[1].sessionId).toBe('session-3');
    });
  });

  describe('setActiveTerminal', () => {
    it('should set active terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        result.current.setActiveTerminal('task-1', 'session-2');
      });

      expect(result.current.getActiveTerminalId('task-1')).toBe('session-2');
    });

    it('should not set active if terminal does not exist', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1]);
        result.current.setActiveTerminal('task-1', 'non-existent');
      });

      expect(result.current.getActiveTerminalId('task-1')).toBe('session-1');
    });

    it('should handle non-existent task', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setActiveTerminal('non-existent', 'session-1');
      });

      expect(result.current.getActiveTerminalId('non-existent')).toBeUndefined();
    });
  });

  describe('clearTaskTerminals', () => {
    it('should clear all terminals for task', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        result.current.setActiveTerminal('task-1', 'session-2');
        result.current.setLoading('task-1', true);
        result.current.clearTaskTerminals('task-1');
      });

      expect(result.current.terminals.has('task-1')).toBe(false);
      expect(result.current.activeTerminals.has('task-1')).toBe(false);
      expect(result.current.loadingStates.has('task-1')).toBe(false);
    });

    it('should not affect other tasks', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1]);
        result.current.setTerminals('task-2', [mockTerminal2]);
        result.current.clearTaskTerminals('task-1');
      });

      expect(result.current.terminals.has('task-1')).toBe(false);
      expect(result.current.terminals.has('task-2')).toBe(true);
    });
  });

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setLoading('task-1', true);
      });

      expect(result.current.isLoading('task-1')).toBe(true);
    });

    it('should update loading state', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setLoading('task-1', true);
        result.current.setLoading('task-1', false);
      });

      expect(result.current.isLoading('task-1')).toBe(false);
    });
  });

  describe('updateTerminalState', () => {
    it('should update AI state and lastActivity', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      const now = new Date();
      vi.setSystemTime(now);
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.updateTerminalState('task-1', 'session-1', 'working');
      });

      const terminal = result.current.getTerminal('task-1', 'session-1');
      expect(terminal?.aiState).toBe('working');
      expect(terminal?.lastActivity).toBe(now.toISOString());
      
      vi.useRealTimers();
    });

    it('should handle non-existent terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.updateTerminalState('task-1', 'non-existent', 'working');
      });

      expect(result.current.getTerminal('task-1', 'non-existent')).toBeUndefined();
    });
  });

  describe('renameTerminal', () => {
    it('should rename terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
        result.current.renameTerminal('task-1', 'session-1', 'New Name');
      });

      const terminal = result.current.getTerminal('task-1', 'session-1');
      expect(terminal?.tabName).toBe('New Name');
    });

    it('should handle non-existent terminal', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.renameTerminal('task-1', 'non-existent', 'New Name');
      });

      expect(result.current.getTerminal('task-1', 'non-existent')).toBeUndefined();
    });
  });

  describe('reorderTerminals', () => {
    it('should reorder terminals', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        result.current.reorderTerminals('task-1', [
          { sessionId: 'session-2', tabOrder: 0 },
          { sessionId: 'session-1', tabOrder: 1 }
        ]);
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals[0].sessionId).toBe('session-2');
      expect(terminals[1].sessionId).toBe('session-1');
    });

    it('should handle partial reorder', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        result.current.reorderTerminals('task-1', [
          { sessionId: 'session-1', tabOrder: 5 }
        ]);
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals[0].sessionId).toBe('session-2');
      expect(terminals[0].tabOrder).toBe(1);
      expect(terminals[1].sessionId).toBe('session-1');
      expect(terminals[1].tabOrder).toBe(5);
    });

    it('should handle non-existent task', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.reorderTerminals('non-existent', [
          { sessionId: 'session-1', tabOrder: 0 }
        ]);
      });

      expect(result.current.terminals.has('non-existent')).toBe(false);
    });
  });

  describe('Selectors', () => {
    describe('getTerminals', () => {
      it('should return sorted terminals', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        const terminal3: Terminal = { ...mockTerminal1, sessionId: 'session-3', tabOrder: 0.5 };
        
        act(() => {
          result.current.addTerminal('task-1', mockTerminal2);
          result.current.addTerminal('task-1', mockTerminal1);
          result.current.addTerminal('task-1', terminal3);
        });

        const terminals = result.current.getTerminals('task-1');
        expect(terminals[0].sessionId).toBe('session-1');
        expect(terminals[1].sessionId).toBe('session-3');
        expect(terminals[2].sessionId).toBe('session-2');
      });

      it('should return empty array for non-existent task', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        expect(result.current.getTerminals('non-existent')).toEqual([]);
      });
    });

    describe('getTerminal', () => {
      it('should return specific terminal', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        act(() => {
          result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        });

        expect(result.current.getTerminal('task-1', 'session-2')).toEqual(mockTerminal2);
      });

      it('should return undefined for non-existent', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        expect(result.current.getTerminal('task-1', 'session-1')).toBeUndefined();
      });
    });

    describe('getActiveTerminal', () => {
      it('should return active terminal object', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        act(() => {
          result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
          result.current.setActiveTerminal('task-1', 'session-2');
        });

        expect(result.current.getActiveTerminal('task-1')).toEqual(mockTerminal2);
      });

      it('should return undefined if no active', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        expect(result.current.getActiveTerminal('task-1')).toBeUndefined();
      });
    });

    describe('getActiveTerminalId', () => {
      it('should return active terminal ID', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        act(() => {
          result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        });

        expect(result.current.getActiveTerminalId('task-1')).toBe('session-1');
      });

      it('should return undefined for non-existent task', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        expect(result.current.getActiveTerminalId('non-existent')).toBeUndefined();
      });
    });

    describe('isLoading', () => {
      it('should return loading state', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        act(() => {
          result.current.setLoading('task-1', true);
        });

        expect(result.current.isLoading('task-1')).toBe(true);
      });

      it('should return false for non-existent task', () => {
        const { result } = renderHook(() => useTerminalStore());
        
        expect(result.current.isLoading('non-existent')).toBe(false);
      });
    });
  });

  describe('Non-reactive access', () => {
    it('should provide non-reactive access via terminalStore', () => {
      act(() => {
        terminalStore().addTerminal('task-1', mockTerminal1);
      });

      const terminals = terminalStore().getTerminals('task-1');
      expect(terminals).toHaveLength(1);
    });
  });

  describe('Convenience hooks', () => {
    it('useTaskTerminals should return terminals for task', () => {
      const { result: storeResult } = renderHook(() => useTerminalStore());
      
      act(() => {
        storeResult.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
      });

      const { result } = renderHook(() => useTaskTerminals('task-1'));
      
      expect(result.current).toHaveLength(2);
      expect(result.current[0]).toEqual(mockTerminal1);
    });

    it('useActiveTerminal should return active terminal', () => {
      const { result: storeResult } = renderHook(() => useTerminalStore());
      
      act(() => {
        storeResult.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        storeResult.current.setActiveTerminal('task-1', 'session-2');
      });

      const { result } = renderHook(() => useActiveTerminal('task-1'));
      
      expect(result.current).toEqual(mockTerminal2);
    });

    it('useActiveTerminalId should return active terminal ID', () => {
      const { result: storeResult } = renderHook(() => useTerminalStore());
      
      act(() => {
        storeResult.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
      });

      const { result } = renderHook(() => useActiveTerminalId('task-1'));
      
      expect(result.current).toBe('session-1');
    });

    it('useTerminalLoading should return loading state', () => {
      const { result: storeResult } = renderHook(() => useTerminalStore());
      
      act(() => {
        storeResult.current.setLoading('task-1', true);
      });

      const { result } = renderHook(() => useTerminalLoading('task-1'));
      
      expect(result.current).toBe(true);
    });
  });

  describe('WebSocket integration', () => {
    it('should handle terminal-created event', () => {
      act(() => {
        handleTerminalWebSocketEvent('terminal-created', {
          taskId: 'task-1',
          terminal: mockTerminal1
        });
      });

      const terminals = terminalStore().getTerminals('task-1');
      expect(terminals).toHaveLength(1);
      expect(terminals[0]).toEqual(mockTerminal1);
    });

    it('should handle terminal-updated event', () => {
      act(() => {
        terminalStore().addTerminal('task-1', mockTerminal1);
        handleTerminalWebSocketEvent('terminal-updated', {
          taskId: 'task-1',
          sessionId: 'session-1',
          updates: { tabName: 'Updated' }
        });
      });

      const terminal = terminalStore().getTerminal('task-1', 'session-1');
      expect(terminal?.tabName).toBe('Updated');
    });

    it('should handle terminal-deleted event', () => {
      act(() => {
        terminalStore().setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        handleTerminalWebSocketEvent('terminal-deleted', {
          taskId: 'task-1',
          sessionId: 'session-1'
        });
      });

      const terminals = terminalStore().getTerminals('task-1');
      expect(terminals).toHaveLength(1);
      expect(terminals[0].sessionId).toBe('session-2');
    });

    it('should handle terminal-state-changed event', () => {
      const now = new Date();
      vi.setSystemTime(now);
      
      act(() => {
        terminalStore().addTerminal('task-1', mockTerminal1);
        handleTerminalWebSocketEvent('terminal-state-changed', {
          taskId: 'task-1',
          sessionId: 'session-1',
          aiState: 'working'
        });
      });

      const terminal = terminalStore().getTerminal('task-1', 'session-1');
      expect(terminal?.aiState).toBe('working');
      expect(terminal?.lastActivity).toBe(now.toISOString());
      
      vi.useRealTimers();
    });

    it('should handle terminal-renamed event', () => {
      act(() => {
        terminalStore().addTerminal('task-1', mockTerminal1);
        handleTerminalWebSocketEvent('terminal-renamed', {
          taskId: 'task-1',
          sessionId: 'session-1',
          newName: 'Renamed Terminal'
        });
      });

      const terminal = terminalStore().getTerminal('task-1', 'session-1');
      expect(terminal?.tabName).toBe('Renamed Terminal');
    });

    it('should handle terminals-reordered event', () => {
      act(() => {
        terminalStore().setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        handleTerminalWebSocketEvent('terminals-reordered', {
          taskId: 'task-1',
          terminals: [
            { sessionId: 'session-2', tabOrder: 0 },
            { sessionId: 'session-1', tabOrder: 1 }
          ]
        });
      });

      const terminals = terminalStore().getTerminals('task-1');
      expect(terminals[0].sessionId).toBe('session-2');
      expect(terminals[1].sessionId).toBe('session-1');
    });

    it('should handle unknown event gracefully', () => {
      act(() => {
        terminalStore().addTerminal('task-1', mockTerminal1);
        handleTerminalWebSocketEvent('unknown-event', { taskId: 'task-1' });
      });

      // Should not throw or modify state
      const terminals = terminalStore().getTerminals('task-1');
      expect(terminals).toHaveLength(1);
    });
  });

  describe('Integration with Immer', () => {
    it('should maintain immutability', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      const initialTerminals = result.current.terminals;
      
      act(() => {
        result.current.addTerminal('task-1', mockTerminal1);
      });

      expect(result.current.terminals).not.toBe(initialTerminals);
    });

    it('should handle complex nested updates', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        // Multiple operations
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2]);
        result.current.updateTerminal('task-1', 'session-1', { aiState: 'working' });
        result.current.renameTerminal('task-1', 'session-2', 'New Name');
        result.current.setActiveTerminal('task-1', 'session-2');
        result.current.setLoading('task-1', true);
      });

      expect(result.current.getTerminal('task-1', 'session-1')?.aiState).toBe('working');
      expect(result.current.getTerminal('task-1', 'session-2')?.tabName).toBe('New Name');
      expect(result.current.getActiveTerminalId('task-1')).toBe('session-2');
      expect(result.current.isLoading('task-1')).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple tasks independently', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1]);
        result.current.setTerminals('task-2', [mockTerminal2]);
        result.current.setActiveTerminal('task-1', 'session-1');
        result.current.setActiveTerminal('task-2', 'session-2');
      });

      expect(result.current.getTerminals('task-1')).toHaveLength(1);
      expect(result.current.getTerminals('task-2')).toHaveLength(1);
      expect(result.current.getActiveTerminalId('task-1')).toBe('session-1');
      expect(result.current.getActiveTerminalId('task-2')).toBe('session-2');
    });

    it('should handle rapid updates', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      act(() => {
        for (let i = 0; i < 10; i++) {
          result.current.addTerminal('task-1', {
            ...mockTerminal1,
            sessionId: `session-${i}`,
            tabOrder: i
          });
        }
      });

      expect(result.current.getTerminals('task-1')).toHaveLength(10);
    });

    it('should handle terminals with same tabOrder', () => {
      const { result } = renderHook(() => useTerminalStore());
      
      const terminal3: Terminal = { ...mockTerminal1, sessionId: 'session-3', tabOrder: 0 };
      
      act(() => {
        result.current.setTerminals('task-1', [mockTerminal1, mockTerminal2, terminal3]);
      });

      const terminals = result.current.getTerminals('task-1');
      expect(terminals).toHaveLength(3);
      // Should maintain stable sort
      expect(terminals[0].sessionId).toBe('session-1');
      expect(terminals[1].sessionId).toBe('session-3');
    });
  });
});