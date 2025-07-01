export type TaskStatus = 'idle' | 'user-request' | 'thinking' | 'working' | 'not-started';
export type TaskPhase = 'generate' | 'validate' | 'merge';

export interface Task {
  id: string;
  title: string;
  description: string;
  branch: string;
  status: TaskStatus;
  phase?: TaskPhase;
  engineer: string;
  worktree: string;
  created: string;
  duration: string;
  hasConflicts?: boolean;
  containerId?: string;
  validationStatus?: string;
  previewUrl?: string;
  prUrl?: string;
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