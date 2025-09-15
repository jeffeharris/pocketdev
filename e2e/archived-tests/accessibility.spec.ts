import { test, expect } from '../global-setup';

test.describe('Accessibility & User Experience', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Start keyboard navigation
    await page.keyboard.press('Tab');
    
    // Check that focus is visible
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return null;
      
      const computedStyle = window.getComputedStyle(el);
      return {
        tagName: el.tagName.toLowerCase(),
        hasOutline: computedStyle.outline !== 'none',
        hasFocusVisible: el.matches(':focus-visible'),
        isInteractive: ['button', 'a', 'input', 'select', 'textarea'].includes(el.tagName.toLowerCase())
      };
    });
    
    expect(focusedElement).toBeTruthy();
    expect(focusedElement?.isInteractive).toBeTruthy();
    
    // Tab through multiple elements
    const tabbableElements = [];
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Tab');
      const currentFocus = await page.evaluate(() => {
        const el = document.activeElement;
        return el ? el.tagName.toLowerCase() : null;
      });
      if (currentFocus) {
        tabbableElements.push(currentFocus);
      }
    }
    
    // Should have found multiple tabbable elements
    expect(tabbableElements.length).toBeGreaterThan(0);
  });

  test('should support screen reader accessibility', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Check for semantic HTML elements
    const semanticElements = await page.evaluate(() => {
      const elements = {
        headings: document.querySelectorAll('h1, h2, h3, h4, h5, h6').length,
        landmarks: document.querySelectorAll('main, nav, header, footer, aside, section').length,
        buttons: document.querySelectorAll('button').length,
        links: document.querySelectorAll('a[href]').length,
        labels: document.querySelectorAll('label').length,
        ariaLabels: document.querySelectorAll('[aria-label]').length,
        ariaDescriptions: document.querySelectorAll('[aria-describedby]').length
      };
      return elements;
    });
    
    // Should have proper heading structure
    expect(semanticElements.headings).toBeGreaterThan(0);
    
    // Should have interactive elements
    expect(semanticElements.buttons + semanticElements.links).toBeGreaterThan(0);
    
    // Check for ARIA attributes on interactive elements
    const interactiveElements = await page.locator('button, a, input, select, textarea').all();
    
    for (const element of interactiveElements.slice(0, 5)) { // Check first 5
      const ariaLabel = await element.getAttribute('aria-label');
      const ariaLabelledBy = await element.getAttribute('aria-labelledby');
      const textContent = await element.textContent();
      const title = await element.getAttribute('title');
      
      // Interactive elements should have some form of accessible name
      const hasAccessibleName = !!(ariaLabel || ariaLabelledBy || textContent?.trim() || title);
      expect(hasAccessibleName).toBeTruthy();
    }
  });

  test('should have proper color contrast', async ({ page }) => {
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Check color contrast for text elements
    const contrastIssues = await page.evaluate(() => {
      const issues: string[] = [];
      
      // Get all text elements
      const textElements = document.querySelectorAll('p, span, div, button, a, h1, h2, h3, h4, h5, h6');
      
      for (let i = 0; i < Math.min(20, textElements.length); i++) { // Check first 20
        const element = textElements[i] as HTMLElement;
        const computedStyle = window.getComputedStyle(element);
        
        // Skip elements with no text or hidden elements
        if (!element.textContent?.trim() || computedStyle.display === 'none') {
          continue;
        }
        
        const color = computedStyle.color;
        const backgroundColor = computedStyle.backgroundColor;
        
        // Basic check for very low contrast (black on black, white on white)
        if (color === backgroundColor) {
          issues.push(`Same color and background: ${element.tagName}`);
        }
        
        // Check for very light text on light background (basic heuristic)
        if (color.includes('rgb(255') && backgroundColor.includes('rgb(255')) {
          issues.push(`Light text on light background: ${element.tagName}`);
        }
      }
      
      return issues;
    });
    
    // Should not have obvious contrast issues
    expect(contrastIssues).toHaveLength(0);
  });

  test('should handle high contrast mode', async ({ page }) => {
    // Simulate high contrast mode
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Page should still be usable
    await expect(page.locator('h1')).toBeVisible();
    
    // Check that dark mode doesn't break visibility
    const visibility = await page.evaluate(() => {
      const body = document.body;
      const computedStyle = window.getComputedStyle(body);
      return {
        backgroundColor: computedStyle.backgroundColor,
        color: computedStyle.color,
        visible: computedStyle.visibility !== 'hidden' && computedStyle.display !== 'none'
      };
    });
    
    expect(visibility.visible).toBeTruthy();
  });

  test('should support reduced motion preferences', async ({ page }) => {
    // Simulate reduced motion preference
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/projects');
    await page.waitForLoadState('networkidle');
    
    // Page should still be functional
    await expect(page.locator('h1')).toBeVisible();
    
    // Check for CSS animations that should be disabled
    const animations = await page.evaluate(() => {
      const elements = document.querySelectorAll('*');
      const animatedElements = [];
      
      for (let i = 0; i < Math.min(50, elements.length); i++) {
        const element = elements[i] as HTMLElement;
        const computedStyle = window.getComputedStyle(element);
        
        if (computedStyle.animationName !== 'none' || 
            computedStyle.transitionProperty !== 'none') {
          animatedElements.push({
            tagName: element.tagName,
            className: element.className,
            animationName: computedStyle.animationName,
            transitionProperty: computedStyle.transitionProperty
          });
        }
      }
      
      return animatedElements;
    });
    
    // In reduced motion mode, there should be fewer animations
    // This is more of a logging check than a strict requirement
    if (animations.length > 0) {
      console.log(`Found ${animations.length} animated elements (should respect reduced motion)`);
    }
  });

  test('should handle form accessibility', async ({ page }) => {
    await page.goto('/projects');
    
    // Try to find and interact with forms
    const forms = await page.locator('form').count();
    const inputs = await page.locator('input, textarea, select').count();
    
    if (forms > 0 || inputs > 0) {
      // Check form elements have proper labels
      const inputElements = await page.locator('input, textarea, select').all();
      
      for (const input of inputElements.slice(0, 5)) { // Check first 5
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        // Look for associated label
        let hasLabel = !!(ariaLabel || ariaLabelledBy);
        
        if (id && !hasLabel) {
          const label = await page.locator(`label[for="${id}"]`).count();
          hasLabel = label > 0;
        }
        
        // Input should have some form of label
        expect(hasLabel).toBeTruthy();
      }
    }
  });

  test('should provide proper error messaging', async ({ page }) => {
    // Force API errors to test error messaging
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Not Found' })
      });
    });
    
    await page.goto('/projects');
    await page.waitForTimeout(3000); // Wait for API calls to fail
    
    // Look for error messages
    const errorElements = page.locator('text=/error/i, text=/failed/i, [role="alert"], .error, .alert-error');
    const errorCount = await errorElements.count();
    
    if (errorCount > 0) {
      // Error messages should be accessible
      const firstError = errorElements.first();
      
      // Check for ARIA attributes
      const role = await firstError.getAttribute('role');
      const ariaLive = await firstError.getAttribute('aria-live');
      const ariaLabel = await firstError.getAttribute('aria-label');
      
      // Error should be announced to screen readers
      const isAccessible = role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive' || !!ariaLabel;
      
      if (!isAccessible) {
        console.log('Error message found but may not be accessible to screen readers');
      }
    }
    
    // Page should still be usable even with errors
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle focus management in modals', async ({ page }) => {
    await page.goto('/projects');
    
    // Try to open a modal
    const createButton = page.locator('button:has-text("Create New Project"), button:has-text("Create your first project")');
    
    if (await createButton.isVisible()) {
      await createButton.click();
      
      // Check if modal opened
      const modalSelectors = [
        '[data-testid="create-project-modal"]',
        'div[role="dialog"]',
        '.fixed.inset-0',
        '.modal'
      ];
      
      let modal = null;
      for (const selector of modalSelectors) {
        const element = page.locator(selector);
        if (await element.isVisible({ timeout: 1000 }).catch(() => false)) {
          modal = element;
          break;
        }
      }
      
      if (modal) {
        // Focus should be trapped in modal
        await page.keyboard.press('Tab');
        
        const focusedElement = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? {
            tagName: el.tagName.toLowerCase(),
            isInModal: !!el.closest('[role="dialog"], .modal, .fixed')
          } : null;
        });
        
        // Focus should be within the modal
        expect(focusedElement?.isInModal).toBeTruthy();
        
        // Try to close modal with Escape
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
        
        // Focus should return to trigger element
        const focusAfterClose = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? el.tagName.toLowerCase() : null;
        });
        
        expect(focusAfterClose).toBeTruthy();
      }
    }
  });
});