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
 */

import type { TerminalSession } from '../types/task';

export type NormalizedSessionId = string;

export interface SessionInfo {
  /** Normalized ID for components to use */
  id: NormalizedSessionId;
  /** Database session ID (stable) */
  dbSessionId: string;
  /** Shelltender session ID (for WebSocket) */
  shelltenderSessionId: string;
  /** Legacy session ID (for backward compatibility) */
  legacySessionId?: string;
  /** Tab display name */
  tabName: string;
  /** Tab order for sorting */
  tabOrder: number;
  /** AI agent type */
  aiAgent: string;
  /** Current AI state */
  aiState: string;
}

export class SessionAdapter {
  private sessionMap = new Map<NormalizedSessionId, SessionInfo>();

  /**
   * Register a terminal session from the backend
   */
  registerSession(terminalSession: TerminalSession): NormalizedSessionId {
    const normalizedId = this.generateNormalizedId(terminalSession);
    
    const sessionInfo: SessionInfo = {
      id: normalizedId,
      dbSessionId: terminalSession.dbSessionId,
      shelltenderSessionId: terminalSession.shelltenderSessionId,
      legacySessionId: terminalSession.sessionId,
      tabName: terminalSession.tabName,
      tabOrder: terminalSession.tabOrder,
      aiAgent: terminalSession.aiAgent,
      aiState: terminalSession.aiState
    };

    this.sessionMap.set(normalizedId, sessionInfo);
    return normalizedId;
  }

  /**
   * Get session info by normalized ID
   */
  getSessionInfo(normalizedId: NormalizedSessionId): SessionInfo | undefined {
    return this.sessionMap.get(normalizedId);
  }

  /**
   * Find session by any ID type (for migration/compatibility)
   */
  findSessionByAnyId(anyId: string): SessionInfo | undefined {
    // First try exact match
    const direct = this.sessionMap.get(anyId);
    if (direct) return direct;

    // Search by any ID field
    for (const sessionInfo of this.sessionMap.values()) {
      if (
        sessionInfo.dbSessionId === anyId ||
        sessionInfo.shelltenderSessionId === anyId ||
        sessionInfo.legacySessionId === anyId
      ) {
        return sessionInfo;
      }
    }

    return undefined;
  }

  /**
   * Normalize any ID type to the standard format
   * This is the main method components should use
   */
  normalize(anyId: string): NormalizedSessionId | null {
    const sessionInfo = this.findSessionByAnyId(anyId);
    return sessionInfo ? sessionInfo.id : null;
  }

  /**
   * Get the database ID for API calls
   */
  getDbSessionId(normalizedId: NormalizedSessionId): string | null {
    const sessionInfo = this.getSessionInfo(normalizedId);
    return sessionInfo ? sessionInfo.dbSessionId : null;
  }

  /**
   * Get the Shelltender ID for WebSocket connections
   */
  getShelltenderSessionId(normalizedId: NormalizedSessionId): string | null {
    const sessionInfo = this.getSessionInfo(normalizedId);
    return sessionInfo ? sessionInfo.shelltenderSessionId : null;
  }

  /**
   * Get all registered sessions
   */
  getAllSessions(): SessionInfo[] {
    return Array.from(this.sessionMap.values()).sort((a, b) => a.tabOrder - b.tabOrder);
  }

  /**
   * Update session info (e.g., tab name, AI state)
   */
  updateSession(normalizedId: NormalizedSessionId, updates: Partial<SessionInfo>): boolean {
    const existing = this.sessionMap.get(normalizedId);
    if (!existing) return false;

    this.sessionMap.set(normalizedId, { ...existing, ...updates });
    return true;
  }

  /**
   * Remove a session
   */
  removeSession(normalizedId: NormalizedSessionId): boolean {
    return this.sessionMap.delete(normalizedId);
  }

  /**
   * Clear all sessions
   */
  clear(): void {
    this.sessionMap.clear();
  }

  /**
   * Generate a normalized ID from terminal session data
   * Format: session-{shortDbId} for human readability and uniqueness
   */
  private generateNormalizedId(terminalSession: TerminalSession): string {
    // Use the database session ID as the base since it's stable
    const shortId = terminalSession.dbSessionId.substring(0, 8);
    return `session-${shortId}`;
  }

  /**
   * Batch register sessions from an array
   */
  registerSessions(terminalSessions: TerminalSession[]): NormalizedSessionId[] {
    return terminalSessions.map(session => this.registerSession(session));
  }

  /**
   * Get session count
   */
  get sessionCount(): number {
    return this.sessionMap.size;
  }

  /**
   * Check if a session exists
   */
  hasSession(normalizedId: NormalizedSessionId): boolean {
    return this.sessionMap.has(normalizedId);
  }
}

// Export a singleton instance for global use
export const sessionAdapter = new SessionAdapter();