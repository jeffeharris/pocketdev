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
import { mockProjects, mockBranches, mockPlanningContent } from './mocks/project.mock';

export class ProjectService extends BaseService implements IProjectService {
  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
  }

  // Public interface - 8 methods for comprehensive project management

  async getProjects(): Promise<Project[]> {
    if (this.isMockEnabled) {
      return [...mockProjects];
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
      const project = mockProjects.find(p => p.id === projectId);
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
      
      mockProjects.push(newProject);
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
      const project = mockProjects.find(p => p.id === projectId);
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
        content: mockPlanningContent
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
      return [...mockBranches];
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

  private findMockProject(projectId: string): Project {
    const project = mockProjects.find(p => p.id === projectId);
    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }
    return project;
  }
}