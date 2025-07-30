import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TerminalPanel } from '../TerminalPanel';
import { useSplitViewStore } from '../../../stores/splitViewStore';
import { useTerminalStore } from '../../../stores/terminalStore';
import type { Task } from '../../../types/task';

// Mock the stores
vi.mock('../../../stores/splitViewStore');
vi.mock('../../../stores/terminalStore');
vi.mock('../../../hooks/useTaskStatus', () => ({
  useTaskStatus: () => ({ sessionStates: [] })
}));
vi.mock('../../../hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: () => {}
}));
vi.mock('../../../hooks/keyboard', () => ({
  useShortcutContext: () => {}
}));
vi.mock('@shelltender/client', () => ({
  useToast: () => ({ showToast: vi.fn() })
}));

// Mock DirectTerminal component
vi.mock('../DirectTerminal', () => ({
  DirectTerminal: vi.forwardRef(({ dbSessionId }: any, ref: any) => (
    <div data-testid={`terminal-${dbSessionId}`} ref={ref}>Terminal {dbSessionId}</div>
  ))
}));

// Mock environment variable
vi.stubEnv('VITE_FEATURE_SPLIT_VIEW', 'true');

describe('SplitView', () => {
  const mockTask: Task = {
    id: 'task-1',
    project_id: 'project-1',
    name: 'Test Task',
    branch: 'feature/test',
    worktree_path: '/test/path',
    terminals: [
      { dbSessionId: 'term-1', sessionId: 'session-1', tabName: 'Tab 1', tabOrder: 0, aiState: 'idle' },
      { dbSessionId: 'term-2', sessionId: 'session-2', tabName: 'Tab 2', tabOrder: 1, aiState: 'working' },
      { dbSessionId: 'term-3', sessionId: 'session-3', tabName: 'Tab 3', tabOrder: 2, aiState: 'waiting' },
      { dbSessionId: 'term-4', sessionId: 'session-4', tabName: 'Tab 4', tabOrder: 3, aiState: 'not-started' }
    ]
  };

  const mockLayout = {
    mode: 'tab' as const,
    orientation: 'vertical' as const,
    primaryTerminalId: null,
    secondaryTerminalId: null,
    tertiaryTerminalId: null,
    quaternaryTerminalId: null,
    splitRatio: 0.5
  };

  const mockUpdateLayout = vi.fn();

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Mock store implementations
    (useSplitViewStore as any).mockReturnValue({
      updateLayout: mockUpdateLayout,
      toggleSplitMode: vi.fn()
    });

    (useSplitViewStore as any).useSplitLayout = vi.fn(() => mockLayout);

    (useTerminalStore as any).mockReturnValue({
      setTerminals: vi.fn(),
      setActiveTerminal: vi.fn(),
      setFocusedTerminal: vi.fn(),
      addTerminal: vi.fn(),
      removeTerminal: vi.fn(),
      updateTerminal: vi.fn()
    });

    (useTerminalStore as any).useTaskTerminals = vi.fn(() => mockTask.terminals || []);
    (useTerminalStore as any).useActiveTerminalId = vi.fn(() => 'term-1');
    (useTerminalStore as any).useFocusedTerminalId = vi.fn(() => 'term-1');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Viewport Constraints', () => {
    it('should disable split views when viewport is too small', () => {
      // Set small viewport
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      const splitButton = screen.getByTitle('Screen too small for split view');
      expect(splitButton).toBeDefined();
      
      // Clicking should not change mode
      fireEvent.click(splitButton);
      expect(mockUpdateLayout).not.toHaveBeenCalled();
    });

    it('should enable vertical split when width is sufficient', () => {
      // Set viewport wide enough for vertical split
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });

      render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      const splitButton = screen.getByTitle('Enable split view (Alt+D)');
      fireEvent.click(splitButton);
      
      expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
        mode: 'split', 
        orientation: 'vertical' 
      });
    });

    it('should enable horizontal split when height is sufficient', () => {
      // Set viewport tall enough for horizontal split only
      Object.defineProperty(window, 'innerWidth', { value: 900, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });

      render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      const splitButton = screen.getByTitle('Enable split view (Alt+D)');
      fireEvent.click(splitButton);
      
      expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
        mode: 'split', 
        orientation: 'horizontal' 
      });
    });

    it('should enable quad view when viewport is large enough', async () => {
      // Set large viewport
      Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });

      // Start in horizontal split mode
      mockLayout.mode = 'split';
      mockLayout.orientation = 'horizontal';

      render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      const splitButton = screen.getByTitle('Switch to quad view (Alt+D)');
      fireEvent.click(splitButton);
      
      expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
        mode: 'split-4' 
      });
    });
  });

  describe('Auto-downgrade', () => {
    it('should downgrade from quad view when viewport shrinks', async () => {
      // Start with large viewport in quad mode
      Object.defineProperty(window, 'innerWidth', { value: 1600, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 900, configurable: true });
      
      mockLayout.mode = 'split-4';

      const { rerender } = render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      // Shrink viewport
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));

      // Force re-render to trigger effect
      rerender(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
          mode: 'split', 
          orientation: 'horizontal' 
        });
      });
    });

    it('should downgrade from horizontal split when height insufficient', async () => {
      // Start in horizontal split mode
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
      
      mockLayout.mode = 'split';
      mockLayout.orientation = 'horizontal';

      const { rerender } = render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      // Shrink height
      Object.defineProperty(window, 'innerHeight', { value: 500, configurable: true });
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));

      // Force re-render
      rerender(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
          orientation: 'vertical' 
        });
      });
    });

    it('should downgrade to tab mode when no split view possible', async () => {
      // Start in vertical split mode
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });
      
      mockLayout.mode = 'split';
      mockLayout.orientation = 'vertical';

      const { rerender } = render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      // Shrink to tiny viewport
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });
      
      // Trigger resize event
      window.dispatchEvent(new Event('resize'));

      // Force re-render
      rerender(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      await waitFor(() => {
        expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
          mode: 'tab' 
        });
      });
    });
  });

  describe('Keyboard Shortcuts', () => {
    it('should respect viewport constraints when using Alt+D', () => {
      // Set small viewport
      Object.defineProperty(window, 'innerWidth', { value: 800, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 400, configurable: true });

      render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      // Dispatch toggle split event
      document.dispatchEvent(new CustomEvent('terminal-toggle-split'));
      
      // Should not change mode
      expect(mockUpdateLayout).not.toHaveBeenCalled();
    });

    it('should cycle through available modes with Alt+D', () => {
      // Set viewport for vertical and horizontal but not quad
      Object.defineProperty(window, 'innerWidth', { value: 1200, configurable: true });
      Object.defineProperty(window, 'innerHeight', { value: 700, configurable: true });

      const { rerender } = render(
        <TerminalPanel
          task={mockTask}
          validationMode={false}
          onToggleValidation={vi.fn()}
          onToggleSidebar={vi.fn()}
        />
      );

      // First press: tab -> vertical split
      document.dispatchEvent(new CustomEvent('terminal-toggle-split'));
      expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
        mode: 'split', 
        orientation: 'vertical' 
      });

      // Update mock layout
      mockLayout.mode = 'split';
      mockLayout.orientation = 'vertical';
      mockUpdateLayout.mockClear();

      // Second press: vertical -> horizontal
      document.dispatchEvent(new CustomEvent('terminal-toggle-split'));
      expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
        orientation: 'horizontal' 
      });

      // Update mock layout
      mockLayout.orientation = 'horizontal';
      mockUpdateLayout.mockClear();

      // Third press: horizontal -> tab (quad not available)
      document.dispatchEvent(new CustomEvent('terminal-toggle-split'));
      expect(mockUpdateLayout).toHaveBeenCalledWith('task-1', { 
        mode: 'tab' 
      });
    });
  });
});