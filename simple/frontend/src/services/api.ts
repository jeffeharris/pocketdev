import type { Task, CreateTaskDTO } from '../types/task';
import type { GitStatus, ChangedFile, PullRequest } from '../types/git';
import type { DeploymentResult } from '../types/container';
import type { Project } from '../types/project';
import { mockTasks, mockProjects, mockGitStatus, mockChangedFiles } from './mockData';

const API_BASE = '/api';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

class ApiService {
  private async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Project endpoints
  async getProjects(): Promise<Project[]> {
    if (USE_MOCKS) return mockProjects;
    const response = await this.fetch<any[]>('/projects');
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

  async getProject(id: string): Promise<Project> {
    if (USE_MOCKS) {
      const project = mockProjects.find(p => p.id === id);
      if (!project) throw new Error('Project not found');
      return project;
    }
    const response = await this.fetch<any>(`/projects/${id}`);
    // Map backend format to our Project type
    return {
      id: response.id,
      name: response.name,
      repository: response.repo_url,
      baseBranch: response.base_branch,
      created: response.created_at,
      tasksCount: response.task_count || 0
    };
  }

  // Task endpoints
  async getTasks(projectId: string): Promise<Task[]> {
    if (USE_MOCKS) return mockTasks.filter(t => t.id.startsWith(projectId.slice(0, 8)));
    const response = await this.fetch<any[]>(`/projects/${projectId}/tasks`);
    // Backend now includes sessionState and taskState
    return response.map(t => ({
      id: t.id,
      title: t.name || 'Untitled Task',
      description: '', // Not in backend yet
      branch: t.branch,
      worktree_path: t.worktree_path,
      created_at: t.created_at,
      
      // These come from backend now
      taskState: t.taskState || 'active',
      sessionState: t.sessionState || { status: 'not-started', lastStateChange: null },
      
      // Optional fields
      project_id: t.project_id,
      is_archived: t.is_archived,
      merged_at: t.merged_at,
      has_uncommitted_changes: t.has_uncommitted_changes,
      gitStatus: t.gitStatus
    }));
  }

  async getTask(taskId: string): Promise<Task> {
    if (USE_MOCKS) {
      const task = mockTasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');
      return task;
    }
    return this.fetch<Task>(`/tasks/${taskId}`);
  }

  async createTask(projectId: string, task: CreateTaskDTO): Promise<Task> {
    if (USE_MOCKS) {
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 8),
        title: task.title,
        description: task.description,
        branch: task.branchPrefix ? `${task.branchPrefix}${task.branch}` : task.branch,
        status: 'not-started',
        engineer: task.engineerId,
        worktree: `/projects/${projectId}-task-${Date.now()}`,
        created: new Date().toISOString(),
        duration: '0m',
        hasConflicts: false,
      };
      mockTasks.push(newTask);
      return newTask;
    }
    return this.fetch<Task>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  // Git endpoints
  async getGitStatus(taskId: string): Promise<GitStatus> {
    if (USE_MOCKS) return mockGitStatus;
    return this.fetch<GitStatus>(`/tasks/${taskId}/git/status`);
  }

  async getChangedFiles(taskId: string): Promise<ChangedFile[]> {
    if (USE_MOCKS) return mockChangedFiles;
    return this.fetch<ChangedFile[]>(`/tasks/${taskId}/files/changed`);
  }

  async checkConflicts(taskId: string): Promise<boolean> {
    if (USE_MOCKS) return Math.random() > 0.7; // 30% chance of conflicts
    const result = await this.fetch<{ hasConflicts: boolean }>(`/tasks/${taskId}/git/check-conflicts`);
    return result.hasConflicts;
  }

  async createPR(taskId: string, description: string): Promise<PullRequest> {
    if (USE_MOCKS) {
      return {
        id: Math.floor(Math.random() * 1000),
        url: `https://github.com/user/repo/pull/${Math.floor(Math.random() * 1000)}`,
        title: 'Mock PR',
        description,
        state: 'open',
        mergeable: true,
        conflicts: false,
      };
    }
    return this.fetch<PullRequest>(`/tasks/${taskId}/pr/create`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  }

  // Container endpoints
  async deployContainers(taskId: string): Promise<DeploymentResult> {
    if (USE_MOCKS) {
      return {
        success: true,
        services: [
          { id: '1', name: 'web-app', port: 9001, status: 'running', autoAssigned: true, type: 'web-app' },
          { id: '2', name: 'api', port: 9002, status: 'running', autoAssigned: true, type: 'api' },
          { id: '3', name: 'database', port: 9003, status: 'stopped', autoAssigned: true, type: 'database' },
        ],
      };
    }
    return this.fetch<DeploymentResult>(`/tasks/${taskId}/deploy`, {
      method: 'POST',
    });
  }

  async stopContainers(taskId: string): Promise<void> {
    if (USE_MOCKS) return;
    await this.fetch(`/tasks/${taskId}/containers`, {
      method: 'DELETE',
    });
  }

  async getContainerLogs(taskId: string): Promise<string[]> {
    if (USE_MOCKS) {
      return [
        '[10:30:45] Starting container deployment...',
        '[10:30:46] Building Docker images...',
        '[10:30:50] Starting web-app service on port 9001',
        '[10:30:52] Starting api service on port 9002',
        '[10:30:55] All services started successfully',
      ];
    }
    return this.fetch<string[]>(`/tasks/${taskId}/container-logs`);
  }

  // Terminal endpoint
  async openTerminal(taskId: string): Promise<{ url: string }> {
    return this.fetch<{ url: string }>(`/tasks/${taskId}/terminal`, {
      method: 'POST',
    });
  }
}

export const api = new ApiService();