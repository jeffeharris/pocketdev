import { test, expect, ConsoleMessage } from '@playwright/test';

interface ConsoleError {
  text: string;
  url: string;
  lineNumber?: number;
  columnNumber?: number;
}

test.describe('Console Error Monitoring', () => {
  let consoleErrors: ConsoleError[] = [];
  let consoleWarnings: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    consoleWarnings = [];

    // Capture console errors
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') {
        const location = msg.location();
        consoleErrors.push({
          text: msg.text(),
          url: location.url,
          lineNumber: location.lineNumber,
          columnNumber: location.columnNumber
        });
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Capture page errors (uncaught exceptions)
    page.on('pageerror', (error) => {
      consoleErrors.push({
        text: error.message,
        url: page.url()
      });
    });
  });

  test.afterEach(async () => {
    // Report any console errors found
    if (consoleErrors.length > 0) {
      console.log('Console Errors Found:');
      consoleErrors.forEach(error => {
        console.log(`  - ${error.text}`);
        if (error.lineNumber) {
          console.log(`    at ${error.url}:${error.lineNumber}:${error.columnNumber}`);
        }
      });
    }
  });

  test('Projects page should have no console errors', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('Project dashboard should have no console errors', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href^="/projects/"]');
    const count = await projectCards.count();
    
    if (count > 0) {
      await projectCards.first().click();
      await page.waitForLoadState('networkidle');
      
      expect(consoleErrors).toHaveLength(0);
    }
  });

  test('Task workspace should have no console errors', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href^="/projects/"]');
    const projectCount = await projectCards.count();
    
    if (projectCount > 0) {
      await projectCards.first().click();
      await page.waitForLoadState('networkidle');
      
      const taskCards = page.locator('[data-testid="task-card"], .task-card, a[href*="/tasks/"]');
      const taskCount = await taskCards.count();
      
      if (taskCount > 0) {
        await taskCards.first().click();
        await page.waitForLoadState('networkidle');
        
        expect(consoleErrors).toHaveLength(0);
      }
    }
  });

  test('Prototype pages should have no console errors', async ({ page }) => {
    const prototypePages = [
      '/prototype/merge-workflow',
      '/prototype/merge-states',
      '/prototype/diff-viewers',
      '/prototype/merge-conflict',
      '/prototype/monaco-merge'
    ];
    
    for (const url of prototypePages) {
      consoleErrors = []; // Reset for each page
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // Filter out expected errors in test environment
      const criticalErrors = consoleErrors.filter(error => 
        !error.text.includes('Failed to load real diff') &&
        !error.text.includes('access control checks') &&
        !error.text.includes('Monaco initialization') &&
        !error.text.includes('CDN') &&
        !error.text.includes('cors')
      );
      
      expect(criticalErrors, `Critical console errors on ${url}`).toHaveLength(0);
    }
  });

  test('Test pages should have no console errors', async ({ page }) => {
    const testPages = [
      '/test/terminal-buffer',
      '/test/terminal-raw'
    ];
    
    for (const url of testPages) {
      consoleErrors = []; // Reset for each page
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // Filter out expected errors in test environment
      const criticalErrors = consoleErrors.filter(error => 
        !error.text.includes('access control checks') &&
        !error.text.includes('cors') &&
        !error.text.includes('Load failed')
      );
      
      expect(criticalErrors, `Critical console errors on ${url}`).toHaveLength(0);
    }
  });

  test('API errors should be handled gracefully', async ({ page }) => {
    // Intercept API calls and force errors
    await page.route('**/api/projects', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // There should be no unhandled errors even with API failure
    const unhandledErrors = consoleErrors.filter(error => 
      error.text.includes('Uncaught') || 
      error.text.includes('Unhandled')
    );
    
    expect(unhandledErrors).toHaveLength(0);
  });

  test('WebSocket errors should be handled gracefully', async ({ page }) => {
    // Block WebSocket connections
    await page.route('**/shelltender-ws', route => route.abort());
    await page.route('**/ws', route => route.abort());
    
    await page.goto('/projects');
    await page.waitForTimeout(3000); // Wait for connection attempts
    
    // Filter out expected WebSocket connection errors
    const criticalErrors = consoleErrors.filter(error => 
      !error.text.toLowerCase().includes('websocket') &&
      !error.text.toLowerCase().includes('connection')
    );
    
    // Should handle WebSocket failures without crashing
    expect(criticalErrors).toHaveLength(0);
  });

  test('Check for React development warnings', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Check for common React warnings
    const reactWarnings = consoleWarnings.filter(warning => 
      warning.includes('key prop') ||
      warning.includes('unmounted component') ||
      warning.includes('StrictMode') ||
      warning.includes('useEffect') ||
      warning.includes('dependency array')
    );
    
    // Report but don't fail on warnings (they're not critical)
    if (reactWarnings.length > 0) {
      console.log('React Warnings Found:');
      reactWarnings.forEach(warning => console.log(`  - ${warning}`));
    }
  });

  test('Monitor performance warnings', async ({ page }) => {
    await page.goto('/projects');
    
    // Check for performance-related console messages
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        domInteractive: navigation.domInteractive - navigation.fetchStart
      };
    });
    
    // Warn if page load is slow
    expect(performanceMetrics.domContentLoaded).toBeLessThan(3000);
    expect(performanceMetrics.loadComplete).toBeLessThan(5000);
  });

  test('Check for memory leaks during navigation', async ({ page }) => {
    // Navigate through multiple pages and check memory usage
    const pages = ['/projects', '/prototype/merge-workflow', '/projects'];
    
    for (const url of pages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
    }
    
    // Check if there are any detached DOM warnings
    const memoryWarnings = consoleWarnings.filter(warning => 
      warning.includes('detached') ||
      warning.includes('memory leak') ||
      warning.includes('listeners')
    );
    
    expect(memoryWarnings).toHaveLength(0);
  });
});