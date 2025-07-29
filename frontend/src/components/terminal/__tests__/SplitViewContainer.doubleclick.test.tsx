import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SplitViewContainer } from '../SplitViewContainer';
import { useSplitViewStore, useSplitLayout } from '../../../stores/splitViewStore';
import { useTerminalStore, useTaskTerminals, useFocusedTerminalId } from '../../../stores/terminalStore';

// Mock the stores
vi.mock('../../../stores/splitViewStore');
vi.mock('../../../stores/terminalStore');

// Mock DirectTerminal
vi.mock('../DirectTerminal', () => ({
  DirectTerminal: vi.fn(({ dbSessionId, hasFocus, onFocusRequest }) => (
    <div 
      data-testid={`terminal-${dbSessionId}`}
      data-focus={hasFocus}
      onClick={onFocusRequest}
    >
      Terminal {dbSessionId}
    </div>
  ))
}));

describe('SplitViewContainer - Double Click', () => {
  const mockTerminals = [
    { dbSessionId: 'term1', sessionId: 'session1', tabName: 'Tab 1', tabOrder: 0 },
    { dbSessionId: 'term2', sessionId: 'session2', tabName: 'Tab 2', tabOrder: 1 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock terminal store hooks
    vi.mocked(useTaskTerminals).mockReturnValue(mockTerminals);
    vi.mocked(useFocusedTerminalId).mockReturnValue('term1');
    vi.mocked(useTerminalStore).mockReturnValue({
      setFocusedTerminal: vi.fn(),
    } as any);
  });

  it('should reset split ratio to 50% on double-click', () => {
    const setSplitRatio = vi.fn();
    
    // Mock split layout hook
    vi.mocked(useSplitLayout).mockReturnValue({
      mode: 'split',
      orientation: 'horizontal',
      splitRatio: 0.7, // 70/30 split
      primaryTerminalId: 'term1',
      secondaryTerminalId: 'term2'
    });
    
    // Mock split view store
    vi.mocked(useSplitViewStore).mockReturnValue({
      setSplitRatio,
      setPrimaryTerminal: vi.fn(),
      setSecondaryTerminal: vi.fn(),
      setResizing: vi.fn(),
    } as any);

    render(
      <SplitViewContainer
        taskId="task123"
        projectId="project123"
        worktreePath="/path"
        isVisible={true}
        onSessionStatus={vi.fn()}
        activeTabId="term1"
      />
    );

    // Find the resizer
    const resizer = screen.getByTitle('Drag to resize, double-click to reset to 50/50');
    
    // Double-click the resizer
    fireEvent.doubleClick(resizer);
    
    // Verify setSplitRatio was called with 0.5
    expect(setSplitRatio).toHaveBeenCalledWith('task123', 0.5);
  });

  it('should work in vertical orientation', () => {
    const setSplitRatio = vi.fn();
    
    // Mock split layout hook with vertical orientation
    vi.mocked(useSplitLayout).mockReturnValue({
      mode: 'split',
      orientation: 'vertical',
      splitRatio: 0.3, // 30/70 split
      primaryTerminalId: 'term1',
      secondaryTerminalId: 'term2'
    });
    
    // Mock split view store
    vi.mocked(useSplitViewStore).mockReturnValue({
      setSplitRatio,
      setPrimaryTerminal: vi.fn(),
      setSecondaryTerminal: vi.fn(),
      setResizing: vi.fn(),
    } as any);

    render(
      <SplitViewContainer
        taskId="task123"
        projectId="project123"
        worktreePath="/path"
        isVisible={true}
        onSessionStatus={vi.fn()}
        activeTabId="term1"
      />
    );

    // Find the resizer
    const resizer = screen.getByTitle('Drag to resize, double-click to reset to 50/50');
    
    // Double-click the resizer
    fireEvent.doubleClick(resizer);
    
    // Verify setSplitRatio was called with 0.5
    expect(setSplitRatio).toHaveBeenCalledWith('task123', 0.5);
  });

  it('should prevent default on double-click', () => {
    // Mock split layout hook
    vi.mocked(useSplitLayout).mockReturnValue({
      mode: 'split',
      orientation: 'horizontal',
      splitRatio: 0.6,
      primaryTerminalId: 'term1',
      secondaryTerminalId: 'term2'
    });
    
    // Mock split view store
    vi.mocked(useSplitViewStore).mockReturnValue({
      setSplitRatio: vi.fn(),
      setPrimaryTerminal: vi.fn(),
      setSecondaryTerminal: vi.fn(),
      setResizing: vi.fn(),
    } as any);

    render(
      <SplitViewContainer
        taskId="task123"
        projectId="project123"
        worktreePath="/path"
        isVisible={true}
        onSessionStatus={vi.fn()}
        activeTabId="term1"
      />
    );

    const resizer = screen.getByTitle('Drag to resize, double-click to reset to 50/50');
    
    // Create a double-click event with preventDefault spy
    const event = new MouseEvent('dblclick', { bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    
    // Dispatch the event
    resizer.dispatchEvent(event);
    
    // Verify preventDefault was called
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});