import type { Task, CreateTaskDTO } from '@shared/types';

/**
 * TaskService Interface - Task management
 * 
 * Handles task lifecycle, operations, and state management.
 * This service coordinates with other services for complete task functionality.
 */

export interface TaskListOptions {
  minimal?: boolean;
}

export interface TaskUpdateData {
  name?: string;
  description?: string;
}

export interface CommitHistory {
  hash: string;
  message: string;
  author: string;
  date: string;
  isMerge: boolean;
}

export interface GitOperationResult {
  success: boolean;
  output: string;
  error?: string;
}

export interface ITaskService {
  /**
   * Get tasks for a project
   * @param projectId Project identifier
   * @param options Fetch options
   * @returns Promise<Task[]> List of tasks
   */
  getTasks(projectId: string, options?: TaskListOptions): Promise<Task[]>;

  /**
   * Get specific task by ID
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<Task> Task details with terminals
   */
  getTask(projectId: string, taskId: string): Promise<Task>;

  /**
   * Create a new task
   * @param projectId Project identifier
   * @param taskData Task creation data
   * @returns Promise<Task> Created task
   */
  createTask(projectId: string, taskData: CreateTaskDTO): Promise<Task>;

  /**
   * Update task details
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @param updates Properties to update
   * @returns Promise<Task> Updated task
   */
  updateTask(projectId: string, taskId: string, updates: TaskUpdateData): Promise<Task>;

  /**
   * Archive a task
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<void>
   */
  archiveTask(projectId: string, taskId: string): Promise<void>;

  /**
   * Get commit history for task
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<CommitHistory[]> List of commits
   */
  getCommitHistory(projectId: string, taskId: string): Promise<CommitHistory[]>;

  /**
   * Update task branch from base
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<GitOperationResult> Update result
   */
  updateBranch(projectId: string, taskId: string): Promise<GitOperationResult>;

  /**
   * Merge task to base branch
   * @param projectId Project identifier
   * @param taskId Task identifier
   * @returns Promise<GitOperationResult> Merge result
   */
  mergeToBase(projectId: string, taskId: string): Promise<GitOperationResult>;
}