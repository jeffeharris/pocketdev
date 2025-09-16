/**
 * Terminal Utilities
 * 
 * Common utility functions for terminal operations.
 * Eliminates duplication across terminal components.
 */

import type { TerminalSession } from '@shared/types';
import type { Tab } from '../components/terminal/TerminalTabs';
import { WorkerStatus } from '@shared/types';

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

// ========== TERMINAL STATE AGGREGATION ==========
// Consolidates duplicate state priority logic from TaskListItem and TaskStatus

/**
 * Priority order for AI states (higher number = higher priority)
 * Single source of truth for state prioritization
 */
export const STATE_PRIORITY: Record<string, number> = {
  'waiting': 4,
  'working': 3,
  'idle': 2,
  'not-started': 1
} as const;

/**
 * Session state interface used by aggregation functions
 */
export interface SessionState {
  id?: string;
  aiState: string;
  lastStateChange?: string | null;
}

/**
 * Sort sessions by priority, then by most recent update
 * Used for consistent session ordering across components
 */
export function sortSessionsByPriority<T extends SessionState>(sessions: T[]): T[] {
  return [...sessions].sort((a, b) => {
    const priorityA = STATE_PRIORITY[a.aiState] || 0;
    const priorityB = STATE_PRIORITY[b.aiState] || 0;
    
    if (priorityA !== priorityB) {
      return priorityB - priorityA;
    }
    
    // If same priority, use most recent update
    const timeA = a.lastStateChange ? new Date(a.lastStateChange).getTime() : 0;
    const timeB = b.lastStateChange ? new Date(b.lastStateChange).getTime() : 0;
    return timeB - timeA;
  });
}

/**
 * Get the highest priority session from a list
 * Returns the session with highest priority (or most recent if tied)
 */
export function getHighestPrioritySession<T extends SessionState>(sessions: T[]): T | undefined {
  if (!sessions || sessions.length === 0) return undefined;
  return sortSessionsByPriority(sessions)[0];
}

/**
 * Get the ID of the highest priority session
 * Useful for focusing on the most important terminal
 */
export function getHighestPrioritySessionId(sessions: SessionState[]): string | undefined {
  const prioritySession = getHighestPrioritySession(sessions);
  return prioritySession?.id;
}

/**
 * Calculate aggregated state from multiple sessions
 * Returns the highest priority state among all sessions
 */
export function getAggregatedState(sessions: SessionState[]): {
  status: WorkerStatus;
  lastStateChange: string | null;
} {
  if (!sessions || sessions.length === 0) {
    return { status: WorkerStatus.NotStarted, lastStateChange: null };
  }
  
  const highestPrioritySession = getHighestPrioritySession(sessions);
  if (!highestPrioritySession) {
    return { status: WorkerStatus.NotStarted, lastStateChange: null };
  }
  
  return {
    status: highestPrioritySession.aiState as WorkerStatus,
    lastStateChange: highestPrioritySession.lastStateChange || null
  };
}