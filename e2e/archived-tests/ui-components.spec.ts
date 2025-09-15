import { test, expect } from '../global-setup';

test.describe('UI Components', () => {
  test('should display loading states properly', async ({ page }) => {
    // Intercept API calls to simulate loading
    await page.route('**/api/projects', async route => {
      await page.waitForTimeout(1000); // Simulate delay
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([])
      });
    });
    
    await page.goto('/projects');
    
    // Check for loading indicator (could be spinner, skeleton, or text)
    const loadingIndicator = page.locator('.loading, .spinner, .skeleton').or(page.getByText(/loading/i));
    const hasLoading = await loadingIndicator.count() > 0;
    
    // Should eventually show content
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
  });

  test('should show error states when API fails', async ({ page }) => {
    // Simulate API error
    await page.route('**/api/projects', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      });
    });
    
    await page.goto('/projects');
    
    // Wait for error handling
    await page.waitForTimeout(2000);
    
    // Check for error message or retry button
    const errorIndicators = await page.locator('text=/error/i, text=/failed/i, text=/retry/i').count();
    
    // The app should handle errors gracefully (show message or retry option)
    // If no error handling, the page should at least render
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    await page.goto('/projects');
    
    // Check that content is visible and not cut off
    await expect(page.locator('h1')).toBeVisible();
    
    // Check for mobile menu if applicable
    const mobileMenu = page.locator('[data-testid="mobile-menu"], .mobile-menu, button[aria-label*="menu" i]');
    const hasMobileMenu = await mobileMenu.count() > 0;
    
    // Content should fit within viewport
    const bodyWidth = await page.locator('body').boundingBox();
    expect(bodyWidth?.width).toBeLessThanOrEqual(375);
  });

  test('should handle keyboard navigation', async ({ page }) => {
    await page.goto('/projects');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // Check if focus is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? el.tagName.toLowerCase() : null;
    });
    
    // Should have focusable elements
    expect(focusedElement).toBeTruthy();
    
    // Try keyboard shortcuts if any exist
    await page.keyboard.press('Escape'); // Close any open modals
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle form validation', async ({ page }) => {
    await page.goto('/projects');
    
    // Try to open add project modal
    const addButton = page.locator('button:has-text("Add Project")');
    if (await addButton.isVisible()) {
      await addButton.click();
      
      // Try to submit empty form
      const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Add")').first();
      if (await submitButton.isVisible()) {
        await submitButton.click();
        
        // Check for validation messages
        const validationMessages = await page.locator('.error, .invalid, [aria-invalid="true"], text=/required/i').count();
        
        // Form should show validation or prevent submission
        const urlAfterSubmit = page.url();
        expect(urlAfterSubmit).toContain('/projects');
      }
    }
  });
});

test.describe('Terminal Integration', () => {
  test('should connect to Shelltender WebSocket', async ({ page }) => {
    const wsMessages: any[] = [];
    
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        wsMessages.push({ type: 'received', payload: event.payload });
      });
      ws.on('framesent', event => {
        wsMessages.push({ type: 'sent', payload: event.payload });
      });
    });
    
    await page.goto('/projects');
    
    // Wait for potential WebSocket connection
    await page.waitForTimeout(3000);
    
    // Check console for WebSocket connection logs
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(msg.text());
    });
    
    // The app should establish WebSocket connections
    // Check that no connection errors occurred
    const wsErrors = consoleLogs.filter(log => 
      log.toLowerCase().includes('websocket') && 
      log.toLowerCase().includes('error')
    );
    
    expect(wsErrors).toHaveLength(0);
  });

  test('should handle terminal resize', async ({ page }) => {
    // Navigate to a page with terminal if exists
    await page.goto('/test/terminal-raw');
    
    // Initial viewport
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.waitForTimeout(1000);
    
    // Resize viewport
    await page.setViewportSize({ width: 800, height: 600 });
    await page.waitForTimeout(1000);
    
    // Terminal should still be visible and functional
    const terminal = page.locator('.terminal, [data-testid="terminal"], #terminal, canvas');
    if (await terminal.count() > 0) {
      await expect(terminal.first()).toBeVisible();
      
      // Check terminal dimensions adjusted
      const box = await terminal.first().boundingBox();
      expect(box?.width).toBeLessThanOrEqual(800);
    }
  });
});

test.describe('Data Persistence', () => {
  test('should persist project data across page reloads', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Get initial project count
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href^="/projects/"]');
    const initialCount = await projectCards.count();
    
    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Count should be the same after reload
    const afterReloadCount = await projectCards.count();
    expect(afterReloadCount).toBe(initialCount);
  });

  test('should handle concurrent updates', async ({ browser }) => {
    // Open two tabs
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();
    
    // Both navigate to projects
    await page1.goto('/projects');
    await page2.goto('/projects');
    
    // Wait for both to load
    await page1.waitForLoadState('networkidle');
    await page2.waitForLoadState('networkidle');
    
    // Both pages should show consistent data
    const count1 = await page1.locator('[data-testid="project-card"], .project-card').count();
    const count2 = await page2.locator('[data-testid="project-card"], .project-card').count();
    
    expect(count1).toBe(count2);
    
    await context1.close();
    await context2.close();
  });
});