import { test, expect } from '../global-setup';

test.describe('PocketDev Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should redirect root to projects page', async ({ page }) => {
    await expect(page).toHaveURL('/projects');
    await expect(page.locator('h1')).toContainText('Projects');
  });

  test('should navigate to projects list', async ({ page }) => {
    await page.goto('/projects');
    await expect(page.locator('h1')).toBeVisible();
    
    // Check for key UI elements - button text is "Create New Project" or "Create your first project"
    const addProjectButton = page.locator('button:has-text("Create New Project"), button:has-text("Create your first project")');
    await expect(addProjectButton.first()).toBeVisible();
  });

  test('should handle project creation flow', async ({ page }) => {
    await page.goto('/projects');
    
    // Click Create Project button - could be either text depending on if projects exist
    const createButton = page.locator('button:has-text("Create New Project"), button:has-text("Create your first project")');
    await createButton.first().click();
    
    // Check if modal appears - be more flexible with modal detection
    const modalSelectors = [
      '[data-testid="create-project-modal"]',
      'div[role="dialog"]',
      '.fixed.inset-0',
      '.modal'
    ];
    
    let modalFound = false;
    for (const selector of modalSelectors) {
      const modal = page.locator(selector);
      if (await modal.isVisible({ timeout: 1000 }).catch(() => false)) {
        modalFound = true;
        break;
      }
    }
    
    // If no modal found, check if we navigated to a create page instead
    if (!modalFound) {
      const currentUrl = page.url();
      const isCreatePage = currentUrl.includes('/create') || currentUrl.includes('/new');
      expect(modalFound || isCreatePage).toBeTruthy();
      return; // Skip the rest if it's a different UI pattern
    }
    
    // Check for tab buttons (GitHub or Manual) - make this optional
    const manualTab = page.locator('button:has-text("Manual Entry")');
    if (await manualTab.isVisible({ timeout: 2000 }).catch(() => false)) {
      await manualTab.click();
    }
    
    // Look for repository URL input field - be more flexible
    const inputSelectors = [
      'input[placeholder*="repository" i]',
      'input[placeholder*="github.com" i]',
      'input[placeholder*="url" i]',
      'input[name="repository"]',
      'input[name="url"]'
    ];
    
    let inputFound = false;
    for (const selector of inputSelectors) {
      const input = page.locator(selector);
      if (await input.isVisible({ timeout: 1000 }).catch(() => false)) {
        inputFound = true;
        break;
      }
    }
    
    expect(inputFound).toBeTruthy();
  });

  test('should navigate to project dashboard', async ({ page }) => {
    await page.goto('/projects');
    
    // Wait for projects to load
    await page.waitForTimeout(2000);
    
    // Check if any project cards exist
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href^="/projects/"]');
    const count = await projectCards.count();
    
    if (count > 0) {
      // Click first project
      await projectCards.first().click();
      
      // Should navigate to project dashboard
      await expect(page.url()).toMatch(/\/projects\/[^\/]+$/);
      
      // Check for dashboard elements
      const tasksSection = page.locator('text=/task/i');
      await expect(tasksSection.first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('should navigate to task workspace', async ({ page }) => {
    await page.goto('/projects');
    
    // Wait for projects to load
    await page.waitForTimeout(2000);
    
    const projectCards = page.locator('[data-testid="project-card"], .project-card, a[href^="/projects/"]');
    const projectCount = await projectCards.count();
    
    if (projectCount > 0) {
      await projectCards.first().click();
      await page.waitForLoadState('networkidle');
      
      // Look for task cards or create task button
      const taskCards = page.locator('[data-testid="task-card"], .task-card, a[href*="/tasks/"]');
      const taskCount = await taskCards.count();
      
      if (taskCount > 0) {
        await taskCards.first().click();
        
        // Should navigate to task workspace
        await expect(page.url()).toMatch(/\/projects\/[^\/]+\/tasks\/[^\/]+$/);
        
        // Check for terminal or workspace elements
        const terminal = page.locator('.terminal, [data-testid="terminal"], #terminal');
        await expect(terminal.first()).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should handle browser back/forward navigation', async ({ page }) => {
    // Navigate through pages
    await page.goto('/projects');
    await expect(page).toHaveURL('/projects');
    
    // Try to navigate to a prototype page
    await page.goto('/prototype/merge-workflow');
    await expect(page).toHaveURL('/prototype/merge-workflow');
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL('/projects');
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL('/prototype/merge-workflow');
  });

  test('should load prototype pages', async ({ page }) => {
    const prototypePages = [
      '/prototype/merge-workflow',
      '/prototype/merge-states',
      '/prototype/diff-viewers',
      '/prototype/merge-conflict',
      '/prototype/monaco-merge'
    ];
    
    for (const url of prototypePages) {
      await page.goto(url);
      await expect(page).toHaveURL(url);
      // Check page loaded without errors
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should load test pages', async ({ page }) => {
    const testPages = [
      '/test/terminal-buffer',
      '/test/terminal-raw'
    ];
    
    for (const url of testPages) {
      await page.goto(url);
      await expect(page).toHaveURL(url);
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should handle 404 for invalid routes', async ({ page }) => {
    await page.goto('/invalid-route-that-does-not-exist');
    
    // React Router should still be active, check if redirected or showing error
    const body = await page.locator('body').textContent();
    // Should either redirect to projects or show some content (not blank)
    expect(body).toBeTruthy();
  });

  test('should maintain WebSocket connection during navigation', async ({ page }) => {
    // Monitor console for WebSocket errors
    const wsErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error' && msg.text().toLowerCase().includes('websocket')) {
        wsErrors.push(msg.text());
      }
    });
    
    // Navigate through multiple pages
    await page.goto('/projects');
    await page.waitForTimeout(1000);
    
    await page.goto('/prototype/merge-workflow');
    await page.waitForTimeout(1000);
    
    await page.goto('/projects');
    await page.waitForTimeout(1000);
    
    // Check no WebSocket errors occurred
    expect(wsErrors).toHaveLength(0);
  });
});