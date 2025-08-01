import { beforeAll, afterAll } from 'vitest';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Set test environment
process.env.NODE_ENV = 'test';
process.env.PROJECTS_DIR = '/tmp/test-projects';

// Suppress console logs during tests unless explicitly needed
if (!process.env.DEBUG_TESTS) {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}

beforeAll(() => {
  // Any global setup needed before all tests
});

afterAll(() => {
  // Any global cleanup needed after all tests
});