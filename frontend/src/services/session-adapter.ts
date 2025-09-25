/**
 * SessionAdapter - Normalizes the complex session ID types
 * 
 * Problem: Frontend components deal with multiple ID types:
 * - sessionId (Shelltender session ID, for backward compatibility)
 * - dbSessionId (Database ID, stable identifier)
 * - shelltenderSessionId (explicit Shelltender ID)
 * 
 * Solution: Components should only see one normalized ID type.
 * This adapter handles the mapping internally.
 * 
 * Deep module design:
 * - Simple interface: 4 core methods
 * - Hidden complexity: ID mapping, session storage, type conversions
 * - Clear abstraction: Components only work with normalized IDs
 */

import type { TerminalSession } from '@shared/types';

export type NormalizedSessionId = string;

// Internal storage structure - not exposed
interface SessionRecord {
  normalizedId: NormalizedSessionId;
  dbSessionId: string;
  shelltenderSessionId: string;
  legacySessionId?: string;
  tabName: string;
  tabOrder: number;
  aiAgent: string;
  aiState: string;
}

export class SessionAdapter {
  private sessions = new Map<NormalizedSessionId, SessionRecord>();
  private lookupIndex = new Map<string, NormalizedSessionId>(); // Any ID -> normalized ID

  /**
   * Register a terminal session and get its normalized ID
   * This is the only way sessions enter the system
   */
  registerSession(terminal: TerminalSession): NormalizedSessionId {
    // Generate normalized ID
    const normalizedId = `session-${terminal.dbSessionId.substring(0, 8)}`;
    
    // Store session
    const record: SessionRecord = {
      normalizedId,
      dbSessionId: terminal.dbSessionId,
      shelltenderSessionId: terminal.shelltenderSessionId,
      legacySessionId: terminal.sessionId,
      tabName: terminal.tabName,
      tabOrder: terminal.tabOrder,
      aiAgent: terminal.aiAgent,
      aiState: terminal.aiState
    };
    
    this.sessions.set(normalizedId, record);
    
    // Build lookup index for all ID types
    this.lookupIndex.set(normalizedId, normalizedId);
    this.lookupIndex.set(terminal.dbSessionId, normalizedId);
    this.lookupIndex.set(terminal.shelltenderSessionId, normalizedId);
    if (terminal.sessionId) {
      this.lookupIndex.set(terminal.sessionId, normalizedId);
    }
    
    return normalizedId;
  }

  /**
   * Resolve a normalized ID to the specific ID type needed for operations
   * Returns null if session not found
   */
  getSessionInfo(normalizedId: NormalizedSessionId): { dbSessionId: string; shelltenderSessionId: string; legacySessionId?: string } | null {
    const record = this.sessions.get(normalizedId);
    if (!record) return null;
    
    return {
      dbSessionId: record.dbSessionId,
      shelltenderSessionId: record.shelltenderSessionId,
      legacySessionId: record.legacySessionId
    };
  }

  /**
   * Update session properties (tab name, order, etc.)
   * Returns true if successful
   */
  updateSession(normalizedId: NormalizedSessionId, updates: { tabName?: string; tabOrder?: number; aiState?: string }): boolean {
    const record = this.sessions.get(normalizedId);
    if (!record) return false;
    
    // Apply updates
    if (updates.tabName !== undefined) record.tabName = updates.tabName;
    if (updates.tabOrder !== undefined) record.tabOrder = updates.tabOrder;
    if (updates.aiState !== undefined) record.aiState = updates.aiState;
    
    return true;
  }

  /**
   * Remove a session from the adapter
   * Returns true if session was found and removed
   */
  removeSession(normalizedId: NormalizedSessionId): boolean {
    const record = this.sessions.get(normalizedId);
    if (!record) return false;
    
    // Remove from lookup index
    this.lookupIndex.delete(normalizedId);
    this.lookupIndex.delete(record.dbSessionId);
    this.lookupIndex.delete(record.shelltenderSessionId);
    if (record.legacySessionId) {
      this.lookupIndex.delete(record.legacySessionId);
    }
    
    // Remove from sessions
    return this.sessions.delete(normalizedId);
  }

  /**
   * Find normalized ID by any ID type (for compatibility during migration)
   * This should eventually be removed once all code uses normalized IDs
   */
  findSessionByAnyId(anyId: string): { id: NormalizedSessionId } | null {
    const normalizedId = this.lookupIndex.get(anyId);
    return normalizedId ? { id: normalizedId } : null;
  }
}

// Export a singleton instance for global use
export const sessionAdapter = new SessionAdapter();