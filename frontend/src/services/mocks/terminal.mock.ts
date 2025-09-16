/**
 * Mock data for TerminalService
 * Separated from production code for cleaner services
 */

import type { TerminalSession } from '@shared/types';
import type { CreateTerminalResult } from '../interfaces/terminal.service.interface';

export const mockTerminalSessions: TerminalSession[] = [
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

// Initial mock sessions data
export const initialMockSessions = new Map<string, TerminalSession[]>([
  ['task_1', mockTerminalSessions],
  ['task_2', [mockTerminalSessions[0]]] // Single session
]);

export function generateMockSessionId(): string {
  return Math.random().toString(36).substring(2, 10);
}

export function createMockSession(
  taskId: string, 
  dbSessionId: string,
  tabName: string,
  tabOrder: number,
  aiAgent: string = 'claude'
): TerminalSession {
  const shelltenderSessionId = `task-${taskId}-${dbSessionId}`;
  
  return {
    sessionId: shelltenderSessionId, // Legacy compatibility
    dbSessionId,
    shelltenderSessionId,
    tabName,
    tabOrder,
    aiState: 'not-started',
    aiAgent,
    shelltenderStatus: 'active'
  };
}

export function createMockTerminalResult(mockSession: TerminalSession): CreateTerminalResult {
  return {
    ...mockSession,
    isReconnected: false,
    createdAt: new Date().toISOString(),
    cols: 80,
    rows: 24,
    wsUrl: `ws://localhost:8080/ws/${mockSession.shelltenderSessionId}`
  };
}

export function getNextTabOrder(existingSessions: TerminalSession[]): number {
  return existingSessions.length + 1;
}