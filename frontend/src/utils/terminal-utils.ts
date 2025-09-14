/**
 * Terminal Utilities
 * 
 * Common utility functions for terminal operations.
 * Eliminates duplication across terminal components.
 */

import type { TerminalSession } from '../types/task';
import type { Tab } from '../components/terminal/TerminalTabs';

/**
 * Sort terminals or tabs by their tabOrder property
 * Used consistently across all terminal components
 */
export function sortByTabOrder<T extends { tabOrder: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.tabOrder - b.tabOrder);
}

/**
 * Get the first terminal/tab by order
 */
export function getFirstByOrder<T extends { tabOrder: number }>(items: T[]): T | undefined {
  return sortByTabOrder(items)[0];
}

/**
 * Find terminal by various ID types
 * Helps eliminate duplicate finding logic
 */
export function findTerminalById(
  terminals: TerminalSession[], 
  id: string,
  idType: 'dbSessionId' | 'sessionId' | 'normalizedId' = 'dbSessionId'
): TerminalSession | undefined {
  return terminals.find(t => t[idType] === id);
}