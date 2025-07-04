/**
 * WorkerStatus represents the current state of an AI worker session.
 * These values MUST match the backend AI state constants exactly.
 * 
 * State meanings:
 * - NotStarted: No AI session active, user is at bash prompt (gray)
 * - Idle: AI session is active and ready for commands (blue)
 * - Working: AI is actively thinking/processing (yellow)
 * - Waiting: AI needs user input or confirmation (purple)
 * 
 * State flow: NotStarted -> Idle <-> Working <-> Waiting -> NotStarted
 */
export enum WorkerStatus {
  NotStarted = 'not-started',
  Idle = 'idle',
  Working = 'working',
  Waiting = 'waiting'
}

export enum TaskState {
  Active = 'active',
  Merged = 'merged',
  Archived = 'archived'
}

export type TaskPhase = 'generate' | 'validate' | 'merge';

export interface SessionState {
  status: WorkerStatus;
  lastStateChange: string | null;
}

export interface GitStatus {
  ahead: number;
  behind: number;
  hasConflicts: boolean;
  staged?: number;
  unstaged?: number;
  untracked?: number;
}

export interface Task {
  id: string;
  name: string;
  description: string;
  branch: string;
  worktree_path: string;
  created_at: string;  // 'created' in frontend
  
  // Task lifecycle state
  taskState: TaskState;
  
  // AI session state
  sessionState: SessionState;
  
  // Git status (optional, added by frontend)
  gitStatus?: GitStatus;
  
  // Container/validation fields (optional)
  containerId?: string;
  validationStatus?: string;
  previewUrl?: string;
  prUrl?: string;
  
  // Backend fields we might need
  project_id?: string;
  is_archived?: boolean;
  merged_at?: string;
  has_uncommitted_changes?: boolean;
}

export interface ExtendedTask extends Task {
  filesChanged?: number;
  additions?: number;
  deletions?: number;
}

export interface CreateTaskDTO {
  name: string;
  description: string;
  branch: string;
  branchPrefix?: 'feat/' | 'fix/' | 'chore/' | '';
  projectId: string;
  useExistingBranch?: boolean;
}