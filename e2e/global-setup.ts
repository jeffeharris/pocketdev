import { test as base, ConsoleMessage } from '@playwright/test';

// Extend base test with console monitoring
export const test = base.extend({
  page: async ({ page }, use) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    
    // Set up console monitoring
    page.on('console', (msg: ConsoleMessage) => {
      const type = msg.type();
      const text = msg.text();
      
      // Skip some expected/noise messages
      if (text.includes('[vite]') || 
          text.includes('Download the React DevTools') ||
          text.includes('Consider using') ||
          text.includes('[HMR]') ||
          text.includes('Failed to load real diff') ||
          text.includes('access control checks') ||
          text.includes('Monaco initialization') ||
          text.includes('CDN') ||
          text.includes('cors')) {
        return;
      }
      
      if (type === 'error') {
        consoleErrors.push(text);
        console.error(`[Console Error] ${text}`);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
      }
    });
    
    // Capture uncaught exceptions
    page.on('pageerror', (error) => {
      consoleErrors.push(`Uncaught: ${error.message}`);
      console.error(`[Page Error] ${error.message}`);
    });
    
    // Capture failed requests (excluding expected ones)
    page.on('requestfailed', request => {
      const url = request.url();
      const failure = request.failure();
      
      // Skip expected failures (WebSocket reconnection attempts, etc.)
      if (url.includes('/ws') || url.includes('websocket')) {
        return;
      }
      
      if (failure) {
        console.error(`[Request Failed] ${url}: ${failure.errorText}`);
      }
    });
    
    // Use the page with monitoring
    await use(page);
    
    // After test, report any issues found
    if (consoleErrors.length > 0) {
      console.log(`\n⚠️  Test had ${consoleErrors.length} console error(s)`);
    }
  },
});

export { expect } from '@playwright/test';