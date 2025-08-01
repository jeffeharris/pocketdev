import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { renderWithRouter, createMockTerminal } from '../../../test/testUtils';
import { SplitViewControls } from '../SplitViewControls';
import { useSplitViewStore, useSplitLayout } from '../../../stores/splitViewStore';
import { useTaskTerminals } from '../../../stores/terminalStore';

// Mock the stores
vi.mock('../../../stores/splitViewStore');
vi.mock('../../../stores/terminalStore');

describe('SplitViewControls', () => {
  const mockProps = {
    taskId: 'test-task-1',
    activeTabId: 'test-db-session-1',
    onTerminalSelect: vi.fn()
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
    toggleSplitMode: vi.fn(),
    updateLayout: vi.fn(),
    swapPanes: vi.fn(),
    setPrimaryTerminal: vi.fn(),
    setSecondaryTerminal: vi.fn()
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup store mocks
    (useSplitLayout as any).mockReturnValue(mockLayout);
    (useSplitViewStore as any).mockReturnValue(mockStoreActions);
    (useTaskTerminals as any).mockReturnValue(mockTerminals);
    
    // Reset window size
    window.innerWidth = 1024;
  });

  afterEach(() => {
    // Clean up any open dropdowns
    fireEvent.click(document.body);
  });

  describe('Visibility', () => {
    it('renders controls when 2+ terminals available', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByTitle(/tab view|split view/i)).toBeInTheDocument();
    });

    it('renders nothing with single terminal', () => {
      (useTaskTerminals as any).mockReturnValue([mockTerminals[0]]);
      
      const { container } = renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing with no terminals', () => {
      (useTaskTerminals as any).mockReturnValue([]);
      
      const { container } = renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('hides on mobile screens', () => {
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
      
      const { container } = renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(container.firstChild).toBeNull();
    });

    it('shows on desktop screens after resize', () => {
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
      
      const { rerender } = renderWithRouter(<SplitViewControls {...mockProps} />);
      
      window.innerWidth = 1024;
      window.dispatchEvent(new Event('resize'));
      
      rerender(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByTitle(/tab view|split view/i)).toBeInTheDocument();
    });
  });

  describe('Mode Toggle', () => {
    it('toggles from tab to split mode', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const toggleButton = screen.getByTitle('Enable split view');
      fireEvent.click(toggleButton);
      
      expect(mockStoreActions.toggleSplitMode).toHaveBeenCalledWith('test-task-1');
    });

    it('toggles from split to tab mode', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
      
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const toggleButton = screen.getByTitle('Switch to tab view');
      fireEvent.click(toggleButton);
      
      expect(mockStoreActions.toggleSplitMode).toHaveBeenCalledWith('test-task-1');
    });

    it('shows correct icon based on mode', () => {
      const { rerender } = renderWithRouter(<SplitViewControls {...mockProps} />);
      
      // Tab mode shows maximize icon
      expect(screen.getByTitle('Enable split view')).toBeInTheDocument();
      
      // Split mode shows columns icon
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
      
      rerender(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByTitle('Switch to tab view')).toBeInTheDocument();
    });
  });

  describe('Orientation Controls', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('shows orientation controls in split mode', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByTitle('Horizontal split')).toBeInTheDocument();
      expect(screen.getByTitle('Vertical split')).toBeInTheDocument();
    });

    it('hides orientation controls in tab mode', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'tab'
      });
      
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.queryByTitle('Horizontal split')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Vertical split')).not.toBeInTheDocument();
    });

    it('switches to horizontal orientation', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        orientation: 'vertical'
      });
      
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      fireEvent.click(screen.getByTitle('Horizontal split'));
      
      expect(mockStoreActions.updateLayout).toHaveBeenCalledWith('test-task-1', {
        orientation: 'horizontal'
      });
    });

    it('switches to vertical orientation', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      fireEvent.click(screen.getByTitle('Vertical split'));
      
      expect(mockStoreActions.updateLayout).toHaveBeenCalledWith('test-task-1', {
        orientation: 'vertical'
      });
    });

    it('highlights active orientation', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const horizontalButton = screen.getByTitle('Horizontal split');
      const verticalButton = screen.getByTitle('Vertical split');
      
      expect(horizontalButton).toHaveClass('bg-blue-600');
      expect(verticalButton).not.toHaveClass('bg-blue-600');
    });
  });

  describe('Terminal Selectors', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('shows terminal selectors in split mode', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const selectors = screen.getAllByRole('button', { name: /Terminal \d|Select Terminal/i });
      // Should have 2 selectors (primary and secondary)
      const terminalSelectors = selectors.filter(btn => 
        btn.textContent?.includes('Terminal') || btn.textContent?.includes('Select Terminal')
      );
      expect(terminalSelectors).toHaveLength(2);
    });

    it('displays selected terminal names', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByText('Terminal 1')).toBeInTheDocument();
      expect(screen.getByText('Terminal 2')).toBeInTheDocument();
    });

    it('opens primary terminal dropdown', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const primarySelector = screen.getAllByRole('button')[3]; // After toggle and orientation buttons
      fireEvent.click(primarySelector);
      
      // Should show all terminals in dropdown
      const dropdown = screen.getAllByRole('button', { name: /Terminal \d/i });
      expect(dropdown.length).toBeGreaterThan(3); // Original buttons + dropdown items
    });

    it('selects primary terminal from dropdown', async () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const primarySelector = screen.getAllByRole('button')[3];
      fireEvent.click(primarySelector);
      
      // Find Terminal 3 in dropdown
      const dropdownItems = screen.getAllByRole('button');
      const terminal3Button = dropdownItems.find(btn => 
        btn.textContent?.includes('Terminal 3') && !btn.textContent?.includes('(in use)')
      );
      
      fireEvent.click(terminal3Button!);
      
      expect(mockStoreActions.setPrimaryTerminal).toHaveBeenCalledWith(
        'test-task-1',
        'test-db-session-3'
      );
      expect(mockProps.onTerminalSelect).toHaveBeenCalledWith('test-db-session-3');
    });

    it('disables already selected terminal in opposite dropdown', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      // Open secondary dropdown
      const secondarySelector = screen.getAllByRole('button')[5]; // After swap button
      fireEvent.click(secondarySelector);
      
      // Find Terminal 1 (primary) in dropdown - should be disabled
      const dropdownItems = screen.getAllByRole('button');
      const terminal1Button = dropdownItems.find(btn => 
        btn.textContent?.includes('Terminal 1') && btn.textContent?.includes('(in use)')
      );
      
      expect(terminal1Button).toBeDisabled();
    });

    it('closes dropdown when clicking outside', async () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const primarySelector = screen.getAllByRole('button')[3];
      fireEvent.click(primarySelector);
      
      // Verify dropdown is open
      expect(screen.getAllByRole('button').length).toBeGreaterThan(6);
      
      // Click outside
      fireEvent.mouseDown(document.body);
      
      await waitFor(() => {
        // Dropdown should be closed
        expect(screen.getAllByRole('button')).toHaveLength(6);
      });
    });

    it('shows placeholder when no terminal selected', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        primaryTerminalId: null,
        secondaryTerminalId: null
      });
      
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getAllByText('Select Terminal')).toHaveLength(2);
    });
  });

  describe('Swap Functionality', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('shows swap button in split mode', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByTitle('Swap terminals')).toBeInTheDocument();
    });

    it('swaps terminals when clicked', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      fireEvent.click(screen.getByTitle('Swap terminals'));
      
      expect(mockStoreActions.swapPanes).toHaveBeenCalledWith('test-task-1');
    });
  });

  describe('Split Ratio Display', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('displays split ratio in split mode', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByText('50% / 50%')).toBeInTheDocument();
    });

    it('updates ratio display', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        splitRatio: 0.7
      });
      
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByText('70% / 30%')).toBeInTheDocument();
    });

    it('rounds ratio percentages', () => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split',
        splitRatio: 0.333
      });
      
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByText('33% / 67%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
    });

    it('provides accessible titles for all controls', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      expect(screen.getByTitle('Switch to tab view')).toBeInTheDocument();
      expect(screen.getByTitle('Horizontal split')).toBeInTheDocument();
      expect(screen.getByTitle('Vertical split')).toBeInTheDocument();
      expect(screen.getByTitle('Swap terminals')).toBeInTheDocument();
    });

    it('uses semantic button elements', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      buttons.forEach(button => {
        expect(button.tagName).toBe('BUTTON');
      });
    });

    it('indicates selected state visually', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      // Mode toggle
      const modeButton = screen.getByTitle('Switch to tab view');
      expect(modeButton).toHaveClass('bg-blue-600');
      
      // Orientation
      const horizontalButton = screen.getByTitle('Horizontal split');
      expect(horizontalButton).toHaveClass('bg-blue-600');
    });
  });

  describe('Edge Cases', () => {
    it('handles terminal selection without callback', () => {
      const props = { ...mockProps, onTerminalSelect: undefined };
      
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
      
      renderWithRouter(<SplitViewControls {...props} />);
      
      const primarySelector = screen.getAllByRole('button')[3];
      fireEvent.click(primarySelector);
      
      const dropdownItems = screen.getAllByRole('button');
      const terminal3Button = dropdownItems.find(btn => 
        btn.textContent?.includes('Terminal 3') && !btn.textContent?.includes('(in use)')
      );
      
      // Should not throw error
      expect(() => fireEvent.click(terminal3Button!)).not.toThrow();
    });

    it('handles rapid mode toggles', () => {
      renderWithRouter(<SplitViewControls {...mockProps} />);
      
      const toggleButton = screen.getByTitle('Enable split view');
      
      // Rapid clicks
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      fireEvent.click(toggleButton);
      
      expect(mockStoreActions.toggleSplitMode).toHaveBeenCalledTimes(3);
    });

    it('maintains dropdown state across re-renders', () => {
      const { rerender } = renderWithRouter(<SplitViewControls {...mockProps} />);
      
      (useSplitLayout as any).mockReturnValue({
        ...mockLayout,
        mode: 'split'
      });
      
      rerender(<SplitViewControls {...mockProps} />);
      
      // Open dropdown
      const primarySelector = screen.getAllByRole('button')[3];
      fireEvent.click(primarySelector);
      
      // Re-render with new props
      rerender(<SplitViewControls {...mockProps} activeTabId="test-db-session-2" />);
      
      // Dropdown should remain open
      expect(screen.getAllByRole('button').length).toBeGreaterThan(6);
    });
  });
});