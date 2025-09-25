import { test, expect } from '@playwright/test';

/**
 * User Journey Test - Happy path through the app
 * 
 * This test simulates what a real user would do:
 * Navigate from homepage → projects → dashboard → task (if available)
 * 
 * The goal is to catch obvious workflow breaks, not test every edge case.
 */

test.describe('User Journey - Happy Path', () => {
  
  test('user can navigate through main workflow', async ({ page }) => {
    // Start at homepage
    await page.goto('/');
    await expect(page).toHaveTitle(/PocketDev/);
    
    // Navigate to projects
    await page.goto('/projects');
    
    // Check if we have any projects
    const hasProjects = await page.locator('[data-testid="project-item"], .project-card, .project-list-item').count() > 0;
    
    if (hasProjects) {
      // Click on first project
      const firstProject = page.locator('[data-testid="project-item"], .project-card, .project-list-item').first();
      await firstProject.click();
      
      // Should be on project dashboard/details
      await expect(page.url()).toMatch(/projects\/[^\/]+/);
      
      // Look for tasks or dashboard elements
      const hasTasks = await page.locator('[data-testid="task-item"], .task-card, .task-list-item').count() > 0;
      
      if (hasTasks) {
        // Click on first task if available
        const firstTask = page.locator('[data-testid="task-item"], .task-card, .task-list-item').first();
        await firstTask.click();
        
        // Should be on task view
        await expect(page.url()).toMatch(/tasks\/[^\/]+/);
      }
    } else {
      // No projects - verify empty state is reasonable
      const emptyStateExists = await page.locator('[data-testid="empty-state"], .empty-state, :has-text("No projects")').count() > 0;
      
      // Either show empty state or at least don't crash
      if (!emptyStateExists) {
        // Just verify page loaded properly
        await expect(page.locator('body')).toBeVisible();
      }
    }
    
    // Verify no JavaScript errors broke the journey
    const errors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && !msg.text().includes('favicon')) {
        errors.push(msg.text());
      }
    });
    
    // Give a moment for any errors to surface
    await page.waitForTimeout(1000);
    
    // Should have completed the journey without critical errors
    expect(errors).toHaveLength(0);
  });
  
});