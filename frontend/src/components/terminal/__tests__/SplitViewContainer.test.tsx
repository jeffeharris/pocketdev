import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithRouter, createMockTerminal } from '../../../test/testUtils';
import { SplitViewContainer } from '../SplitViewContainer';
import { useSplitViewStore, useSplitLayout, persistLayout } from '../../../stores/splitViewStore';
import { useTaskTerminals } from '../../../stores/terminalStore';
import type { DirectTerminalHandle } from '../DirectTerminal';

// Mock the DirectTerminal component
vi.mock('../DirectTerminal', () => ({
  DirectTerminal: vi.fn(({ dbSessionId, onSessionStatus }: any) => (
    <div data-testid={`terminal-${dbSessionId}`}>
      <button onClick={() => onSessionStatus('connected')}>Connect</button>
      <button onClick={() => onSessionStatus('disconnected')}>Disconnect</button>
      <button onClick={() => onSessionStatus('error')}>Error</button>
      Mock Terminal: {dbSessionId}
    </div>
  ))
}));

// Mock the stores
vi.mock('../../../stores/splitViewStore', () => ({
  useSplitLayout: vi.fn(),
  useSplitViewStore: vi.fn(),
  persistLayout: vi.fn()
}));

vi.mock('../../../stores/terminalStore', () => ({
  useTaskTerminals: vi.fn(),
  useFocusedTerminalId: vi.fn(),
  useTerminalStore: vi.fn()
}));

describe('SplitViewContainer', () => {
  const mockProps = {
    taskId: 'test-task-1',
    projectId: 'test-project-1',
    worktreePath: '/test/worktree',
    isVisible: true,
    onSessionStatus: vi.fn(),
    activeTabId: 'test-db-session-1'
  };

  const mockTerminals = [
    createMockTerminal({ dbSessionId: 'test-db-session-1', tabName: 'Terminal 1' }),
    createMockTerminal({ dbSessionId: 'test-db-session-2', tabName: 'Terminal 2' }),
    createMockTerminal({ dbSessionId: 'test-db-session-3', tabName: 'Terminal 3' })
  ];

  const mockLayout = {
    mode: 'tab' as const,
    orientation: 'horizontal' as const,
    primaryTerminalId: 'test-db-session-1',
    secondaryTerminalId: 'test-db-session-2',
    splitRatio: 0.5
  };

  const mockStoreActions = {
    setSplitRatio: vi.fn(),
    setResizing: vi.fn(),
    setPrimaryTerminal: vi.fn(),
    setSecondaryTerminal: vi.fn(),
    setTertiaryTerminal: vi.fn(),
    setQuaternaryTerminal: vi.fn(),
    updateLayout: vi.fn(),
    swapPanes: vi.fn()
  };
  
  const mockTerminalStoreActions = {
    setFocusedTerminal: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup store mocks
    (useSplitLayout as any).mockReturnValue(mockLayout);
    (useSplitViewStore as any).mockReturnValue(mockStoreActions);
    (useTaskTerminals as any).mockReturnValue(mockTerminals);
    (useFocusedTerminalId as any).mockReturnValue('test-db-session-1');
    (useTerminalStore as any).mockReturnValue(mockTerminalStoreActions);
  });

  describe('Tab Mode', () => {
    it('renders single terminal in tab mode', () => {
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
      expect(screen.queryByTestId('terminal-test-db-session-2')).not.toBeInTheDocument();
    });

    it('renders active terminal based on activeTabId', () => {
      const props = { ...mockProps, activeTabId: 'test-db-session-2' };
      renderWithRouter(<SplitViewContainer {...props} />);
      
      expect(screen.getByTestId('terminal-test-db-session-2')).toBeInTheDocument();
      expect(screen.queryByTestId('terminal-test-db-session-1')).not.toBeInTheDocument();
    });

    it('renders nothing if no active terminal found', () => {
      (useTaskTerminals as any).mockReturnValue([]);
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(container.firstChild).toBeNull();
    });
  });

  describe('Split Mode', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('renders both terminals in split mode', () => {
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-test-db-session-2')).toBeInTheDocument();
    });

    it('renders with horizontal orientation', () => {
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const splitContainer = container.querySelector('.flex-row');
      expect(splitContainer).toBeInTheDocument();
    });

    it('renders with vertical orientation', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        orientation: 'vertical'
      });
      
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const splitContainer = container.querySelector('.flex-col');
      expect(splitContainer).toBeInTheDocument();
    });

    it('applies correct split ratio to panes', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        splitRatio: 0.7
      });
      
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const panes = container.querySelectorAll('.relative.overflow-hidden');
      // Check width styles are approximately correct (accounting for floating point precision)
      const firstPaneStyle = window.getComputedStyle(panes[0]);
      const secondPaneStyle = window.getComputedStyle(panes[1]);
      expect(firstPaneStyle.width).toBe('70%');
      // Allow for floating point precision issues
      expect(parseFloat(secondPaneStyle.width)).toBeCloseTo(30, 5);
    });

    it('renders resizer between panes', () => {
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const resizer = container.querySelector('.cursor-col-resize');
      expect(resizer).toBeInTheDocument();
    });

    it('falls back to tab mode with insufficient terminals', () => {
      (useTaskTerminals as any).mockReturnValue([mockTerminals[0]]);
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
      expect(screen.queryByTestId('terminal-test-db-session-2')).not.toBeInTheDocument();
    });
  });

  describe('Resizing', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('initiates resize on resizer mousedown', () => {
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const resizer = container.querySelector('.cursor-col-resize')!;
      fireEvent.mouseDown(resizer);
      
      expect(mockStoreActions.setResizing).toHaveBeenCalledWith(true);
    });

    it('updates split ratio during horizontal resize', async () => {
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      // Mock container dimensions
      const mockBoundingRect = {
        left: 0,
        top: 0,
        width: 1000,
        height: 600
      };
      
      container.firstElementChild!.getBoundingClientRect = vi.fn().mockReturnValue(mockBoundingRect);
      
      const resizer = container.querySelector('.cursor-col-resize')!;
      fireEvent.mouseDown(resizer);
      
      // Simulate mouse move
      fireEvent.mouseMove(document, { clientX: 700 });
      
      await waitFor(() => {
        expect(mockStoreActions.setSplitRatio).toHaveBeenCalledWith('test-task-1', 0.7);
      });
      
      // Release mouse
      fireEvent.mouseUp(document);
      
      expect(mockStoreActions.setResizing).toHaveBeenCalledWith(false);
    });

    it('updates split ratio during vertical resize', async () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        orientation: 'vertical'
      });
      
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      // Mock container dimensions
      const mockBoundingRect = {
        left: 0,
        top: 0,
        width: 1000,
        height: 600
      };
      
      container.firstElementChild!.getBoundingClientRect = vi.fn().mockReturnValue(mockBoundingRect);
      
      const resizer = container.querySelector('.cursor-row-resize')!;
      fireEvent.mouseDown(resizer);
      
      // Simulate mouse move
      fireEvent.mouseMove(document, { clientY: 180 });
      
      await waitFor(() => {
        expect(mockStoreActions.setSplitRatio).toHaveBeenCalledWith('test-task-1', 0.3);
      });
    });

    it('clamps split ratio between 0.1 and 0.9', async () => {
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const mockBoundingRect = {
        left: 0,
        top: 0,
        width: 1000,
        height: 600
      };
      
      container.firstElementChild!.getBoundingClientRect = vi.fn().mockReturnValue(mockBoundingRect);
      
      const resizer = container.querySelector('.cursor-col-resize')!;
      fireEvent.mouseDown(resizer);
      
      // Try to resize beyond limits
      fireEvent.mouseMove(document, { clientX: 50 });
      
      await waitFor(() => {
        expect(mockStoreActions.setSplitRatio).toHaveBeenCalledWith('test-task-1', 0.1);
      });
      
      fireEvent.mouseMove(document, { clientX: 950 });
      
      await waitFor(() => {
        expect(mockStoreActions.setSplitRatio).toHaveBeenCalledWith('test-task-1', 0.9);
      });
    });
  });

  describe('Auto-assignment', () => {
    it('auto-assigns primary terminal when not set', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        primaryTerminalId: null
      });
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(mockStoreActions.setPrimaryTerminal).toHaveBeenCalledWith(
        'test-task-1',
        'test-db-session-1'
      );
    });

    it('auto-assigns secondary terminal when not set', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        secondaryTerminalId: null
      });
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(mockStoreActions.setSecondaryTerminal).toHaveBeenCalledWith(
        'test-task-1',
        'test-db-session-2'
      );
    });

    it('reassigns terminals when selected ones no longer exist', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        primaryTerminalId: 'non-existent-1',
        secondaryTerminalId: 'non-existent-2'
      });
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(mockStoreActions.setPrimaryTerminal).toHaveBeenCalled();
      expect(mockStoreActions.setSecondaryTerminal).toHaveBeenCalled();
    });
  });

  describe('Session Status', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('forwards session status from primary terminal', () => {
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const primaryTerminal = screen.getByTestId('terminal-test-db-session-1');
      fireEvent.click(primaryTerminal.querySelector('button')!);
      
      expect(mockProps.onSessionStatus).toHaveBeenCalledWith(
        'test-db-session-1',
        'connected'
      );
    });

    it('forwards session status from secondary terminal', () => {
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const secondaryTerminal = screen.getByTestId('terminal-test-db-session-2');
      const buttons = secondaryTerminal.querySelectorAll('button');
      fireEvent.click(buttons[2]); // Error button
      
      expect(mockProps.onSessionStatus).toHaveBeenCalledWith(
        'test-db-session-2',
        'error'
      );
    });
  });

  describe('Layout Persistence', () => {
    it('persists layout changes with debounce', async () => {
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      // Layout changes should trigger persistence
      await waitFor(() => {
        expect(persistLayout).not.toHaveBeenCalled();
      });
      
      // Wait for debounce
      await waitFor(() => {
        expect(persistLayout).toHaveBeenCalledWith('test-task-1', 'test-project-1');
      }, { timeout: 600 });
    });

    it('does not persist layout without projectId', async () => {
      const props = { ...mockProps, projectId: undefined };
      renderWithRouter(<SplitViewContainer {...props} />);
      
      await waitFor(() => {
        expect(persistLayout).not.toHaveBeenCalled();
      }, { timeout: 600 });
    });
  });

  describe('Quad View (Split-4)', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split-4',
        tertiaryTerminalId: 'test-db-session-3',
        quaternaryTerminalId: 'test-db-session-4'
      });
      
      // Add a 4th terminal for quad view
      const fourTerminals = [
        ...mockTerminals,
        createMockTerminal({ dbSessionId: 'test-db-session-4', tabName: 'Terminal 4' })
      ];
      (useTaskTerminals as any).mockReturnValue(fourTerminals);
    });

    it('renders four terminals in quad view', () => {
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-test-db-session-2')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-test-db-session-3')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-test-db-session-4')).toBeInTheDocument();
    });

    it('uses CSS Grid for quad layout', () => {
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const gridContainer = container.querySelector('[style*="grid-template-columns"]');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer?.getAttribute('style')).toContain('grid-template-columns: 1fr 1fr');
      expect(gridContainer?.getAttribute('style')).toContain('grid-template-rows: 1fr 1fr');
    });

    it('auto-assigns all four terminals in quad mode', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split-4',
        primaryTerminalId: null,
        secondaryTerminalId: null,
        tertiaryTerminalId: null,
        quaternaryTerminalId: null
      });
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(mockStoreActions.setPrimaryTerminal).toHaveBeenCalledWith('test-task-1', 'test-db-session-1');
      expect(mockStoreActions.setSecondaryTerminal).toHaveBeenCalledWith('test-task-1', 'test-db-session-2');
      expect(mockStoreActions.setTertiaryTerminal).toHaveBeenCalledWith('test-task-1', 'test-db-session-3');
      expect(mockStoreActions.setQuaternaryTerminal).toHaveBeenCalledWith('test-task-1', 'test-db-session-4');
    });
  });

  describe('Placeholders', () => {
    it('shows placeholder in split view with one terminal', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        primaryTerminalId: 'test-db-session-1',
        secondaryTerminalId: null
      });
      (useTaskTerminals as any).mockReturnValue([mockTerminals[0]]);
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
      expect(screen.getByText('+ Add Terminal')).toBeInTheDocument();
    });

    it('shows two placeholders with no terminals', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        primaryTerminalId: null,
        secondaryTerminalId: null
      });
      (useTaskTerminals as any).mockReturnValue([]);
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const addButtons = screen.getAllByText('+ Add Terminal');
      expect(addButtons).toHaveLength(2);
    });

    it('shows placeholders in quad view with fewer than 4 terminals', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split-4',
        primaryTerminalId: 'test-db-session-1',
        secondaryTerminalId: 'test-db-session-2',
        tertiaryTerminalId: null,
        quaternaryTerminalId: null
      });
      (useTaskTerminals as any).mockReturnValue([mockTerminals[0], mockTerminals[1]]);
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
      expect(screen.getByTestId('terminal-test-db-session-2')).toBeInTheDocument();
      
      const addButtons = screen.getAllByText('+ Add Terminal');
      expect(addButtons).toHaveLength(2);
    });

    it('dispatches new terminal event when clicking placeholder', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        primaryTerminalId: 'test-db-session-1',
        secondaryTerminalId: null
      });
      (useTaskTerminals as any).mockReturnValue([mockTerminals[0]]);
      
      const dispatchSpy = vi.spyOn(document, 'dispatchEvent');
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      const addButton = screen.getByText('+ Add Terminal');
      fireEvent.click(addButton);
      
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'terminal-new-tab'
        })
      );
    });
  });

  describe('Control Buttons', () => {
    it('shows control buttons in top-right pane of quad view', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split-4',
        primaryTerminalId: 'test-db-session-1',
        secondaryTerminalId: 'test-db-session-2',
        tertiaryTerminalId: 'test-db-session-3',
        quaternaryTerminalId: 'test-db-session-4'
      });
      
      const controlButtons = <button data-testid="test-control">Control</button>;
      
      renderWithRouter(
        <SplitViewContainer {...mockProps} controlButtons={controlButtons} />
      );
      
      expect(screen.getByTestId('test-control')).toBeInTheDocument();
    });

    it('shows control buttons in placeholder when top-right is empty', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split-4',
        primaryTerminalId: 'test-db-session-1',
        secondaryTerminalId: null,
        tertiaryTerminalId: null,
        quaternaryTerminalId: null
      });
      (useTaskTerminals as any).mockReturnValue([mockTerminals[0]]);
      
      const controlButtons = <button data-testid="test-control">Control</button>;
      
      renderWithRouter(
        <SplitViewContainer {...mockProps} controlButtons={controlButtons} />
      );
      
      expect(screen.getByTestId('test-control')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty terminals array', () => {
      (useTaskTerminals as any).mockReturnValue([]);
      
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('handles missing terminal references gracefully', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        primaryTerminalId: 'missing-1',
        secondaryTerminalId: 'missing-2'
      });
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      // Should auto-assign available terminals
      expect(mockStoreActions.setPrimaryTerminal).toHaveBeenCalled();
      expect(mockStoreActions.setSecondaryTerminal).toHaveBeenCalled();
    });

    it('maintains terminal visibility state', () => {
      const { rerender } = renderWithRouter(
        <SplitViewContainer {...mockProps} isVisible={false} />
      );
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
      
      rerender(<SplitViewContainer {...mockProps} isVisible={true} />);
      
      expect(screen.getByTestId('terminal-test-db-session-1')).toBeInTheDocument();
    });

    it('clears terminal assignments when terminals are removed', () => {
      // Start with 4 terminals in quad mode
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split-4',
        primaryTerminalId: 'test-db-session-1',
        secondaryTerminalId: 'test-db-session-2',
        tertiaryTerminalId: 'test-db-session-3',
        quaternaryTerminalId: 'test-db-session-4'
      });
      
      // But only 2 terminals exist
      (useTaskTerminals as any).mockReturnValue([mockTerminals[0], mockTerminals[1]]);
      
      renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      // Should clear the missing terminals
      expect(mockStoreActions.setTertiaryTerminal).toHaveBeenCalledWith('test-task-1', null);
      expect(mockStoreActions.setQuaternaryTerminal).toHaveBeenCalledWith('test-task-1', null);
    });

    it('handles double-click on resizer in quad view', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split-4'
      });
      
      const { container } = renderWithRouter(<SplitViewContainer {...mockProps} />);
      
      // Should not have a resizer in quad view
      const resizer = container.querySelector('.cursor-col-resize');
      expect(resizer).not.toBeInTheDocument();
    });
  });
});