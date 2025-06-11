module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.cjs', '**/?(*.)+(spec|test).cjs'],
  collectCoverageFrom: [
    'db/**/*.cjs',
    'project-manager-db.cjs',
    '!**/node_modules/**',
    '!**/__tests__/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/__tests__/setup.cjs'],
  testTimeout: 10000
};