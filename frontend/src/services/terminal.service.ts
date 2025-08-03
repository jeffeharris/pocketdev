/**
 * TerminalService - Terminal session management
 * 
 * Handles terminal sessions, tabs, and command execution.
 * This service manages the AI terminal interface and provides a simple
 * interface for terminal operations while hiding session ID complexity.
 * 
 * Deep module design:
 * - Simple interface: 6 methods for core terminal operations
 * - Hidden complexity: Session ID normalization, WebSocket management, mock data
 * - Clear abstraction: Components only see normalized session IDs
 */

import { BaseService } from './base.service';
import { sessionAdapter, type NormalizedSessionId } from './session-adapter';
import type { 
  ITerminalService,
  CreateTerminalOptions,
  CreateTerminalResult,
  TerminalTabUpdate
} from './interfaces/terminal.service.interface';
import type { TerminalSession } from '../types/task';

export class TerminalService extends BaseService implements ITerminalService {
  private mockSessions: Map<string, TerminalSession[]> = new Map();

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Simple public interface - 6 core methods (deep module principle)

  async getTerminalSessions(taskId: string): Promise<TerminalSession[]> {
    if (this.isMockEnabled) {
      const sessions = this.mockSessions.get(taskId) || [];
      // Register sessions with adapter for ID normalization
      sessions.forEach(session => sessionAdapter.registerSession(session));
      return sessions;
    }
    
    // Get task details which includes terminals
    const response = await this.get<{ terminals?: TerminalSession[] }>(`/tasks/${taskId}`);
    const sessions = response.terminals || [];
    
    // Register all sessions with the adapter
    sessions.forEach(session => sessionAdapter.registerSession(session));
    
    return sessions;
  }

  async createTerminalSession(taskId: string, options: CreateTerminalOptions = {}): Promise<CreateTerminalResult> {
    if (this.isMockEnabled) {
      return this.handleMockCreation(taskId, options);
    }
    
    const result = await this.post<CreateTerminalResult>(`/tasks/${taskId}/terminals`, options);
    
    // Register the new session with the adapter
    sessionAdapter.registerSession(result);
    
    return result;
  }

  async updateTerminalTab(sessionId: string, updates: TerminalTabUpdate): Promise<TerminalTabUpdate> {
    // Normalize the session ID for API calls
    const sessionInfo = sessionAdapter.findSessionByAnyId(sessionId);
    if (!sessionInfo) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (this.isMockEnabled) {
      // Update mock data
      sessionAdapter.updateSession(sessionInfo.id, updates);
      return updates;
    }
    
    // Use the database session ID for the API call
    const result = await this.patch<TerminalTabUpdate>(`/terminals/${sessionInfo.dbSessionId}/tab`, updates);
    
    // Update the adapter with the changes
    sessionAdapter.updateSession(sessionInfo.id, updates);
    
    return result;
  }

  async deleteTerminalSession(sessionId: string): Promise<void> {
    console.log('[TerminalService] deleteTerminalSession called with:', sessionId);
    
    // Normalize the session ID for API calls
    const sessionInfo = sessionAdapter.findSessionByAnyId(sessionId);
    if (!sessionInfo) {
      console.log('[TerminalService] Session not found in adapter:', sessionId);
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    console.log('[TerminalService] Found session info:', sessionInfo);
    
    if (this.isMockEnabled) {
      this.handleMockDeletion(sessionInfo.dbSessionId);
      sessionAdapter.removeSession(sessionInfo.id);
      return;
    }
    
    // Use the database session ID for the API call
    console.log('[TerminalService] Calling DELETE API for:', sessionInfo.dbSessionId);
    await this.delete<void>(`/terminals/${sessionInfo.dbSessionId}`);
    
    // Remove from adapter - but this might be premature if the backend fails
    console.log('[TerminalService] Removing from adapter');
    sessionAdapter.removeSession(sessionInfo.id);
  }

  async executeCommand(sessionId: string, command: string): Promise<void> {
    // Normalize the session ID for API calls
    const sessionInfo = sessionAdapter.findSessionByAnyId(sessionId);
    if (!sessionInfo) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    
    if (this.isMockEnabled) {
      // Mock execution - just log for development
      console.log(`Mock executing command in session ${sessionInfo.id}:`, command);
      return;
    }
    
    // Use the Shelltender session ID for command execution
    await this.post<void>(`/sessions/${sessionInfo.shelltenderSessionId}/execute`, { command });
  }

  async openTerminal(taskId: string): Promise<{ url: string }> {
    if (this.isMockEnabled) {
      return { url: `http://localhost:8080/terminal/mock-${taskId}` };
    }
    
    return this.post<{ url: string }>(`/tasks/${taskId}/terminal`);
  }

  // Complex implementation hidden from users

  private handleMockCreation(taskId: string, options: CreateTerminalOptions): CreateTerminalResult {
    const dbSessionId = this.generateMockSessionId();
    const shelltenderSessionId = `task-${taskId}-${dbSessionId}`;
    
    const mockSession: TerminalSession = {
      sessionId: shelltenderSessionId, // Legacy compatibility
      dbSessionId,
      shelltenderSessionId,
      tabName: options.tabName || 'New Tab',
      tabOrder: this.getNextTabOrder(taskId),
      aiState: 'not-started',
      aiAgent: options.aiAgent || 'claude',
      shelltenderStatus: 'active'
    };
    
    // Add to mock storage
    const existingSessions = this.mockSessions.get(taskId) || [];
    existingSessions.push(mockSession);
    this.mockSessions.set(taskId, existingSessions);
    
    // Register with adapter
    sessionAdapter.registerSession(mockSession);
    
    const result: CreateTerminalResult = {
      ...mockSession,
      isReconnected: false,
      createdAt: new Date().toISOString(),
      cols: 80,
      rows: 24,
      wsUrl: `ws://localhost:8080/ws/${shelltenderSessionId}`
    };
    
    return result;
  }

  private handleMockDeletion(dbSessionId: string): void {
    // Find and remove from all task sessions
    for (const [taskId, sessions] of this.mockSessions.entries()) {
      const filteredSessions = sessions.filter(session => session.dbSessionId !== dbSessionId);
      if (filteredSessions.length !== sessions.length) {
        this.mockSessions.set(taskId, filteredSessions);
        break;
      }
    }
  }

  private generateMockSessionId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private getNextTabOrder(taskId: string): number {
    const existingSessions = this.mockSessions.get(taskId) || [];
    return existingSessions.length + 1;
  }

  protected initializeMockData(): void {
    // Initialize with sample terminal sessions for development
    const mockSessions: TerminalSession[] = [
      {
        sessionId: 'task-mock1-abc123',
        dbSessionId: 'sess_abc123',
        shelltenderSessionId: 'task-mock1-abc123',
        tabName: 'Claude',
        tabOrder: 1,
        aiState: 'idle',
        aiAgent: 'claude',
        shelltenderStatus: 'active'
      },
      {
        sessionId: 'task-mock1-def456',
        dbSessionId: 'sess_def456',
        shelltenderSessionId: 'task-mock1-def456',
        tabName: 'Terminal',
        tabOrder: 2,
        aiState: 'not-started',
        aiAgent: 'terminal',
        shelltenderStatus: 'active'
      }
    ];
    
    // Add sample sessions for different tasks
    this.mockSessions.set('task_1', mockSessions);
    this.mockSessions.set('task_2', [mockSessions[0]]); // Single session
    
    // Register mock sessions with adapter
    mockSessions.forEach(session => sessionAdapter.registerSession(session));
  }

  // Utility methods for session management

  /**
   * Get normalized session ID for components to use
   */
  public normalizeSessionId(anySessionId: string): NormalizedSessionId | null {
    return sessionAdapter.normalize(anySessionId);
  }

  /**
   * Get all normalized sessions for components
   */
  public getNormalizedSessions(): Array<{
    id: NormalizedSessionId;
    tabName: string;
    tabOrder: number;
    aiState: string;
    aiAgent: string;
  }> {
    return sessionAdapter.getAllSessions().map(session => ({
      id: session.id,
      tabName: session.tabName,
      tabOrder: session.tabOrder,
      aiState: session.aiState,
      aiAgent: session.aiAgent
    }));
  }

  /**
   * Check if a session exists
   */
  public hasSession(sessionId: string): boolean {
    const normalized = this.normalizeSessionId(sessionId);
    return normalized ? sessionAdapter.hasSession(normalized) : false;
  }
}