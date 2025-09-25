# Archived E2E Tests

<!-- Document Metadata
Created: 2025-09-14
Modified: 2025-09-14
Status: active
-->


These tests were moved here as part of the hobby project simplification.

**Why archived?**
- Too complex for daily development (138 tests → 7 tests)  
- Many environment-dependent failures (60% pass rate)
- Slow execution (5+ minutes vs 30 seconds)
- Testing edge cases rather than user-facing issues

**Original test files:**
- `accessibility.spec.ts` - Accessibility compliance tests
- `business-logic.spec.ts` - Complex business logic scenarios  
- `ui-components.spec.ts` - Component interaction tests
- `navigation.spec.ts` - Detailed navigation flows
- `console-monitoring.spec.ts` - Comprehensive error tracking

**To restore a test:**
1. Move the file back to `/tests/`
2. Update imports if needed
3. Verify it works with current codebase

**Current philosophy:** Test what users care about, not what developers can break.

The new minimal suite in `/tests/` focuses on embarrassing failures that would make users complain immediately.