# PocketDev E2E Tests

Automated end-to-end tests for PocketDev using Playwright.

## Setup

```bash
cd e2e
npm install
npm run install-browsers
```

## Running Tests

```bash
# Run all tests
npm test

# Run tests with UI mode (interactive)
npm run test:ui

# Run tests in headed mode (see browser)
npm run test:headed

# Debug tests
npm run test:debug

# View test report after run
npm run test:report
```

## Test Coverage

### Console Monitoring Tests (console-monitoring.spec.ts)
- ✅ No console errors on main pages (Projects, Dashboard, Tasks)
- ✅ API error handling (gracefully handles 500 errors)
- ✅ WebSocket error handling (no crashes on connection failure)
- ✅ React development warnings check
- ✅ Performance monitoring (DOM load < 3s, page load < 5s)
- ✅ Memory leak detection during navigation
- ❌ **Found JavaScript Error**: `/prototype/diff-viewers` page
  - Error: `gitService.getComprehensiveDiff is not a function`
  - Missing method implementation in GitService

### Navigation Tests (navigation.spec.ts)
- ✅ Root redirect to /projects
- ✅ Navigate to projects list
- ⚠️  Project creation flow (modal input field detection issue)
- ✅ Navigate to project dashboard
- ✅ Navigate to task workspace
- ✅ Browser back/forward navigation
- ✅ Load prototype pages
- ✅ Load test pages
- ✅ Handle 404 routes
- ✅ Maintain WebSocket connection during navigation

### UI Component Tests (ui-components.spec.ts)
- ✅ Display loading states
- ✅ Show error states
- ✅ Responsive on mobile viewport
- ✅ Handle keyboard navigation
- ✅ Handle form validation
- ✅ Connect to Shelltender WebSocket
- ✅ Handle terminal resize
- ⚠️  Data persistence (WebKit-specific issue)
- ✅ Handle concurrent updates

## Current Status

**80/87 tests passing (92% pass rate)**
- Navigation & UI: 53/57 passing
- Console Monitoring: 27/30 passing

### Known Issues

1. **JavaScript Error on Prototype Page**
   - `/prototype/diff-viewers` throws error: `gitService.getComprehensiveDiff is not a function`
   - Missing method implementation in GitService
   - Affects all browsers

2. **Project Creation Modal** - Input field detection needs refinement
   - The modal opens but the test can't find the repository input field
   - Likely due to dynamic rendering or different input placeholders

3. **WebKit Data Persistence** - Project count inconsistency after reload
   - Only affects WebKit browser
   - Projects show 0 on initial load, 5 after reload

## Prerequisites

Ensure all services are running before tests:

```bash
make dev  # Starts frontend, backend, and shelltender
```

Services should be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:3005
- Shelltender: http://localhost:8080

## Test Architecture

Tests use:
- **Playwright** for browser automation
- **TypeScript** for type safety
- Tests run against Chromium, Firefox, and WebKit
- Automatic retry on failure (in CI)
- Screenshots and videos on failure
- HTML report generation
- **Console monitoring** for JavaScript errors, warnings, and performance issues
- **Global test fixtures** for consistent error tracking across all tests

## Debugging Failed Tests

1. Run specific test file:
   ```bash
   npm test tests/navigation.spec.ts
   ```

2. Run specific test:
   ```bash
   npm test tests/navigation.spec.ts:22
   ```

3. View failure artifacts:
   - Screenshots: `test-results/*/test-failed-*.png`
   - Videos: `test-results/*/video.webm`
   - HTML Report: `npm run test:report`

## Contributing

When adding new tests:
1. Use descriptive test names
2. Include proper waits for dynamic content
3. Use data-testid attributes where possible
4. Group related tests in describe blocks
5. Clean up after tests (close modals, etc.)