/**
 * Mock data for TaskService
 * Separated from production code for cleaner services
 */

import type { Task, TaskState } from '@shared/types';
import type { CommitHistory } from '../interfaces/task.service.interface';

export const mockTasks: Task[] = [
  {
    id: '17db1cde001',
    name: 'Update the task view page',
    description: 'Improve the task view UI and add better status indicators',
    branch: 'feature/task-view-page',
    worktree_path: '/projects/17db1cde-task-001',
    created_at: '2025-01-15T22:27:16Z',
    taskState: 'active' as TaskState,
    sessionState: {
      status: 'working' as const,
      lastStateChange: '2025-01-15T22:50:00Z'
    },
    gitStatus: {
      ahead: 3,
      behind: 0,
      hasConflicts: false,
      staged: 2,
      unstaged: 1,
      untracked: 0
    },
    terminals: [
      {
        sessionId: 'session-001',
        dbSessionId: 'db-session-001',
        shelltenderSessionId: 'session-001',
        tabName: 'Main',
        tabOrder: 0,
        aiState: 'working' as const,
        aiAgent: 'claude',
        shelltenderStatus: 'active' as const
      }
    ]
  },
  {
    id: '17db1cde002',
    name: 'Add user authentication',
    description: 'Implement JWT-based authentication with login/register',
    branch: 'feature/add-auth-system',
    worktree_path: '/projects/17db1cde-task-002',
    created_at: '2025-01-15T21:45:12Z',
    taskState: 'active' as TaskState,
    sessionState: {
      status: 'waiting' as const,
      lastStateChange: '2025-01-15T23:00:00Z'
    },
    gitStatus: {
      ahead: 5,
      behind: 2,
      hasConflicts: true,
      staged: 0,
      unstaged: 3,
      untracked: 1
    },
    terminals: [
      {
        sessionId: 'session-002',
        dbSessionId: 'db-session-002',
        shelltenderSessionId: 'session-002',
        tabName: 'Auth Dev',
        tabOrder: 0,
        aiState: 'waiting' as const,
        aiAgent: 'claude',
        shelltenderStatus: 'active' as const
      }
    ]
  },
  {
    id: '17db1cde003',
    name: 'Fix memory leak in worker',
    description: 'Investigate and fix memory leak in background worker process',
    branch: 'fix/memory-leak-worker',
    worktree_path: '/projects/17db1cde-task-003',
    created_at: '2025-01-15T18:30:00Z',
    taskState: 'merged' as TaskState,
    sessionState: {
      status: 'idle' as const,
      lastStateChange: '2025-01-15T21:00:00Z'
    },
    merged_at: '2025-01-15T21:00:00Z',
    terminals: []
  },
  {
    id: '5650a417001',
    name: 'Optimize shell performance',
    description: 'Improve shell response times and memory usage',
    branch: 'perf/shell-optimization',
    worktree_path: '/projects/5650a417-task-001',
    created_at: '2025-01-16T09:15:00Z',
    taskState: 'active' as TaskState,
    sessionState: {
      status: 'idle' as const,
      lastStateChange: '2025-01-16T09:30:00Z'
    },
    gitStatus: {
      ahead: 1,
      behind: 0,
      hasConflicts: false,
      staged: 1,
      unstaged: 0,
      untracked: 0
    },
    terminals: [
      {
        sessionId: 'session-003',
        dbSessionId: 'db-session-003',
        shelltenderSessionId: 'session-003',
        tabName: 'Performance',
        tabOrder: 0,
        aiState: 'idle' as const,
        aiAgent: 'claude',
        shelltenderStatus: 'active' as const
      }
    ]
  }
];

export const mockCommitHistory: CommitHistory[] = [
  {
    hash: 'abc123def456',
    message: 'Fix responsive layout in header',
    author: 'You',
    date: '2 hours ago',
    isMerge: false
  },
  {
    hash: 'def456ghi789',
    message: 'Add loading states to buttons',
    author: 'Claude',
    date: '4 hours ago',
    isMerge: false
  },
  {
    hash: 'ghi789jkl012',
    message: 'Merge branch main into feature branch',
    author: 'System',
    date: '1 day ago',
    isMerge: true
  },
  {
    hash: 'jkl012mno345',
    message: 'Initial task setup and planning',
    author: 'You',
    date: '2 days ago',
    isMerge: false
  }
];

// Helper functions
export function getMockTask(id: string): Task | undefined {
  return mockTasks.find(t => t.id === id);
}

export function getMockTasksByProject(projectId: string): Task[] {
  // Map project IDs to their tasks
  const projectTaskMap: Record<string, string[]> = {
    '17db1cde': ['17db1cde001', '17db1cde002', '17db1cde003'],
    '5650a417': ['5650a417001'],
    'abc12345': []
  };
  
  const taskIds = projectTaskMap[projectId] || [];
  return mockTasks.filter(t => taskIds.includes(t.id));
}

export async function mockDelay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}