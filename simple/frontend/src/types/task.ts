export type TaskStatus = 'idle' | 'user-request' | 'thinking' | 'working' | 'not-started';
export type TaskPhase = 'generate' | 'validate' | 'merge';
export type TaskState = 'active' | 'merged' | 'archived';

export interface SessionState {
  status: TaskStatus;
  lastStateChange: string | null;
}

export interface GitStatus {
  ahead: number;
  behind: number;
  hasConflicts: boolean;
}

export interface Task {
  id: string;
  title: string;  // 'name' from backend
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
  title: string;
  description: string;
  branch: string;
  branchPrefix?: 'feature/' | 'fix/' | 'chore/';
  engineerId: string;
  projectId: string;
}