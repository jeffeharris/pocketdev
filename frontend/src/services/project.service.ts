/**
 * ProjectService - Project management operations
 * 
 * This service handles all project-level operations including CRUD operations,
 * branch management, dashboard data, and planning documents. Despite having
 * 8 methods, it maintains the deep module principle by providing a simple
 * interface that hides complex project management logic.
 * 
 * Dependencies: None (leaf service)
 */

import { BaseService } from './base.service';
import type { 
  IProjectService, 
  CreateProjectData, 
  ProjectDashboard, 
  ProjectPlanning, 
  GitOperationResult 
} from './interfaces/project.service.interface';
import type { Project } from '../types/project';

export class ProjectService extends BaseService implements IProjectService {
  private mockProjects: Project[] = [
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

  private mockBranches: string[] = [
    'main', 
    'develop', 
    'feature/user-auth', 
    'feature/api-refactor', 
    'fix/memory-leak',
    'hotfix/security-patch'
  ];

  private mockPlanningContent = `# Project Planning

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

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Public interface - 8 methods for comprehensive project management

  async getProjects(): Promise<Project[]> {
    if (this.isMockEnabled) {
      return [...this.mockProjects];
    }
    
    const response = await this.get<any[]>('/projects');
    
    // Map backend format to our Project type
    return response.map(p => ({
      id: p.id,
      name: p.name,
      repository: p.repo_url,
      baseBranch: p.base_branch,
      created: p.created_at,
      tasksCount: p.task_count || 0
    }));
  }

  async getProject(projectId: string, options?: { minimal?: boolean }): Promise<Project> {
    if (this.isMockEnabled) {
      const project = this.mockProjects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      return { ...project };
    }
    
    const endpoint = options?.minimal 
      ? `/projects/${projectId}/minimal`
      : `/projects/${projectId}`;
    
    const response = await this.get<any>(endpoint);
    
    // Map backend format to our Project type
    return {
      id: response.id,
      name: response.name,
      repository: response.repo_url || response.repository,
      baseBranch: response.base_branch || response.baseBranch,
      created: response.created_at || response.created,
      tasksCount: response.task_count || response.tasksCount || 0
    };
  }

  async createProject(data: CreateProjectData): Promise<Project> {
    if (this.isMockEnabled) {
      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: data.projectName,
        repository: data.repoUrl,
        baseBranch: data.branch,
        created: new Date().toISOString(),
        tasksCount: 0
      };
      
      this.mockProjects.push(newProject);
      return { ...newProject };
    }
    
    const response = await this.post<any>('/projects', data);
    
    // Backend returns { success: true, project: {...} } or just the project
    const project = response.project || response;
    
    return {
      id: project.id,
      name: project.name,
      repository: project.repo_url,
      baseBranch: project.base_branch,
      created: project.created_at,
      tasksCount: 0
    };
  }

  async getProjectDashboard(projectId: string, options?: { cached?: boolean }): Promise<ProjectDashboard> {
    if (this.isMockEnabled) {
      const project = this.mockProjects.find(p => p.id === projectId);
      if (!project) {
        throw new Error('Project not found');
      }
      
      const mockDashboard: ProjectDashboard = {
        project: { ...project },
        needsAttention: options?.cached ? [] : [
          {
            type: 'base-behind',
            severity: 'warning',
            message: 'Base branch is 5 commits behind origin',
            details: { behind: 5, branch: project.baseBranch },
            actions: ['pull']
          },
          {
            type: 'stale-task',
            severity: 'warning',
            message: 'Task "Auth system" inactive for 12 days',
            details: { taskId: '1', taskName: 'Auth system', daysSinceUpdate: 12 },
            actions: ['open-task', 'archive']
          },
          {
            type: 'memory-usage',
            severity: 'info',
            message: 'High memory usage detected in development environment',
            details: { usage: '85%', threshold: '80%' },
            actions: ['restart-services', 'optimize']
          }
        ],
        tasksCount: project.tasksCount || 0,
        activeTasks: Math.min(2, project.tasksCount || 0),
        cached: options?.cached,
        lastUpdated: options?.cached ? new Date().toISOString() : undefined
      };
      
      return mockDashboard;
    }
    
    const endpoint = options?.cached 
      ? `/projects/${projectId}/dashboard/cached`
      : `/projects/${projectId}/dashboard`;
    
    return this.get<ProjectDashboard>(endpoint);
  }

  async getProjectPlanning(projectId: string): Promise<ProjectPlanning> {
    if (this.isMockEnabled) {
      return {
        exists: true,
        content: this.mockPlanningContent
      };
    }
    
    return this.get<ProjectPlanning>(`/projects/${projectId}/planning`);
  }

  async updateProjectPlanning(projectId: string, content: string): Promise<GitOperationResult & { needsPush?: boolean }> {
    if (this.isMockEnabled) {
      return { 
        success: true, 
        message: 'Planning updated successfully', 
        needsPush: true 
      };
    }
    
    return this.put<GitOperationResult & { needsPush?: boolean }>(`/projects/${projectId}/planning`, { content });
  }

  async getProjectBranches(projectId: string): Promise<string[]> {
    if (this.isMockEnabled) {
      return [...this.mockBranches];
    }
    
    const response = await this.get<Array<{ name: string; isRemote: boolean; fullName: string }>>(`/projects/${projectId}/branches`);
    
    // Get unique branch names, preferring local over remote
    const branchMap = new Map<string, boolean>();
    
    // First add local branches
    response
      .filter(b => !b.isRemote)
      .forEach(b => branchMap.set(b.name, true));
    
    // Then add remote branches that don't have local counterparts
    response
      .filter(b => b.isRemote)
      .forEach(b => {
        const localName = b.name.replace(/^origin\//, '');
        if (!branchMap.has(localName)) {
          branchMap.set(localName, true);
        }
      });
    
    return Array.from(branchMap.keys()).sort();
  }

  async baseBranchOperation(projectId: string, operation: 'pull' | 'push' | 'refresh'): Promise<GitOperationResult> {
    if (this.isMockEnabled) {
      const messages = {
        pull: 'Successfully pulled updates to main',
        push: 'Successfully pushed main to origin',
        refresh: 'Refresh triggered'
      };
      
      return { 
        success: true, 
        message: messages[operation] 
      };
    }
    
    const endpoint = operation === 'refresh' 
      ? `/projects/${projectId}/refresh`
      : `/projects/${projectId}/${operation}-base-branch`;
    
    return this.post<GitOperationResult>(endpoint);
  }

  // Private helper methods

  protected initializeMockData(): void {
    // Mock data is initialized in constructor
    // This method can be used for any additional mock setup if needed
  }

  private findMockProject(projectId: string): Project {
    const project = this.mockProjects.find(p => p.id === projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    return project;
  }
}