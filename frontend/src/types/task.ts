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
export const WorkerStatus = {
  NotStarted: 'not-started',
  Idle: 'idle',
  Working: 'working',
  Waiting: 'waiting'
} as const satisfies Record<string, string>;

export type WorkerStatus = typeof WorkerStatus[keyof typeof WorkerStatus];

export const TaskState = {
  Active: 'active',
  Merged: 'merged',
  Archived: 'archived'
} as const satisfies Record<string, string>;

export type TaskState = typeof TaskState[keyof typeof TaskState];

export type TaskPhase = 'generate' | 'validate' | 'merge';

export interface SessionState {
  status: WorkerStatus;
  lastStateChange: string | null;
}

export interface IndividualSessionState {
  id: string;
  shelltenderSessionId: string;
  tabName: string;
  aiState: WorkerStatus;
  lastStateChange?: string;
}

export interface GitStatus {
  ahead: number;
  behind: number;
  hasConflicts: boolean;
  staged?: number;
  unstaged?: number;
  untracked?: number;
  hasRemoteTracking?: boolean;
  unpushed?: number;
}

export interface TerminalSession {
  sessionId: string;           // Shelltender session ID (for backward compatibility)
  dbSessionId: string;         // Database session ID (stable identifier)
  shelltenderSessionId: string; // Shelltender session ID (explicit)
  normalizedId?: string;       // Normalized ID for consistent component tracking
  tabName: string;
  tabOrder: number;
  aiState: WorkerStatus;
  aiAgent: string;
  shelltenderStatus?: 'active' | 'inactive' | 'not-found';
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
  
  // AI session state (aggregated)
  sessionState: SessionState;
  
  // Individual session states (for multi-tab support)
  sessionStates?: IndividualSessionState[];
  
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
  
  // Terminal sessions (multiple tabs)
  terminals?: TerminalSession[];
  
  // Callback to reload task data (used by TerminalPanel)
  onReload?: () => void;
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