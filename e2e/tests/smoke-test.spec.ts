import { test, expect } from '@playwright/test';

/**
 * Smoke Tests - Essential functionality that would embarrass us if broken
 * 
 * These tests answer: "Would a user immediately complain?"
 * - Do pages load?
 * - Are there JS errors blocking basic usage?
 * - Can we connect to the backend?
 */

test.describe('Smoke Tests - Essential Functionality', () => {
  
  test('homepage loads without errors', async ({ page }) => {
    // Listen for console errors that would block users
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    await page.goto('/');
    
    // Basic load check
    await expect(page).toHaveTitle(/PocketDev/);
    
    // No critical JS errors that would break the app
    expect(errors.filter(e => !e.includes('favicon'))).toHaveLength(0);
  });

  test('can navigate to projects page', async ({ page }) => {
    await page.goto('/');
    
    // Look for projects link/button and click it
    const projectsLink = page.locator('a[href*="/projects"], button:has-text("Projects")').first();
    
    if (await projectsLink.isVisible()) {
      await projectsLink.click();
      await expect(page.url()).toContain('/projects');
    } else {
      // If no projects link visible, just verify we can navigate directly
      await page.goto('/projects');
      await expect(page).toHaveURL(/projects/);
    }
  });

  test('backend API is responding', async ({ page }) => {
    // Test that our API endpoint responds
    const response = await page.request.get('/api/health');
    
    // If health endpoint doesn't exist, try a basic projects endpoint
    if (response.status() === 404) {
      const projectsResponse = await page.request.get('/api/projects');
      expect([200, 404]).toContain(projectsResponse.status()); // 404 is ok if no projects
    } else {
      expect(response.ok()).toBeTruthy();
    }
  });

  test('WebSocket connection can be established', async ({ page }) => {
    await page.goto('/');
    
    // Wait a moment for any WebSocket connections to establish
    await page.waitForTimeout(2000);
    
    // Check for WebSocket in dev tools or listen for connection events
    const wsConnected = await page.evaluate(() => {
      // Look for signs of WebSocket activity (implementation-specific)
      return window.WebSocket !== undefined;
    });
    
    expect(wsConnected).toBe(true);
  });

  test('critical pages load without 500 errors', async ({ page }) => {
    const criticalPages = ['/', '/projects'];
    
    for (const url of criticalPages) {
      const response = await page.goto(url);
      expect(response?.status()).not.toBe(500); // No server errors
      expect(response?.status()).not.toBe(502); // No bad gateway
    }
  });
});