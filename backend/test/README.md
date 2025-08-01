# Backend Test Suite

This directory contains the test suite for the PocketDev backend, using Vitest as the testing framework.

## Setup

The test dependencies have been added to `package.json`. To install them:

```bash
npm install
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm test -- --watch

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test task-split-layout.test.js

# Run tests in debug mode (shows console output)
DEBUG_TESTS=1 npm test
```

## Test Structure

```
test/
├── controllers/          # Controller tests
│   ├── task-split-layout.test.js
│   └── task-split-layout-edge-cases.test.js
├── utils/               # Test utilities
│   ├── test-app.js      # Express app factory for tests
│   └── test-db.js       # Database setup utilities
├── fixtures/            # Test data fixtures
├── setup.js             # Global test setup
└── README.md            # This file
```

## Writing Tests

### Basic Test Structure

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createTestApp, cleanupTestApp } from '../utils/test-app.js';

describe('Feature Name', () => {
  let testContext;
  
  beforeEach(async () => {
    testContext = await createTestApp();
  });
  
  afterEach(async () => {
    await cleanupTestApp(testContext);
  });
  
  it('should do something', async () => {
    const response = await request(testContext.app)
      .get('/api/endpoint')
      .expect(200);
      
    expect(response.body).toHaveProperty('expectedProperty');
  });
});
```

### Test Database

Tests use an in-memory SQLite database that's created fresh for each test file. The database schema and migrations are automatically applied.

### Mocking

- WebSocket events are automatically mocked via `vi.fn()`
- GitHub authentication is bypassed in tests
- File system operations should be mocked when testing controllers

## Coverage

Run `npm run test:coverage` to generate a coverage report. The report will be available in:
- Terminal output (text summary)
- `coverage/index.html` (detailed HTML report)

## Troubleshooting

### Permission Issues

If you encounter permission issues with node_modules:
1. The tests themselves don't require special permissions
2. You may need to run `npm install` with appropriate permissions

### Database Errors

If tests fail with database errors:
1. Check that all SQL migrations are valid
2. Ensure the schema.sql file is up to date
3. Look for syntax errors in migration files

### Debugging Tests

To debug tests:
1. Set `DEBUG_TESTS=1` to see console output
2. Use `console.log` in tests (will only show with DEBUG_TESTS=1)
3. Use the Vitest UI for interactive debugging: `npm run test:ui`

## Best Practices

1. **Isolation**: Each test should be independent and not rely on other tests
2. **Cleanup**: Always clean up resources in `afterEach`
3. **Descriptive Names**: Use clear, descriptive test names
4. **Edge Cases**: Test both happy paths and error scenarios
5. **Mocking**: Mock external dependencies (file system, network, etc.)
6. **Assertions**: Make specific assertions rather than generic ones

## Split Layout API Tests

The split layout API tests cover:

### Core Functionality
- GET `/api/projects/:projectId/tasks/:taskId/split-layout`
- PUT `/api/projects/:projectId/tasks/:taskId/split-layout`

### Test Coverage
- ✅ Default layout returns
- ✅ Custom layout persistence
- ✅ Validation of mode ('tab' | 'split')
- ✅ Validation of orientation ('horizontal' | 'vertical')
- ✅ Validation of split ratio (0.1 - 0.9)
- ✅ Task not found scenarios
- ✅ Cross-project security
- ✅ WebSocket event broadcasting
- ✅ Database error handling
- ✅ Concurrent update handling
- ✅ Edge cases and malformed input

### Example Test Data

```javascript
// Default layout structure
{
  mode: 'tab',
  orientation: 'horizontal',
  primaryTerminalId: null,
  secondaryTerminalId: null,
  splitRatio: 0.5
}

// Valid split layout
{
  mode: 'split',
  orientation: 'vertical',
  primaryTerminalId: 'term-123',
  secondaryTerminalId: 'term-456',
  splitRatio: 0.7
}
```