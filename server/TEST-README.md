# PocketDev Database Testing Suite

## Overview

This test suite provides comprehensive coverage for the SQLite database implementation including:
- Database initialization and schema validation
- Model CRUD operations
- API endpoint integration tests
- Worktree cleanup functionality
- Session analytics tracking

## Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run only database tests
npm run test:db

# Run only API tests
npm run test:api
```

## Test Structure

```
__tests__/
├── setup.js                    # Test environment setup
├── helpers/
│   └── database.js            # Database test utilities
├── db/
│   ├── database.test.js       # Database initialization tests
│   └── models/
│       ├── project.test.js    # Project model tests
│       ├── task.test.js       # Task model tests
│       └── session.test.js    # Session model tests
└── api/
    ├── projects.test.js       # Project API endpoints
    ├── tasks.test.js          # Task API endpoints
    └── cleanup.test.js        # Cleanup API endpoints
```

## Test Categories

### 1. Database Initialization Tests (`db/database.test.js`)
- Database creation and connection
- Table creation verification
- Foreign key constraint enforcement
- Index creation verification
- Transaction rollback testing
- Concurrent connection handling

### 2. Model Tests (`db/models/*.test.js`)

#### Project Model Tests
- Create projects with auto-generated and custom IDs
- Find projects by ID and repository URL
- List all projects with filtering
- Update project fields and metadata
- Archive and delete projects with cascade
- Task count aggregation

#### Task Model Tests
- Create tasks with worktree registration
- Find tasks with project and session info
- List tasks by project with filtering
- Update task status and metadata
- Archive tasks and mark worktrees as orphaned
- Delete tasks with proper cleanup

#### Session Model Tests
- Create sessions with analytics
- Find sessions by task
- Update session analytics and token usage
- Aggregate analytics across sessions
- Track tool usage statistics

### 3. API Integration Tests (`api/*.test.js`)
- HTTP endpoint testing with supertest
- Request/response validation
- Error handling and status codes
- Database state verification
- Cascading operations

## Writing New Tests

### Test Template
```javascript
describe('Feature Name', () => {
  let db;
  let model;

  beforeEach(async () => {
    db = await createTestDatabase();
    model = new ModelClass(db);
  });

  afterEach(async () => {
    await clearDatabase(db);
    await db.close();
  });

  test('should do something', async () => {
    // Arrange
    const data = { /* test data */ };
    
    // Act
    const result = await model.method(data);
    
    // Assert
    expect(result).toBeDefined();
    expect(result.property).toBe(expectedValue);
  });
});
```

### Best Practices
1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Descriptive Names**: Use clear test descriptions
4. **Edge Cases**: Test error conditions and boundaries
5. **Assertions**: Be specific about expectations

## Coverage Goals

Target coverage metrics:
- Overall: 80%+
- Models: 90%+
- Critical paths: 100%

## Debugging Tests

```bash
# Run specific test file
npx jest __tests__/db/models/project.test.js

# Run tests matching pattern
npx jest --testNamePattern="should create"

# Debug with Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand

# Verbose output
npm test -- --verbose
```

## Common Issues

### 1. Database Lock Errors
- Ensure previous test databases are cleaned up
- Check for unclosed database connections

### 2. Foreign Key Failures
- Verify test data relationships
- Check cascade delete configuration

### 3. Async Timeout
- Increase test timeout for slow operations
- Use `jest.setTimeout(10000)` for longer tests

## CI/CD Integration

The test suite is designed to run in CI environments:
- Uses in-memory SQLite for speed
- Automatic cleanup of test files
- Consistent test database path
- No external dependencies required