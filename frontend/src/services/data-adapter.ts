/**
 * DataAdapter - Centralized data transformation layer
 * 
 * Handles all backend-to-frontend data transformations in one place.
 * This follows the principle of information hiding - services shouldn't
 * need to know about backend data formats.
 * 
 * Transforms:
 * - snake_case to camelCase
 * - Backend field names to frontend field names
 * - Type conversions and defaults
 */

import type { Project } from '../types/project';
import type { Task, TaskState } from '../types/task';
import type { CommitHistory } from './interfaces/task.service.interface';
import { sessionAdapter } from './session-adapter';

export class DataAdapter {
  /**
   * Transform backend project response to frontend Project type
   */
  static transformProject(backendProject: any): Project {
    if (!backendProject || typeof backendProject !== 'object') {
      throw new Error('Invalid project response format');
    }

    return {
      id: String(backendProject.id || ''),
      name: String(backendProject.name || ''),
      repository: String(backendProject.repo_url || backendProject.repository || ''),
      baseBranch: String(backendProject.base_branch || backendProject.baseBranch || 'main'),
      created: String(backendProject.created_at || backendProject.created || new Date().toISOString()),
      tasksCount: Number(backendProject.task_count || backendProject.tasksCount || 0)
    };
  }

  /**
   * Transform array of backend projects
   */
  static transformProjects(backendProjects: any[]): Project[] {
    if (!Array.isArray(backendProjects)) {
      return [];
    }
    return backendProjects.map(p => this.transformProject(p));
  }

  /**
   * Transform backend task response to frontend Task type
   */
  static transformTask(backendTask: any): Task {
    if (!backendTask || typeof backendTask !== 'object') {
      throw new Error('Invalid task response format');
    }

    // Process and register terminals
    const terminals = Array.isArray(backendTask.terminals) ? backendTask.terminals : [];
    
    // Register each terminal with the session adapter
    terminals.forEach((terminal: any) => {
      sessionAdapter.registerSession(terminal);
    });

    return {
      id: String(backendTask.id || ''),
      name: String(backendTask.name || 'Untitled Task'),
      description: String(backendTask.description || ''),
      branch: String(backendTask.branch || ''),
      worktree_path: String(backendTask.worktree_path || ''),
      created_at: String(backendTask.created_at || new Date().toISOString()),
      taskState: (backendTask.task_state || backendTask.taskState || 'active') as TaskState,
      sessionState: (backendTask.session_state || backendTask.sessionState || {
        status: 'not-started',
        lastStateChange: null
      }) as Task['sessionState'],
      gitStatus: backendTask.git_status || backendTask.gitStatus,
      containerId: backendTask.container_id || backendTask.containerId,
      validationStatus: backendTask.validation_status || backendTask.validationStatus,
      previewUrl: backendTask.preview_url || backendTask.previewUrl,
      prUrl: backendTask.pr_url || backendTask.prUrl,
      project_id: backendTask.project_id,
      is_archived: backendTask.is_archived,
      merged_at: backendTask.merged_at,
      has_uncommitted_changes: backendTask.has_uncommitted_changes,
      terminals: terminals
    } as Task;
  }

  /**
   * Transform array of backend tasks
   */
  static transformTasks(backendTasks: any[]): Task[] {
    if (!Array.isArray(backendTasks)) {
      return [];
    }
    return backendTasks.map(t => this.transformTask(t));
  }

  /**
   * Transform backend commit response to frontend CommitHistory type
   */
  static transformCommit(backendCommit: any): CommitHistory {
    if (!backendCommit || typeof backendCommit !== 'object') {
      throw new Error('Invalid commit response format');
    }

    return {
      hash: String(backendCommit.hash || backendCommit.id || ''),
      message: String(backendCommit.message || ''),
      author: String(backendCommit.author || backendCommit.author_name || ''),
      date: String(backendCommit.date || backendCommit.committed_date || ''),
      isMerge: Boolean(backendCommit.is_merge || backendCommit.isMerge || false)
    };
  }

  /**
   * Transform array of backend commits
   */
  static transformCommits(backendCommits: any[]): CommitHistory[] {
    if (!Array.isArray(backendCommits)) {
      return [];
    }
    return backendCommits.map(c => this.transformCommit(c));
  }

  /**
   * Transform backend branch response
   * Branches come in various formats from the backend
   */
  static transformBranches(backendBranches: any[]): string[] {
    if (!Array.isArray(backendBranches)) {
      return [];
    }

    const branchMap = new Map<string, boolean>();
    
    backendBranches.forEach(branch => {
      if (typeof branch === 'string') {
        // Simple string format
        branchMap.set(branch, true);
      } else if (branch && typeof branch === 'object') {
        // Object format with name/isRemote/fullName
        if (!branch.isRemote) {
          branchMap.set(branch.name, true);
        } else if (!branch.name.includes('HEAD')) {
          const cleanName = branch.fullName?.replace(/^remotes\/origin\//, '') || branch.name;
          if (!branchMap.has(cleanName)) {
            branchMap.set(cleanName, false);
          }
        }
      }
    });

    return Array.from(branchMap.keys());
  }

  /**
   * Generic snake_case to camelCase converter for simple objects
   */
  static snakeToCamel(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj;
    if (Array.isArray(obj)) {
      return obj.map(item => this.snakeToCamel(item));
    }

    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        converted[camelKey] = this.snakeToCamel(obj[key]);
      }
    }
    return converted;
  }

  /**
   * Generic camelCase to snake_case converter for API requests
   */
  static camelToSnake(obj: any): any {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;
    if (obj instanceof Date) return obj.toISOString();
    if (Array.isArray(obj)) {
      return obj.map(item => this.camelToSnake(item));
    }

    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
        converted[snakeKey] = this.camelToSnake(obj[key]);
      }
    }
    return converted;
  }
}