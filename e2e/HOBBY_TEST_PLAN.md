# PocketDev Testing Strategy (Hobby Project)

## Philosophy
**"Test what breaks, skip what doesn't"**

As a hobby project, we need pragmatic testing that:
- Catches real bugs users would notice
- Runs fast enough to not annoy you
- Breaks loudly when something important fails
- Ignores cosmetic issues

## Current Reality
- 138 tests created (probably too many)
- ~60% passing due to environment issues
- Finding real bugs (missing API methods)
- Too brittle for a hobby project

## The 80/20 Approach

### 1. Critical Path Tests Only (Keep 20 tests)
Focus on the "happy path" that would embarrass you if broken:

#### Must Work
- [ ] Can navigate to projects page
- [ ] Can view a project (if exists)
- [ ] Terminal loads without JavaScript errors
- [ ] No 500 errors on main pages
- [ ] WebSocket connects (or fails gracefully)

#### Nice to Have
- [ ] Create project flow works
- [ ] Task navigation works
- [ ] Mobile view doesn't break

### 2. Fix Only Show-Stopper Issues

#### Fix Now (Blocking tests)
```javascript
// Missing API method causing console errors
gitService.getComprehensiveDiff() // Add stub or remove call
```

#### Ignore For Now
- Modal detection issues (UI will change anyway)
- WebKit-specific quirks (who uses Safari?)
- Performance warnings (it's fast enough)
- React development warnings (not production)

### 3. Simplified Test Structure

```
e2e/
├── smoke-test.spec.ts      # 5 critical tests - "does it smoke?"
├── user-journey.spec.ts    # 1 complete workflow test
└── console-errors.spec.ts  # Just check for JavaScript errors
```

### 4. Maintenance Strategy

#### When to Run Tests
- Before deploying
- After major refactoring
- When something feels broken

#### When to Update Tests
- When they fail for real bugs (not flakiness)
- When adding major new features
- When removing features

#### When to Delete Tests
- If they fail 3 times for environment reasons
- If they test features you removed
- If they take > 10 seconds each

## Implementation Plan

### Phase 1: Clean House (Today)
1. Delete flaky/slow tests
2. Fix the one API error
3. Reduce to 20 reliable tests

### Phase 2: Core Tests (This Week)
1. One "smoke test" - site loads, no errors
2. One "user journey" - projects → task → terminal
3. One "error check" - no console errors

### Phase 3: Forget About It (Ongoing)
- Run tests when you remember
- Fix only if actually broken
- Add tests only for bugs that hurt

## The Anti-Patterns to Avoid

❌ **Don't**:
- Test every button and link
- Mock everything (test the real thing)
- Aim for 100% coverage
- Test implementation details
- Retry flaky tests more than once

✅ **Do**:
- Test complete user workflows
- Use real data when possible
- Accept 80% coverage is fine
- Test behavior users see
- Delete tests that annoy you

## Success Metrics

Not test coverage percentage, but:
- **Can you deploy confidently?** (main features work)
- **Do tests run in < 30 seconds?** (fast feedback)
- **Do you actually run them?** (not if they're annoying)

## The One-Line Test Philosophy

> "If a user would email me about it being broken, test it. Otherwise, don't."

---

## Quick Fixes Needed

1. **Stub missing API method** in `/frontend/src/services/git.service.ts`:
```javascript
getComprehensiveDiff() {
  console.warn('getComprehensiveDiff not implemented');
  return Promise.resolve({ changes: [] });
}
```

2. **Simplify project creation test** - just check modal opens, don't verify every field

3. **Increase timeouts** globally to 10s (hobby servers are slow)

4. **Delete the 100+ tests** and keep the 20 that matter