/**
 * TaskService - Task management operations
 * 
 * This service handles all task-level operations including CRUD operations,
 * lifecycle management, git operations, and state tracking. Despite managing
 * complex task workflows, it maintains the deep module principle by providing
 * a simple interface that hides task management complexity.
 * 
 * Dependencies: None (leaf service)
 */

import { BaseService } from './base.service';
import type { 
  ITaskService, 
  TaskListOptions, 
  TaskUpdateData, 
  CommitHistory, 
  GitOperationResult 
} from './interfaces/task.service.interface';
import type { Task, CreateTaskDTO, TaskState } from '../types/task';
import { sessionAdapter } from './session-adapter';

export class TaskService extends BaseService implements ITaskService {
  private mockTasks: Task[] = [
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

  private mockCommitHistory: CommitHistory[] = [
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

  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
    
    if (this.isMockEnabled) {
      this.initializeMockData();
    }
  }

  // Public interface - 8 methods for comprehensive task management

  async getTasks(projectId: string, options?: TaskListOptions): Promise<Task[]> {
    if (this.isMockEnabled) {
      const projectTasks = this.mockTasks.filter(t => 
        t.id.startsWith(projectId.slice(0, 8))
      );
      
      if (options?.minimal) {
        // Return minimal task data - no git status or terminals
        return projectTasks.map(task => ({
          id: task.id,
          name: task.name,
          description: '',
          branch: task.branch,
          worktree_path: task.worktree_path,
          created_at: task.created_at,
          taskState: task.taskState,
          sessionState: task.sessionState
        }));
      }
      
      return [...projectTasks];
    }
    
    const endpoint = options?.minimal 
      ? `/projects/${projectId}/tasks/minimal`
      : `/projects/${projectId}/tasks`;
      
    const response = await this.get<unknown[]>(endpoint);
    
    // Map backend format to our Task type
    return response.map(t => this.mapBackendTaskResponse(t));
  }

  async getTask(projectId: string, taskId: string): Promise<Task> {
    if (this.isMockEnabled) {
      const task = this.mockTasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }
      return { ...task };
    }
    
    const response = await this.get<unknown>(`/projects/${projectId}/tasks/${taskId}`);
    
    return this.mapBackendTaskResponse(response);
  }

  async createTask(projectId: string, taskData: CreateTaskDTO): Promise<Task> {
    if (this.isMockEnabled) {
      const branch = taskData.useExistingBranch 
        ? taskData.branch 
        : (taskData.branchPrefix ? `${taskData.branchPrefix}${taskData.branch}` : taskData.branch);
      
      const newTask: Task = {
        id: `${projectId.slice(0, 8)}${Math.random().toString(36).substr(2, 3)}`,
        name: taskData.name,
        description: taskData.description,
        branch: branch,
        worktree_path: `/projects/${projectId}-task-${Date.now()}`,
        created_at: new Date().toISOString(),
        taskState: 'active' as TaskState,
        sessionState: {
          status: 'not-started' as const,
          lastStateChange: null
        },
        terminals: []
      };
      
      this.mockTasks.push(newTask);
      return { ...newTask };
    }
    
    const response = await this.post<unknown>(`/projects/${projectId}/tasks`, taskData);
    
    return this.mapBackendTaskResponse(response);
  }

  async updateTask(projectId: string, taskId: string, updates: TaskUpdateData): Promise<Task> {
    if (this.isMockEnabled) {
      const taskIndex = this.mockTasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        this.mockTasks[taskIndex] = { 
          ...this.mockTasks[taskIndex], 
          ...updates 
        };
        return { ...this.mockTasks[taskIndex] };
      }
      throw new Error('Task not found');
    }
    
    const response = await this.patch<unknown>(`/projects/${projectId}/tasks/${taskId}`, updates);
    
    return this.mapBackendTaskResponse(response);
  }

  async archiveTask(projectId: string, taskId: string): Promise<void> {
    if (this.isMockEnabled) {
      const taskIndex = this.mockTasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        this.mockTasks[taskIndex].taskState = 'archived' as TaskState;
      }
      return;
    }
    
    await this.post<void>(`/projects/${projectId}/tasks/${taskId}/archive`);
  }

  async getCommitHistory(projectId: string, taskId: string): Promise<CommitHistory[]> {
    if (this.isMockEnabled) {
      return [...this.mockCommitHistory];
    }
    
    const response = await this.get<unknown[]>(`/projects/${projectId}/tasks/${taskId}/commits`);
    
    // Map backend format to our CommitHistory type
    return response.map(commit => this.mapBackendCommitResponse(commit));
  }

  async updateBranch(projectId: string, taskId: string): Promise<GitOperationResult> {
    if (this.isMockEnabled) {
      return { 
        success: true, 
        output: 'Mock update successful - merged 3 commits from main',
        error: undefined 
      };
    }
    
    const response = await this.post<GitOperationResult>(`/projects/${projectId}/tasks/${taskId}/update`);
    
    return {
      success: response.success,
      output: response.output,
      error: response.error
    };
  }

  async mergeToBase(projectId: string, taskId: string): Promise<GitOperationResult> {
    if (this.isMockEnabled) {
      return { 
        success: true, 
        output: 'Mock merge successful - task merged to main branch',
        error: undefined 
      };
    }
    
    const response = await this.post<GitOperationResult>(`/projects/${projectId}/tasks/${taskId}/merge-to-base`);
    
    return {
      success: response.success,
      output: response.output,
      error: response.error
    };
  }

  // Private helper methods

  protected initializeMockData(): void {
    // Mock data is initialized in constructor
    // This method can be used for any additional mock setup if needed
  }

  private findMockTask(taskId: string): Task {
    const task = this.mockTasks.find(t => t.id === taskId);
    if (!task) {
      throw new Error(`Task with ID ${taskId} not found`);
    }
    return task;
  }

  private validateTaskData(taskData: CreateTaskDTO): void {
    if (!taskData.name?.trim()) {
      throw new Error('Task name is required');
    }
    if (!taskData.branch?.trim()) {
      throw new Error('Branch name is required');
    }
    if (!taskData.projectId?.trim()) {
      throw new Error('Project ID is required');
    }
  }

  private mapBackendTaskResponse(response: unknown): Task {
    // Type guard: ensure response is an object
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid task response format');
    }
    
    const r = response as Record<string, unknown>;
    
    // Process and register terminals
    const terminals = Array.isArray(r.terminals) ? r.terminals : [];
    
    // Register each terminal with the session adapter
    terminals.forEach((terminal: any) => {
      sessionAdapter.registerSession(terminal);
    });
    
    return {
      id: String(r.id || ''),
      name: String(r.name || 'Untitled Task'),
      description: String(r.description || ''),
      branch: String(r.branch || ''),
      worktree_path: String(r.worktree_path || ''),
      created_at: String(r.created_at || new Date().toISOString()),
      taskState: (r.task_state || r.taskState || 'active') as TaskState,
      sessionState: (r.session_state || r.sessionState || {
        status: 'not-started',
        lastStateChange: null
      }) as Task['sessionState'],
      gitStatus: r.git_status || r.gitStatus,
      containerId: r.container_id || r.containerId,
      validationStatus: r.validation_status || r.validationStatus,
      previewUrl: r.preview_url || r.previewUrl,
      prUrl: r.pr_url || r.prUrl,
      project_id: r.project_id,
      is_archived: r.is_archived,
      merged_at: r.merged_at,
      has_uncommitted_changes: r.has_uncommitted_changes,
      terminals: terminals
    } as Task;
  }

  private mapBackendCommitResponse(response: unknown): CommitHistory {
    // Type guard: ensure response is an object
    if (!response || typeof response !== 'object') {
      throw new Error('Invalid commit response format');
    }
    
    const r = response as Record<string, unknown>;
    
    return {
      hash: String(r.hash || r.id || ''),
      message: String(r.message || ''),
      author: String(r.author || r.author_name || ''),
      date: String(r.date || r.committed_date || ''),
      isMerge: Boolean(r.is_merge || r.isMerge || false)
    };
  }
}