# Frontend Testing Guide

This guide explains how to write and run tests for the PocketDev frontend application.

## Test Setup

The project uses Vitest as the test runner with React Testing Library for component testing.

### Running Tests

```bash
# Run tests in watch mode
npm test

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage
```

## Writing Tests

### Store Tests

When testing Zustand stores, follow these patterns:

1. **Reset store state before each test**:
```typescript
beforeEach(() => {
  useMyStore.setState({
    // Initial state
  });
});
```

2. **Use `renderHook` for testing hooks**:
```typescript
const { result } = renderHook(() => useMyStore());
```

3. **Wrap state updates in `act`**:
```typescript
act(() => {
  result.current.updateSomething();
});
```

### Component Tests

Use the custom `renderWithRouter` helper when testing components that use React Router:

```typescript
import { renderWithRouter } from '@/test/testUtils';

test('renders component', () => {
  const { getByText } = renderWithRouter(<MyComponent />, {
    route: '/tasks/123'
  });
  
  expect(getByText('Task Details')).toBeInTheDocument();
});
```

### Mocking

#### Fetch Requests
```typescript
import { mockFetchResponse } from '@/test/testUtils';

global.fetch = vi.fn().mockResolvedValue(
  mockFetchResponse({ data: 'test' })
);
```

#### WebSocket Connections
```typescript
import { MockWebSocket } from '@/test/testUtils';

global.WebSocket = MockWebSocket as any;

// In your test
const ws = new WebSocket('ws://localhost:8080');
ws.simulateMessage({ event: 'test', data: {} });
```

## Test File Structure

```
src/
├── components/
│   ├── MyComponent.tsx
│   └── __tests__/
│       └── MyComponent.test.tsx
├── stores/
│   ├── myStore.ts
│   └── __tests__/
│       └── myStore.test.ts
└── test/
    ├── setup.ts          # Global test setup
    ├── testUtils.tsx     # Test utilities and helpers
    └── README.md         # This file
```

## Best Practices

1. **Test behavior, not implementation**: Focus on what the component/store does, not how it does it.

2. **Use descriptive test names**: Use the format "should [expected behavior] when [condition]".

3. **Keep tests isolated**: Each test should be independent and not rely on other tests.

4. **Mock external dependencies**: Mock API calls, WebSocket connections, and other external services.

5. **Test edge cases**: Include tests for error states, loading states, and empty states.

6. **Use data-testid sparingly**: Prefer accessible queries like `getByRole`, `getByLabelText`, etc.

## Common Testing Patterns

### Testing Async Operations

```typescript
it('should load data asynchronously', async () => {
  const { result } = renderHook(() => useMyStore());
  
  await act(async () => {
    await result.current.loadData();
  });
  
  expect(result.current.data).toBeDefined();
});
```

### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
  
  global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
  
  // Test error handling
  
  consoleError.mockRestore();
});
```

### Testing with Immer

When testing stores that use Immer, remember that the state is immutable:

```typescript
// Don't do this - will throw error
store.layouts.clear();

// Do this instead
useMyStore.setState({
  layouts: new Map()
});
```

## Debugging Tests

1. Use `screen.debug()` to see the current DOM:
```typescript
import { screen } from '@testing-library/react';

screen.debug();
```

2. Use `{ timeout: 5000 }` for debugging async operations:
```typescript
await waitFor(() => {
  expect(element).toBeInTheDocument();
}, { timeout: 5000 });
```

3. Run a single test file:
```bash
npm test src/stores/__tests__/myStore.test.ts
```

4. Run tests matching a pattern:
```bash
npm test -- -t "should update layout"
```