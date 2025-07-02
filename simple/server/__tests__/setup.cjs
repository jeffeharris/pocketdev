// Test setup
const path = require('path');
const fs = require('fs').promises;

// Set test database path
process.env.TEST_DB_PATH = path.join(__dirname, 'test.db');

// Clean up function
global.cleanupTestDb = async () => {
  try {
    await fs.unlink(process.env.TEST_DB_PATH);
  } catch (error) {
    // Ignore if file doesn't exist
  }
};

// Clean up before all tests
beforeAll(async () => {
  await global.cleanupTestDb();
});

// Clean up after all tests
afterAll(async () => {
  await global.cleanupTestDb();
});