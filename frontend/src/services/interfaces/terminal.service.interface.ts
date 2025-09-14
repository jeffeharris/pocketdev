import type { TerminalSession } from '../../types/task';

/**
 * TerminalService Interface - Terminal session management
 * 
 * Handles terminal sessions, tabs, and command execution.
 * This service manages the AI terminal interface.
 */

export interface CreateTerminalOptions {
  tabName?: string;
  aiAgent?: string;
  workingDirectory?: string;
  initialPrompt?: string;
  copyHistoryFrom?: string | null;
}

export interface TerminalTabUpdate {
  tabName?: string;
  tabOrder?: number;
}

export interface CreateTerminalResult extends TerminalSession {
  isReconnected: boolean;
  createdAt: string;
  cols: number;
  rows: number;
  wsUrl: string;
  normalizedId?: string;
}

export interface ITerminalService {
  /**
   * Get all terminal sessions for a task
   * @param taskId Task identifier
   * @returns Promise<Array<TerminalSession & { normalizedId: string }>> List of terminal sessions with normalized IDs
   */
  getTerminalSessions(taskId: string): Promise<Array<TerminalSession & { normalizedId: string }>>;

  /**
   * Create a new terminal session
   * @param taskId Task identifier
   * @param options Session creation options
   * @returns Promise<CreateTerminalResult> Created session details
   */
  createTerminalSession(taskId: string, options?: CreateTerminalOptions): Promise<CreateTerminalResult>;

  /**
   * Update terminal tab properties
   * @param sessionId Session identifier
   * @param updates Properties to update
   * @returns Promise<TerminalTabUpdate> Updated properties
   */
  updateTerminalTab(sessionId: string, updates: TerminalTabUpdate): Promise<TerminalTabUpdate>;

  /**
   * Delete a terminal session
   * @param sessionId Session identifier
   * @returns Promise<void>
   */
  deleteTerminalSession(sessionId: string): Promise<void>;

  /**
   * Execute command in terminal session
   * @param sessionId Session identifier
   * @param command Command to execute
   * @returns Promise<void>
   */
  executeCommand(sessionId: string, command: string): Promise<void>;

  /**
   * Open legacy terminal (backward compatibility)
   * @param taskId Task identifier
   * @returns Promise<{ url: string }> Terminal URL
   */
  openTerminal(taskId: string): Promise<{ url: string }>;
}