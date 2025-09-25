/**
 * DataAdapter - Centralized data transformation layer
 * 
 * Deep module design: Simple 2-method interface hiding complex transformations.
 * Services don't need to know about backend data formats or field mappings.
 * 
 * Transforms:
 * - snake_case to camelCase
 * - Backend field names to frontend field names
 * - Type conversions and defaults
 */

import type { Project } from '../types/project';
import type { Task, TaskState, TerminalSession } from '@shared/types';
import type { CommitHistory } from './interfaces/task.service.interface';

type TransformType = 'project' | 'task' | 'commit' | 'branch';

export class DataAdapter {
  /**
   * Transform any backend response to the appropriate frontend type
   * @param type - The type of data to transform
   * @param data - The backend response data
   * @returns The transformed frontend type
   */
  static transform<T>(type: TransformType, data: any): T {
    if (!data) {
      throw new Error(`Invalid ${type} response: null or undefined`);
    }

    switch (type) {
      case 'project':
        return this.transformProject(data) as T;
      case 'task':
        return this.transformTask(data) as T;
      case 'commit':
        return this.transformCommit(data) as T;
      case 'branch':
        // Branch is special - expects array input, returns string array
        return this.transformBranches(data) as T;
      default:
        throw new Error(`Unknown transform type: ${type}`);
    }
  }

  /**
   * Transform an array of backend responses
   * @param type - The type of data to transform
   * @param data - Array of backend response data
   * @returns Array of transformed frontend types
   */
  static transformList<T>(type: TransformType, data: any[]): T[] {
    if (!Array.isArray(data)) {
      return [];
    }
    
    // Branch transformation already handles arrays internally
    if (type === 'branch') {
      return [this.transform<T>(type, data)];
    }
    
    return data.map(item => this.transform<T>(type, item));
  }

  // ============================================================================
  // Private implementation - Complex transformations hidden behind simple interface
  // ============================================================================

  private static transformProject(backendProject: any): Project {
    if (typeof backendProject !== 'object') {
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

  private static transformTask(backendTask: any): Task {
    if (typeof backendTask !== 'object') {
      throw new Error('Invalid task response format');
    }

    // Transform terminals from snake_case to camelCase
    const terminals = Array.isArray(backendTask.terminals) 
      ? backendTask.terminals.map(t => this.transformTerminal(t))
      : [];

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

  private static transformTerminal(backendTerminal: any): any {
    if (typeof backendTerminal !== 'object') {
      throw new Error('Invalid terminal response format');
    }

    // Return with both the standard interface fields and legacy fields for SessionAdapter
    return {
      // Standard TerminalSession interface
      id: String(backendTerminal.id || ''),
      taskId: String(backendTerminal.task_id || ''),
      shelltenderId: String(backendTerminal.shelltender_session_id || ''),
      tabName: String(backendTerminal.tab_name || 'Main'),
      tabOrder: Number(backendTerminal.tab_order || 0),
      aiState: backendTerminal.ai_state || 'not-started',
      aiAgent: backendTerminal.ai_agent || 'claude',
      createdAt: String(backendTerminal.created_at || new Date().toISOString()),
      updatedAt: String(backendTerminal.last_activity || new Date().toISOString()),
      lastActivityAt: String(backendTerminal.last_activity || new Date().toISOString()),
      
      // Legacy fields needed by SessionAdapter
      dbSessionId: String(backendTerminal.id || ''),
      sessionId: String(backendTerminal.session_id || ''),
      shelltenderSessionId: String(backendTerminal.shelltender_session_id || ''),
      
      // Extra fields not in the interface but potentially used
      isActive: Boolean(backendTerminal.is_active),
      messageCount: Number(backendTerminal.message_count || 0),
      sizeBytes: Number(backendTerminal.size_bytes || 0),
      tokenUsage: backendTerminal.token_usage || {},
      toolUsage: backendTerminal.tool_usage || {},
      model: backendTerminal.model,
      errorCount: Number(backendTerminal.error_count || 0),
      metadata: backendTerminal.metadata || {}
    };
  }

  private static transformCommit(backendCommit: any): CommitHistory {
    if (typeof backendCommit !== 'object') {
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

  private static transformBranches(backendBranches: any): string[] {
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
}