# Split Views Component Tests

This directory contains comprehensive test suites for the split view terminal feature components.

## Test Files

### SplitViewContainer.test.tsx
Tests the main container component that manages split view layout and terminal rendering.

**Coverage includes:**
- Tab mode vs split mode rendering
- Terminal auto-assignment logic
- Resizing functionality with mouse drag
- Layout persistence with debouncing
- Session status forwarding
- Edge cases (empty terminals, missing references)
- Responsive behavior

### SplitViewControls.test.tsx
Tests the control bar component for managing split view settings.

**Coverage includes:**
- Mode toggle (tab/split)
- Orientation controls (horizontal/vertical)
- Terminal selection dropdowns
- Swap functionality
- Split ratio display
- Mobile responsiveness
- Accessibility features
- Dropdown interaction and closing

## Running Tests

```bash
# Run all split view tests
npm test -- src/components/terminal/__tests__/SplitView --run

# Run individual test files
npm test -- src/components/terminal/__tests__/SplitViewContainer.test.tsx --run
npm test -- src/components/terminal/__tests__/SplitViewControls.test.tsx --run

# Run in watch mode
npm test -- src/components/terminal/__tests__/SplitView
```

## Test Patterns

### Mocking Stores
Both components use Zustand stores which are mocked at the module level:

```typescript
vi.mock('../../../stores/splitViewStore', () => ({
  useSplitLayout: vi.fn(),
  useSplitViewStore: vi.fn(),
  persistLayout: vi.fn()
}));
```

### Mocking DirectTerminal
The DirectTerminal component is mocked to avoid complex terminal setup:

```typescript
vi.mock('../DirectTerminal', () => ({
  DirectTerminal: vi.fn(({ dbSessionId, onSessionStatus }: any) => (
    <div data-testid={`terminal-${dbSessionId}`}>
      Mock Terminal: {dbSessionId}
    </div>
  ))
}));
```

### Testing Responsive Behavior
Tests simulate window resize events to verify mobile/desktop behavior:

```typescript
window.innerWidth = 500;
window.dispatchEvent(new Event('resize'));
```

### Testing Mouse Interactions
Resize functionality is tested using fireEvent for mouse events:

```typescript
fireEvent.mouseDown(resizer);
fireEvent.mouseMove(document, { clientX: 700 });
fireEvent.mouseUp(document);
```

## Known Issues

- Minor warning about `act()` wrapper in resize tests - doesn't affect test reliability
- Floating point precision in split ratio calculations handled with `toBeCloseTo()`