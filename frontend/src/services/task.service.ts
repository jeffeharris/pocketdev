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
import { mockTasks, mockCommitHistory } from './mocks/task.mock';
import { DataAdapter } from './data-adapter';

export class TaskService extends BaseService implements ITaskService {
  constructor(config: { baseUrl?: string; mockEnabled?: boolean } = {}) {
    super(config);
  }

  // Public interface - 8 methods for comprehensive task management

  async getTasks(projectId: string, options?: TaskListOptions): Promise<Task[]> {
    if (this.isMockEnabled) {
      const projectTasks = mockTasks.filter(t => 
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
    return DataAdapter.transformList<Task>('task', response);
  }

  async getTask(projectId: string, taskId: string): Promise<Task> {
    if (this.isMockEnabled) {
      const task = mockTasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('Task not found');
      }
      return { ...task };
    }
    
    const response = await this.get<unknown>(`/projects/${projectId}/tasks/${taskId}`);
    const task = DataAdapter.transform<Task>('task', response);
    // Register terminals after transformation (side effect moved here)
    task.terminals?.forEach(terminal => sessionAdapter.registerSession(terminal));
    return task;
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
      
      mockTasks.push(newTask);
      return { ...newTask };
    }
    
    const response = await this.post<unknown>(`/projects/${projectId}/tasks`, taskData);
    const task = DataAdapter.transform<Task>('task', response);
    // Register terminals after transformation
    task.terminals?.forEach(terminal => sessionAdapter.registerSession(terminal));
    return task;
  }

  async updateTask(projectId: string, taskId: string, updates: TaskUpdateData): Promise<Task> {
    if (this.isMockEnabled) {
      const taskIndex = mockTasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        mockTasks[taskIndex] = { 
          ...mockTasks[taskIndex], 
          ...updates 
        };
        return { ...mockTasks[taskIndex] };
      }
      throw new Error('Task not found');
    }
    
    const response = await this.patch<unknown>(`/projects/${projectId}/tasks/${taskId}`, updates);
    const task = DataAdapter.transform<Task>('task', response);
    // Register terminals after transformation
    task.terminals?.forEach(terminal => sessionAdapter.registerSession(terminal));
    return task;
  }

  async archiveTask(projectId: string, taskId: string): Promise<void> {
    if (this.isMockEnabled) {
      const taskIndex = mockTasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        mockTasks[taskIndex].taskState = 'archived' as TaskState;
      }
      return;
    }
    
    // Use the existing DELETE endpoint with softDelete=true to archive
    await this.delete<void>(`/projects/${projectId}/tasks/${taskId}?softDelete=true`);
  }

  async getCommitHistory(projectId: string, taskId: string): Promise<CommitHistory[]> {
    if (this.isMockEnabled) {
      return [...mockCommitHistory];
    }
    
    const response = await this.get<unknown[]>(`/projects/${projectId}/tasks/${taskId}/commits`);
    return DataAdapter.transformList<CommitHistory>('commit', response);
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

  private findMockTask(taskId: string): Task {
    const task = mockTasks.find(t => t.id === taskId);
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

}