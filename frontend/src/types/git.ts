export interface GitStatus {
  clean: boolean;
  ahead: number;
  behind: number;
  filesChanged: number;
  branch: string;
  upToDate: boolean;
}

export interface ChangedFile {
  name: string;
  additions: number;
  deletions: number;
  type: 'added' | 'modified' | 'deleted';
}

export interface GitDiff {
  file: string;
  chunks: DiffChunk[];
}

export interface DiffChunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: 'add' | 'delete' | 'normal';
  content: string;
  lineNumber?: number;
}

export interface PullRequest {
  id: number;
  url: string;
  title: string;
  description: string;
  state: 'open' | 'closed' | 'merged';
  mergeable: boolean;
  conflicts: boolean;
}