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
import type { TerminalSession } from '@shared/types';
import {
  initialMockSessions,
  mockTerminalSessions,
  generateMockSessionId,
  createMockSession,
  createMockTerminalResult,
  getNextTabOrder
} from './mocks/terminal.mock';

export class TerminalService extends BaseService implements ITerminalService {
  private mockSessions: Map<string, TerminalSession[]> = new Map(initialMockSessions);

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      // Register mock sessions with adapter
      mockTerminalSessions.forEach(session => sessionAdapter.registerSession(session));
    }
  }

  // Simple public interface - 6 core methods (deep module principle)

  async getTerminalSessions(taskId: string): Promise<Array<TerminalSession & { normalizedId: NormalizedSessionId }>> {
    if (this.isMockEnabled) {
      const sessions = this.mockSessions.get(taskId) || [];
      // Register sessions and include normalized IDs
      return sessions.map(session => ({
        ...session,
        normalizedId: sessionAdapter.registerSession(session)
      }));
    }
    
    // Get task details which includes terminals
    const response = await this.get<{ terminals?: TerminalSession[] }>(`/tasks/${taskId}`);
    const sessions = response.terminals || [];
    
    // Register all sessions and include normalized IDs
    return sessions.map(session => ({
      ...session,
      normalizedId: sessionAdapter.registerSession(session)
    }));
  }

  async createTerminalSession(taskId: string, options: CreateTerminalOptions = {}): Promise<CreateTerminalResult> {
    if (this.isMockEnabled) {
      return this.handleMockCreation(taskId, options);
    }
    
    const result = await this.post<CreateTerminalResult>(`/tasks/${taskId}/terminals`, options);
    
    console.log('[TerminalService createTerminalSession] Backend response:', result);
    
    // Ensure the response has all required fields for the adapter
    // The backend returns 'sessionId' but TerminalSession expects different fields
    const terminalSession: TerminalSession = {
      sessionId: result.sessionId,
      dbSessionId: result.dbSessionId,
      shelltenderSessionId: result.shelltenderSessionId || result.sessionId, // Fallback to sessionId if shelltenderSessionId is missing
      tabName: result.tabName,
      tabOrder: result.tabOrder,
      aiState: result.aiState || 'not-started',
      aiAgent: result.aiAgent
    };
    
    // Register the new session with the adapter and include normalized ID
    const normalizedId = sessionAdapter.registerSession(terminalSession);
    
    return {
      ...result,
      normalizedId
    };
  }

  async updateTerminalTab(normalizedId: NormalizedSessionId, updates: TerminalTabUpdate): Promise<TerminalTabUpdate> {
    // Only accept normalized IDs - components should not pass raw IDs
    const sessionInfo = sessionAdapter.getSessionInfo(normalizedId);
    if (!sessionInfo) {
      throw new Error(`Session not found: ${normalizedId}`);
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

  async deleteTerminalSession(normalizedId: NormalizedSessionId): Promise<void> {
    console.log('[TerminalService] deleteTerminalSession called with:', normalizedId);
    
    // Only accept normalized IDs
    const sessionInfo = sessionAdapter.getSessionInfo(normalizedId);
    if (!sessionInfo) {
      console.log('[TerminalService] Session not found in adapter:', normalizedId);
      throw new Error(`Session not found: ${normalizedId}`);
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

  async executeCommand(normalizedId: NormalizedSessionId, command: string): Promise<void> {
    console.log('[TerminalService executeCommand] Called with normalizedId:', normalizedId);
    
    // Only accept normalized IDs
    const sessionInfo = sessionAdapter.getSessionInfo(normalizedId);
    console.log('[TerminalService executeCommand] Found session info:', sessionInfo);
    
    if (!sessionInfo) {
      throw new Error(`Session not found: ${normalizedId}`);
    }
    
    if (this.isMockEnabled) {
      // Mock execution - just log for development
      console.log(`Mock executing command in session ${sessionInfo.id}:`, command);
      return;
    }
    
    // Use the Shelltender session ID for command execution
    // If shelltenderSessionId is undefined, fall back to legacySessionId (which is the composite session ID)
    const sessionIdToUse = sessionInfo.shelltenderSessionId || sessionInfo.legacySessionId;
    console.log('[TerminalService executeCommand] Using sessionId:', sessionIdToUse);
    await this.post<void>(`/sessions/${sessionIdToUse}/execute`, { command });
  }

  async openTerminal(taskId: string): Promise<{ url: string }> {
    if (this.isMockEnabled) {
      return { url: `http://localhost:8080/terminal/mock-${taskId}` };
    }
    
    return this.post<{ url: string }>(`/tasks/${taskId}/terminal`);
  }

  // Complex implementation hidden from users

  private handleMockCreation(taskId: string, options: CreateTerminalOptions): CreateTerminalResult {
    const dbSessionId = generateMockSessionId();
    const existingSessions = this.mockSessions.get(taskId) || [];
    const tabOrder = getNextTabOrder(existingSessions);
    
    const mockSession = createMockSession(
      taskId,
      dbSessionId,
      options.tabName || 'New Tab',
      tabOrder,
      options.aiAgent || 'claude'
    );
    
    // Add to mock storage
    existingSessions.push(mockSession);
    this.mockSessions.set(taskId, existingSessions);
    
    // Register with adapter
    sessionAdapter.registerSession(mockSession);
    
    return createMockTerminalResult(mockSession);
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


  // AI Agent launching

  /**
   * Launch an AI agent in a terminal session
   * Handles agent-specific command syntax and directory changes
   */
  async launchAgent(
    normalizedId: NormalizedSessionId,
    agent: 'claude' | 'aider' | 'codex' | 'gemini' | 'none',
    options?: {
      workingDirectory?: string;
      initialPrompt?: string;
      worktreePath?: string;
    }
  ): Promise<void> {
    if (agent === 'none') return;
    
    const commands: string[] = [];
    
    // Change directory if specified
    if (options?.workingDirectory) {
      // Make path relative to task path if needed
      const fullPath = options.workingDirectory.startsWith('/') 
        ? options.workingDirectory 
        : `${options.worktreePath}/${options.workingDirectory}`;
      commands.push(`cd ${fullPath}`);
    }
    
    // Build agent-specific command
    const agentCommand = this.buildAgentCommand(agent, options?.initialPrompt);
    if (agentCommand) {
      commands.push(agentCommand);
    }
    
    // Execute commands in sequence
    for (const command of commands) {
      await this.executeCommand(normalizedId, command);
      // Small delay between commands
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  /**
   * Build agent-specific command with proper syntax
   */
  private buildAgentCommand(agent: string, prompt?: string): string {
    if (!prompt) {
      // Simple case - just launch the agent
      return agent;
    }
    
    // Properly escape the prompt for shell
    const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\$/g, '\\$');
    
    // Different syntax for different agents
    switch (agent) {
      case 'aider':
        return `aider --message "${escapedPrompt}"`;
      case 'claude':
      case 'codex':
        return `${agent} "${escapedPrompt}"`;
      case 'gemini':
        // Use -p flag for prompt
        return `gemini -p "${escapedPrompt}"`;
      default:
        return `${agent} "${escapedPrompt}"`;
    }
  }
}