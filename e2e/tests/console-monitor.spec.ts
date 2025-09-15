import { test, expect } from '@playwright/test';

/**
 * Console Monitor Test - Catch embarrassing JavaScript errors
 * 
 * This test visits main pages and listens for console errors that would
 * make users think "this app is broken". We ignore minor issues like
 * missing favicons or development warnings.
 */

test.describe('Console Error Monitoring', () => {
  
  test('main pages are free of critical JavaScript errors', async ({ page }) => {
    const criticalErrors: Array<{ page: string; error: string }> = [];
    
    // Listen for console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorText = msg.text();
        
        // Filter out non-critical errors
        const ignoredPatterns = [
          'favicon',
          'Failed to load resource', // Often network-related, not app-breaking
          'ResizeObserver loop limit exceeded', // Common React warning, not user-facing
          'Non-passive event listener', // Performance warning, not breaking
        ];
        
        const isCritical = !ignoredPatterns.some(pattern => 
          errorText.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (isCritical) {
          const currentUrl = page.url();
          criticalErrors.push({ 
            page: currentUrl, 
            error: errorText 
          });
        }
      }
    });
    
    // Visit main pages that users would see
    const pagesToCheck = [
      { url: '/', name: 'Homepage' },
      { url: '/projects', name: 'Projects' },
      { url: '/prototype/diff-viewers', name: 'Diff Viewers' }, // This was failing before
    ];
    
    for (const { url, name } of pagesToCheck) {
      try {
        await page.goto(url);
        
        // Wait a moment for any lazy-loaded JS to execute
        await page.waitForTimeout(2000);
        
        // Interact with the page slightly to trigger any event-based errors
        await page.mouse.move(100, 100);
        await page.keyboard.press('Tab');
        
        // Give errors time to surface
        await page.waitForTimeout(500);
        
      } catch (error) {
        // If page completely fails to load, that's definitely a critical error
        criticalErrors.push({ 
          page: url, 
          error: `Page failed to load: ${error}` 
        });
      }
    }
    
    // Report any critical errors we found
    if (criticalErrors.length > 0) {
      const errorReport = criticalErrors
        .map(({ page, error }) => `${page}: ${error}`)
        .join('\n');
      
      throw new Error(`Critical JavaScript errors detected:\n${errorReport}`);
    }
    
    // If we get here, no critical errors were found
    expect(criticalErrors).toHaveLength(0);
  });
  
});