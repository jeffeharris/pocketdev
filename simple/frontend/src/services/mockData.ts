import type { Task } from '../types/task';
import { WorkerStatus } from '../types/task';
import type { GitStatus, ChangedFile } from '../types/git';
import type { Project } from '../types/project';

export const mockProjects: Project[] = [
  {
    id: '17db1cde',
    name: 'pocketdev',
    repository: 'https://github.com/jeffeharris/pocketdev',
    baseBranch: 'simple-server',
    created: '2025-01-01T10:00:00Z',
    tasksCount: 3,
  },
  {
    id: '5650a417',
    name: 'shelltender',
    repository: 'https://github.com/shelltender/shelltender',
    baseBranch: 'main',
    created: '2025-01-05T14:30:00Z',
    tasksCount: 1,
  },
];

export const mockTasks: Task[] = [
  {
    id: '7d29e028',
    name: 'Update the task view page',
    description: 'Improve the task view UI and add better status indicators',
    branch: 'feature/task-view-page',
    worktree_path: '/projects/17dbiode-task-7d29e028',
    created_at: '2025-01-15T22:27:16Z',
    taskState: 'active',
    sessionState: {
      status: WorkerStatus.Working,
      lastStateChange: '2025-01-15T22:50:00Z'
    },
    gitStatus: {
      ahead: 3,
      behind: 0,
      hasConflicts: false
    }
  },
  {
    id: 'abc12345',
    name: 'Add user authentication',
    description: 'Implement JWT-based authentication with login/register',
    branch: 'feature/add-auth-system',
    worktree_path: '/projects/17dbiode-task-abc12345',
    created_at: '2025-01-15T21:45:12Z',
    taskState: 'active',
    sessionState: {
      status: WorkerStatus.Waiting,
      lastStateChange: '2025-01-15T23:00:00Z'
    },
    gitStatus: {
      ahead: 5,
      behind: 2,
      hasConflicts: true
    }
  },
  {
    id: 'def45678',
    name: 'Fix memory leak in worker',
    description: 'Investigate and fix memory leak in background worker process',
    branch: 'fix/memory-leak-worker',
    worktree_path: '/projects/17dbiode-task-def45678',
    created_at: '2025-01-15T18:30:00Z',
    taskState: 'merged',
    sessionState: {
      status: WorkerStatus.Idle,
      lastStateChange: '2025-01-15T21:00:00Z'
    },
    merged_at: '2025-01-15T21:00:00Z'
  },
];

export const mockGitStatus: GitStatus = {
  clean: true,
  ahead: 3,
  behind: 0,
  filesChanged: 5,
  branch: 'feature/task-view-page',
  upToDate: false,
};

export const mockChangedFiles: ChangedFile[] = [
  {
    name: 'src/components/TaskCard.tsx',
    additions: 23,
    deletions: 5,
    type: 'modified',
  },
  {
    name: 'src/components/StatusBadge.tsx',
    additions: 18,
    deletions: 0,
    type: 'added',
  },
  {
    name: 'src/styles/task-view.css',
    additions: 6,
    deletions: 7,
    type: 'modified',
  },
  {
    name: 'src/utils/deprecated.js',
    additions: 0,
    deletions: 0,
    type: 'deleted',
  },
];