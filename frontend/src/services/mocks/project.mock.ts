/**
 * Mock data for ProjectService
 * Separated from production code for cleaner services
 */

import type { Project } from '../../types/project';
import type { ProjectDashboard } from '../interfaces/project.service.interface';

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
  {
    id: 'abc12345',
    name: 'my-react-app',
    repository: 'https://github.com/user/my-react-app',
    baseBranch: 'develop',
    created: '2025-01-10T09:15:00Z',
    tasksCount: 5,
  },
];

export const mockBranches: string[] = [
  'main', 
  'develop', 
  'feature/user-auth', 
  'feature/api-refactor', 
  'fix/memory-leak',
  'hotfix/security-patch'
];

export const mockPlanningContent = `# Project Planning

## 🐛 Bugs
- [ ] Cart total not updating when quantity changes
- [ ] Login redirect loop on mobile Safari
- [ ] Memory leak in WebSocket connections

## 💡 Ideas
- [ ] Add dark mode toggle
- [ ] Implement offline support
- [ ] Add keyboard shortcuts
- [ ] Migrate to React 19 features

## 📋 Sprint Planning
### Current Sprint (Jan 15 - Jan 29)
- [x] Fix authentication issues
- [ ] Implement new dashboard
- [ ] Add unit tests for core modules

### Backlog
- Refactor legacy components
- Add integration tests
- Performance optimization
- Accessibility improvements`;

export const mockDashboard: ProjectDashboard = {
  project: mockProjects[0],
  statistics: {
    totalTasks: 3,
    activeTasks: 2,
    completedTasks: 1,
    branches: 6,
    lastActivity: '2025-01-15T10:30:00Z',
  },
  recentActivity: [
    {
      type: 'task_created',
      description: 'Created task: Update the task view page',
      timestamp: '2025-01-15T10:30:00Z',
    },
    {
      type: 'task_completed',
      description: 'Completed task: Fix authentication issues',
      timestamp: '2025-01-14T16:45:00Z',
    },
    {
      type: 'branch_merged',
      description: 'Merged branch: feature/auth-fix',
      timestamp: '2025-01-14T16:30:00Z',
    },
  ],
};

// Helper to get a mock project by ID
export function getMockProject(id: string): Project | undefined {
  return mockProjects.find(p => p.id === id);
}

// Helper to simulate delay for async operations
export async function mockDelay(ms: number = 300): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}