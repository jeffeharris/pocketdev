import { describe, it, expect } from 'vitest';

describe('Vitest Setup', () => {
  it('should be configured correctly', () => {
    expect(true).toBe(true);
  });

  it('should support ES modules', async () => {
    const { createTestDatabase } = await import('./utils/test-db.js');
    expect(typeof createTestDatabase).toBe('function');
  });

  it('should have test environment set', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
});