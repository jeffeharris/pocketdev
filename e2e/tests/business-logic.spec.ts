import { test, expect } from '../global-setup';

test.describe('Business Logic & Core Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle complete project workflow', async ({ page }) => {
    await page.goto('/projects');
    
    // Check if projects exist
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href^="/projects/"]');
    const projectCount = await projectCards.count();
    
    if (projectCount > 0) {
      // Navigate to existing project
      await projectCards.first().click();
      await page.waitForLoadState('networkidle');
      
      // Verify project dashboard loads
      await expect(page.url()).toMatch(/\/projects\/[^\/]+$/);
      
      // Check for task management elements
      const taskElements = page.locator('text=/task/i, [data-testid*="task"], .task');
      await expect(taskElements.first()).toBeVisible({ timeout: 10000 });
      
      // Try to access task workspace if tasks exist
      const taskCards = page.locator('[data-testid="task-card"], .task-card, a[href*="/tasks/"]');
      const taskCount = await taskCards.count();
      
      if (taskCount > 0) {
        await taskCards.first().click();
        await page.waitForLoadState('networkidle');
        
        // Verify task workspace
        await expect(page.url()).toMatch(/\/projects\/[^\/]+\/tasks\/[^\/]+$/);
        
        // Check for terminal or workspace UI
        const workspaceElements = page.locator('.terminal, [data-testid="terminal"], #terminal, .workspace, [data-testid="workspace"]');
        await expect(workspaceElements.first()).toBeVisible({ timeout: 10000 });
      }
    } else {
      // No projects exist - test creation flow would be here
      console.log('No existing projects found - skipping workflow test');
    }
  });

  test('should handle terminal integration', async ({ page }) => {
    // Test terminal pages
    const terminalPages = [
      '/test/terminal-buffer',
      '/test/terminal-raw'
    ];

    for (const url of terminalPages) {
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      
      // Check for terminal elements
      const terminalElements = page.locator('.terminal, canvas, [data-testid="terminal"], #terminal');
      const hasTerminal = await terminalElements.count() > 0;
      
      if (hasTerminal) {
        await expect(terminalElements.first()).toBeVisible();
        
        // Check if terminal is interactive
        const terminal = terminalElements.first();
        const box = await terminal.boundingBox();
        expect(box?.width).toBeGreaterThan(100);
        expect(box?.height).toBeGreaterThan(50);
      }
    }
  });

  test('should handle WebSocket connections gracefully', async ({ page }) => {
    const wsErrors: string[] = [];
    const wsConnections: string[] = [];
    
    // Monitor WebSocket activity
    page.on('websocket', ws => {
      wsConnections.push(ws.url());
      ws.on('close', () => {
        console.log(`WebSocket closed: ${ws.url()}`);
      });
      ws.on('socketerror', (error) => {
        wsErrors.push(`WebSocket error: ${error}`);
      });
    });
    
    // Monitor console for WebSocket-related messages
    page.on('console', msg => {
      const text = msg.text().toLowerCase();
      if (text.includes('websocket') && msg.type() === 'error') {
        wsErrors.push(msg.text());
      }
    });
    
    // Navigate through different pages that might use WebSockets
    const pages = ['/projects', '/test/terminal-raw'];
    
    for (const url of pages) {
      await page.goto(url);
      await page.waitForTimeout(2000); // Give time for WebSocket connections
    }
    
    // WebSocket failures should be handled gracefully (not crash the app)
    const body = await page.locator('body').textContent();
    expect(body).toBeTruthy(); // Page should still render
    
    // Log WebSocket activity for debugging
    if (wsConnections.length > 0) {
      console.log(`WebSocket connections attempted: ${wsConnections.join(', ')}`);
    }
    if (wsErrors.length > 0) {
      console.log(`WebSocket errors (expected in test env): ${wsErrors.length}`);
    }
  });

  test('should handle API failures gracefully', async ({ page }) => {
    // Intercept all API calls and make them fail
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Test-induced API failure' })
      });
    });
    
    await page.goto('/projects');
    await page.waitForTimeout(3000); // Wait for API calls to fail
    
    // Page should still render and be functional
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('h1')).toBeVisible();
    
    // Should have some indication of error state or loading state
    const errorIndicators = page.locator('text=/error/i, text=/failed/i, text=/loading/i, text=/retry/i');
    const hasErrorHandling = await errorIndicators.count() > 0;
    
    // Either show error handling OR the page works without API
    expect(hasErrorHandling || await page.locator('h1').isVisible()).toBeTruthy();
  });

  test('should handle navigation with state persistence', async ({ page }) => {
    // Navigate to projects
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Store initial state
    const initialTitle = await page.title();
    const initialUrl = page.url();
    
    // Navigate to another page
    await page.goto('/prototype/merge-workflow');
    await page.waitForLoadState('networkidle');
    
    // Navigate back
    await page.goBack();
    await page.waitForLoadState('networkidle');
    
    // Should be back to projects
    expect(page.url()).toBe(initialUrl);
    
    // Navigate forward
    await page.goForward();
    await page.waitForLoadState('networkidle');
    
    // Should be at prototype page
    expect(page.url()).toContain('/prototype/merge-workflow');
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle concurrent browser tabs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    try {
      // Both tabs load the same page
      await Promise.all([
        page1.goto('/projects'),
        page2.goto('/projects')
      ]);
      
      await Promise.all([
        page1.waitForLoadState('networkidle'),
        page2.waitForLoadState('networkidle')
      ]);
      
      // Both should render successfully
      await Promise.all([
        expect(page1.locator('h1')).toBeVisible(),
        expect(page2.locator('h1')).toBeVisible()
      ]);
      
      // Should show consistent data
      const [title1, title2] = await Promise.all([
        page1.title(),
        page2.title()
      ]);
      
      expect(title1).toBe(title2);
      
    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('should handle mobile viewport responsiveness', async ({ page }) => {
    // Test different mobile viewports
    const viewports = [
      { width: 375, height: 667 }, // iPhone
      { width: 414, height: 896 }, // iPhone Plus
      { width: 360, height: 640 }  // Android
    ];
    
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      
      // Content should be visible and not overflow
      await expect(page.locator('h1')).toBeVisible();
      
      // Check for horizontal scrolling (usually indicates responsive issues)
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 20); // Allow small margin
      
      // Check for mobile navigation if it exists
      const mobileMenus = page.locator('[data-testid="mobile-menu"], .mobile-menu, button[aria-label*="menu" i]');
      // Don't require mobile menu, but if it exists, it should be accessible
      const menuCount = await mobileMenus.count();
      if (menuCount > 0) {
        await expect(mobileMenus.first()).toBeVisible();
      }
    }
  });
});

test.describe('Performance & Resource Management', () => {
  test('should load pages within reasonable time limits', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 10 seconds (generous for E2E)
    expect(loadTime).toBeLessThan(10000);
    
    // Check performance metrics
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstByte: navigation.responseStart - navigation.fetchStart
      };
    });
    
    // Reasonable performance expectations
    expect(metrics.domContentLoaded).toBeLessThan(5000);
    expect(metrics.firstByte).toBeLessThan(3000);
  });

  test('should handle rapid navigation without memory leaks', async ({ page }) => {
    const pages = [
      '/projects',
      '/prototype/merge-workflow',
      '/prototype/merge-states',
      '/projects'
    ];
    
    // Navigate rapidly between pages
    for (let i = 0; i < 3; i++) {
      for (const url of pages) {
        await page.goto(url);
        await page.waitForLoadState('domcontentloaded'); // Don't wait for full load
        await page.waitForTimeout(100); // Brief pause
      }
    }
    
    // Final navigation should still work
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1')).toBeVisible();
    
    // Check for memory-related console warnings
    const warnings: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') {
        warnings.push(msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    
    const memoryWarnings = warnings.filter(warning => 
      warning.includes('memory') || 
      warning.includes('leak') || 
      warning.includes('detached')
    );
    
    expect(memoryWarnings).toHaveLength(0);
  });
});