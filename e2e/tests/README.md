# PocketDev E2E Tests - Simplified

<!-- Document Metadata
Created: 2025-09-14
Modified: 2025-09-14
Status: active
-->


This is the **minimal, hobby-project-friendly** E2E test suite for PocketDev.

## Philosophy: "Would a user complain?"

We test for **embarrassing breaks**, not edge cases:
- ✅ Pages load without 500 errors
- ✅ No critical JavaScript errors 
- ✅ Basic navigation works
- ✅ Backend responds
- ❌ Complex user flows
- ❌ Every possible edge case
- ❌ Cross-browser compatibility

## Test Files (11 tests total)

1. **`smoke-test.spec.ts`** (5 tests) - Essential functionality
   - Homepage loads
   - Navigation works  
   - Backend responds
   - WebSocket connects
   - No 500 errors

2. **`user-journey.spec.ts`** (1 test) - Happy path
   - Navigate: projects → dashboard → task

3. **`console-monitor.spec.ts`** (1 test) - Error detection  
   - Check main pages for critical JS errors

## Running Tests

```bash
# Run all tests (should complete in ~30 seconds)
npx playwright test

# Run specific test
npx playwright test smoke-test

# Debug mode
npx playwright test --debug
```

## Configuration

- **Timeout**: 10 seconds (hobby servers are slow)
- **Browsers**: Chromium only (cross-browser testing is overkill)
- **Retries**: 1 retry locally, 2 in CI
- **Videos**: Only on retry failures (save disk space)

## Archived Tests

Complex tests moved to `/archived-tests/`:
- `accessibility.spec.ts` (36 tests)
- `business-logic.spec.ts` (27 tests) 
- `ui-components.spec.ts` (24 tests)
- `navigation.spec.ts` (18 tests)
- `console-monitoring.spec.ts` (33 tests)

These can be restored if needed, but they were too brittle for daily use.

## Design Principles

1. **Fast**: All tests run in < 30 seconds
2. **Reliable**: No flaky tests that fail randomly  
3. **Valuable**: Each test catches real user problems
4. **Simple**: Easy to understand and maintain

Remember: Perfect is the enemy of done. These tests catch the big problems without getting in your way.