import { defineConfig } from 'vitest/config';

export default defineConfig({
  cacheDir: './.vite-cache',
  test: {
    // Use the native Node.js test environment
    environment: 'node',
    
    // Global test setup
    globals: true,
    
    // Setup files
    setupFiles: ['./test/setup.js'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'test/**',
        '**/*.test.js',
        '**/*.spec.js',
        'vitest.config.js',
        'src/tests/**'
      ]
    },
    
    // Test file patterns
    include: ['test/**/*.test.js', 'test/**/*.spec.js'],
    
    // Exclude patterns
    exclude: ['node_modules/**', 'src/tests/**'],
    
    // Test timeout (in ms)
    testTimeout: 10000,
    
    // Hook timeout
    hookTimeout: 10000,
    
    // Run tests in sequence (not parallel) to avoid database conflicts
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  }
});
