import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  timeout: 10000, // 10 seconds - hobby project, fast tests only
  expect: {
    timeout: 5000, // 5 seconds for expects
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure', 
    video: 'retry-with-failure', // Only record video on retry failures
    actionTimeout: 8000, // Shorter action timeout
    navigationTimeout: 10000, // Shorter navigation timeout
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Cross-browser testing is overkill for hobby project
    // Uncomment if needed:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
  ],

  webServer: {
    command: 'cd .. && make dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true, // Always reuse for hobby project
    timeout: 120000,
  },
});