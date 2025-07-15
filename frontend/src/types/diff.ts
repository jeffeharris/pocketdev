// Types for the enhanced Git Diff Viewer

export enum FileStatus {
  Staged = 'staged',
  Unstaged = 'unstaged',
  Untracked = 'untracked',
  Committed = 'committed'
}

export enum FileChangeType {
  Added = 'added',
  Modified = 'modified',
  Deleted = 'deleted',
  Renamed = 'renamed'
}

// Color palette for file status indicators
export const FILE_STATUS_COLORS = {
  [FileStatus.Staged]: 'text-green-600',
  [FileStatus.Unstaged]: 'text-orange-600',
  [FileStatus.Untracked]: 'text-gray-500',
  [FileStatus.Committed]: 'text-blue-600'
} as const;

// Background colors for badges
export const FILE_STATUS_BG_COLORS = {
  [FileStatus.Staged]: 'bg-green-100',
  [FileStatus.Unstaged]: 'bg-orange-100',
  [FileStatus.Untracked]: 'bg-gray-100',
  [FileStatus.Committed]: 'bg-blue-100'
} as const;

// Labels for status badges
export const FILE_STATUS_LABELS = {
  [FileStatus.Staged]: 'S',
  [FileStatus.Unstaged]: 'M',
  [FileStatus.Untracked]: 'U',
  [FileStatus.Committed]: 'C'
} as const;

export interface DiffFile {
  path: string;
  type: FileChangeType;
  additions: number;
  deletions: number;
  status?: FileStatus;
  category?: FileStatus; // Backend compatibility
  diff?: string;
  loading?: boolean;
  // Boolean flags for backward compatibility and multiple states
  staged?: boolean;
  unstaged?: boolean;
  untracked?: boolean;
  committed?: boolean;
}

export interface AllChangesResponse {
  files: DiffFile[];
  summary: {
    staged: number;
    unstaged: number;
    untracked: number;
    committed: number;
    total: number;
    unpushedCommits: number;
  };
  unpushedCommits: Array<{
    hash: string;
    message: string;
  }>;
}

export interface DiffViewerResponse {
  files: DiffFile[];
  compareWith: string;
  hasWorkingChanges: boolean;
}

export interface FileDiffResponse {
  path: string;
  diff: string;
  hasDiff: boolean;
}

// View modes for the diff viewer
export enum DiffViewMode {
  Working = 'working',
  AllChanges = 'all',
  Base = 'base'
}

// Helper type for view mode configuration
export interface ViewModeConfig {
  mode: DiffViewMode;
  label: string;
  icon?: string;
  tooltip: string;
  gitCommand?: string;
}