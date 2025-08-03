/**
 * ExampleService - Demonstrates the service patterns
 * 
 * This service shows how to implement the deep module pattern:
 * - Simple interface (few public methods)
 * - Complex implementation (hidden from users)
 * - Clear abstraction boundary
 * - Mock support built-in
 */

import { BaseService } from './base.service';
import type { Project } from '../types/project';
import type { IProjectService, ServiceResult } from './types';

export class ExampleProjectService extends BaseService implements IProjectService {
  private cache = new Map<string, Project>();
  private mockData: Project[] = [];

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Simple public interface - only 8 methods (following deep module principle)
  
  async getAll(): Promise<Project[]> {
    if (this.isMockEnabled) {
      return this.mockData;
    }
    
    const projects = await this.get<Project[]>('/projects');
    return this.mapBackendProjects(projects);
  }

  async getById(id: string): Promise<Project> {
    if (this.isMockEnabled) {
      const project = this.mockData.find(p => p.id === id);
      if (!project) throw new Error('Project not found');
      return project;
    }
    
    const project = await this.get<any>(`/projects/${id}`);
    return this.mapBackendProject(project);
  }

  async create(data: { repoUrl: string; branch: string; projectName: string }): Promise<Project> {
    if (this.isMockEnabled) {
      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: data.projectName,
        repository: data.repoUrl,
        baseBranch: data.branch,
        created: new Date().toISOString(),
        tasksCount: 0
      };
      this.mockData.push(newProject);
      return newProject;
    }
    
    const response = await this.post<any>('/projects', data);
    return this.mapBackendProject(response.project || response);
  }

  async update(id: string, data: Partial<Project>): Promise<Project> {
    if (this.isMockEnabled) {
      const index = this.mockData.findIndex(p => p.id === id);
      if (index === -1) throw new Error('Project not found');
      
      this.mockData[index] = { ...this.mockData[index], ...data };
      return this.mockData[index];
    }
    
    const response = await this.patch<any>(`/projects/${id}`, data);
    return this.mapBackendProject(response);
  }

  async delete(id: string): Promise<void> {
    if (this.isMockEnabled) {
      const index = this.mockData.findIndex(p => p.id === id);
      if (index !== -1) {
        this.mockData.splice(index, 1);
      }
      return;
    }
    
    await this.delete<void>(`/projects/${id}`);
  }

  async getBranches(projectId: string): Promise<string[]> {
    if (this.isMockEnabled) {
      return ['main', 'develop', 'feature/auth', 'fix/bugs'];
    }
    
    const response = await this.get<Array<{ name: string; isRemote: boolean; fullName: string }>>(
      `/projects/${projectId}/branches`
    );
    
    return this.extractBranchNames(response);
  }

  async getDashboard(projectId: string): Promise<any> {
    if (this.isMockEnabled) {
      return {
        project: this.mockData.find(p => p.id === projectId),
        needsAttention: [],
        tasksCount: 3,
        activeTasks: 2
      };
    }
    
    return this.get<any>(`/projects/${projectId}/dashboard`);
  }

  async pullBaseBranch(projectId: string): Promise<ServiceResult> {
    if (this.isMockEnabled) {
      return { success: true, data: { message: 'Successfully pulled updates to main' } };
    }
    
    const result = await this.post<any>(`/projects/${projectId}/pull-base-branch`);
    return { success: result.success, data: result };
  }

  async pushBaseBranch(projectId: string): Promise<ServiceResult> {
    if (this.isMockEnabled) {
      return { success: true, data: { message: 'Successfully pushed main to origin' } };
    }
    
    const result = await this.post<any>(`/projects/${projectId}/push-base-branch`);
    return { success: result.success, data: result };
  }

  async refreshStatus(projectId: string): Promise<ServiceResult> {
    if (this.isMockEnabled) {
      return { success: true, data: { message: 'Refresh triggered' } };
    }
    
    const result = await this.post<any>(`/projects/${projectId}/refresh`);
    return { success: result.success, data: result };
  }

  // Complex implementation hidden from users
  
  private mapBackendProjects(backendProjects: any[]): Project[] {
    return backendProjects.map(p => this.mapBackendProject(p));
  }

  private mapBackendProject(backendProject: any): Project {
    return {
      id: backendProject.id,
      name: backendProject.name,
      repository: backendProject.repo_url || backendProject.repository,
      baseBranch: backendProject.base_branch || backendProject.baseBranch,
      created: backendProject.created_at || backendProject.created,
      tasksCount: backendProject.task_count || backendProject.tasksCount || 0
    };
  }

  private extractBranchNames(branches: Array<{ name: string; isRemote: boolean; fullName: string }>): string[] {
    const branchMap = new Map<string, boolean>();
    
    // Add local branches first
    branches
      .filter(branch => !branch.isRemote)
      .forEach(branch => branchMap.set(branch.name, true));
    
    // Add remote branches
    branches
      .filter(branch => branch.isRemote && !branch.name.includes('HEAD'))
      .forEach(branch => {
        const cleanName = branch.fullName.replace(/^remotes\/origin\//, '');
        if (!branchMap.has(cleanName)) {
          branchMap.set(cleanName, false);
        }
      });
    
    return Array.from(branchMap.keys());
  }

  protected initializeMockData(): void {
    this.mockData = [
      {
        id: 'proj_1',
        name: 'E-commerce Platform',
        repository: 'https://github.com/user/ecommerce',
        baseBranch: 'main',
        created: '2024-01-15T10:30:00Z',
        tasksCount: 5
      },
      {
        id: 'proj_2',
        name: 'Marketing Website',
        repository: 'https://github.com/user/marketing-site',
        baseBranch: 'main',
        created: '2024-01-10T14:20:00Z',
        tasksCount: 3
      }
    ];
  }
}