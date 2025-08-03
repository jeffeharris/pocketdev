/**
 * Terminal Store
 * 
 * This file now exports the deep module implementation through an adapter
 * that maintains backward compatibility during migration.
 * 
 * Migration plan:
 * 1. Components continue to work with existing imports
 * 2. New code uses deep module patterns
 * 3. Existing code gradually migrated
 * 4. Adapter removed once migration complete
 * 
 * See /frontend/src/stores/terminal/migration-guide.md for details
 */

// Re-export everything from the adapter
// This provides backward compatibility while using the deep module internally
export * from './terminal/terminalStore.adapter';