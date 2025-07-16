// Types for the enhanced Git Diff Viewer

export const FileCategory = {
  Staged: 'staged',
  Unstaged: 'unstaged',
  Untracked: 'untracked',
  Committed: 'committed'
} as const;

export type FileCategory = typeof FileCategory[keyof typeof FileCategory];

export const FileChangeType = {
  Added: 'added',
  Modified: 'modified',
  Deleted: 'deleted',
  Renamed: 'renamed'
} as const;

export type FileChangeType = typeof FileChangeType[keyof typeof FileChangeType];

// Color palette for file status indicators
export const FILE_STATUS_COLORS = {
  [FileCategory.Staged]: 'text-green-600',
  [FileCategory.Unstaged]: 'text-orange-600',
  [FileCategory.Untracked]: 'text-gray-500',
  [FileCategory.Committed]: 'text-blue-600'
} as const;

// Background colors for badges
export const FILE_STATUS_BG_COLORS = {
  [FileCategory.Staged]: 'bg-green-100',
  [FileCategory.Unstaged]: 'bg-orange-100',
  [FileCategory.Untracked]: 'bg-gray-100',
  [FileCategory.Committed]: 'bg-blue-100'
} as const;

// Labels for status badges
export const FILE_STATUS_LABELS = {
  [FileCategory.Staged]: 'S',
  [FileCategory.Unstaged]: 'M',
  [FileCategory.Untracked]: 'U',
  [FileCategory.Committed]: 'C'
} as const;

export interface DiffFile {
  path: string;
  type: FileChangeType;
  additions: number;
  deletions: number;
  status?: string; // Git status code like 'A ', ' M', '??'
  category?: FileCategory; // Backend compatibility - 'staged', 'unstaged', etc.
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
export const DiffViewMode = {
  Working: 'working',
  AllChanges: 'all',
  Base: 'base'
} as const;

export type DiffViewMode = typeof DiffViewMode[keyof typeof DiffViewMode];

// Helper type for view mode configuration
export interface ViewModeConfig {
  mode: DiffViewMode;
  label: string;
  icon?: string;
  tooltip: string;
  gitCommand?: string;
}