/**
 * Shared Type Definitions
 * 
 * This is the single source of truth for all types shared between
 * frontend and backend. These TypeScript definitions can be:
 * - Imported directly in TypeScript files
 * - Referenced via JSDoc comments in JavaScript files
 * 
 * Following AI-assisted architecture principles:
 * - Single source of truth for types
 * - Consistent naming (camelCase everywhere)
 * - Clear, predictable structure
 */

// ========== ENUMS & CONSTANTS ==========

/**
 * Worker/AI session status
 */
export const WorkerStatus = {
  NotStarted: 'not-started',
  Idle: 'idle',
  Working: 'working',
  Waiting: 'waiting'
} as const;

export type WorkerStatus = typeof WorkerStatus[keyof typeof WorkerStatus];

/**
 * Task lifecycle state
 */
export const TaskState = {
  Active: 'active',
  Merged: 'merged',
  Archived: 'archived'
} as const;

export type TaskState = typeof TaskState[keyof typeof TaskState];

/**
 * AI Agent types
 */
export const AIAgent = {
  Claude: 'claude',
  Codex: 'codex',
  Gemini: 'gemini',
  Aider: 'aider'
} as const;

export type AIAgent = typeof AIAgent[keyof typeof AIAgent];

// ========== CORE DOMAIN TYPES ==========

/**
 * Project - A git repository being worked on
 */
export interface Project {
  id: string;
  name: string;
  repoUrl: string;
  baseBranch: string;
  localPath: string;
  createdAt: string;
  updatedAt: string;
  
  // Optional computed fields
  tasksCount?: number;
  activeTasks?: number;
}

/**
 * Task - A feature branch with its own worktree
 */
export interface Task {
  id: string;
  projectId: string;
  name: string;
  branch: string;
  worktreePath: string;
  state: TaskState;
  createdAt: string;
  updatedAt: string;
  
  // Git status
  hasUncommittedChanges?: boolean;
  hasConflicts?: boolean;
  aheadCount?: number;
  behindCount?: number;
  
  // Optional fields
  description?: string;
  mergedAt?: string;
  archivedAt?: string;
  prNumber?: number;
  prUrl?: string;
  
  // Computed/UI fields
  gitStatus?: GitStatus;
  sessionState?: SessionState;
  terminals?: TerminalSession[];
}

/**
 * Terminal Session - An AI developer session
 * NORMALIZED: Single ID system
 */
export interface TerminalSession {
  // Primary identifier (database ID)
  id: string;
  
  // Foreign keys
  taskId: string;
  
  // Shelltender integration (internal detail)
  shelltenderId: string;
  
  // UI properties
  tabName: string;
  tabOrder: number;
  
  // State
  aiState: WorkerStatus;
  aiAgent: AIAgent;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastActivityAt?: string;
  
  // Optional status from Shelltender
  shelltenderStatus?: 'active' | 'inactive' | 'not-found';
}

/**
 * Git Status - Simplified, consistent git status
 */
export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  hasChanges: boolean;
  hasConflicts: boolean;
  
  // File counts
  staged: number;
  unstaged: number;
  untracked: number;
  
  // Flags
  hasRemoteTracking: boolean;
  isClean: boolean;
  canMerge: boolean;
  canPush: boolean;
  
  // Recommended action for UI
  recommendedAction?: 'pull' | 'push' | 'commit' | 'merge' | 'resolve-conflicts' | null;
}

/**
 * Session State - Aggregated state for a task's sessions
 */
export interface SessionState {
  status: WorkerStatus;
  activeSessionCount: number;
  lastStateChange?: string;
}

// ========== API TYPES ==========

/**
 * Standard API Response wrapper
 */
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}

/**
 * Standard Error Response
 */
export interface ErrorResponse {
  error: string;
  correlationId?: string;
  statusCode?: number;
  details?: Record<string, any>;
}

// ========== DTOs (Data Transfer Objects) ==========

/**
 * Create Project DTO
 */
export interface CreateProjectDTO {
  repoUrl: string;
  projectName?: string;
  branch?: string;
}

/**
 * Create Task DTO
 */
export interface CreateTaskDTO {
  name: string;
  branch: string;
  description?: string;
  useExistingBranch?: boolean;
  createSession?: boolean;
}

/**
 * Create Terminal Session DTO
 */
export interface CreateTerminalSessionDTO {
  taskId: string;
  tabName?: string;
  aiAgent?: AIAgent;
}

/**
 * Update Task DTO
 */
export interface UpdateTaskDTO {
  name?: string;
  description?: string;
  state?: TaskState;
}

// ========== UI-SPECIFIC TYPES ==========

/**
 * Split View Layout Configuration
 */
export interface SplitViewLayout {
  mode: 'single' | 'split-2' | 'split-4';
  activeTerminalId?: string;
  terminalOrder?: string[];
}

/**
 * Extended Task with computed fields for UI
 */
export interface TaskWithStats extends Task {
  filesChanged?: number;
  additions?: number;
  deletions?: number;
  lastActivity?: string;
}

// ========== HELPER FUNCTIONS ==========

/**
 * Type guard for WorkerStatus
 */
export function isWorkerStatus(value: any): value is WorkerStatus {
  return Object.values(WorkerStatus).includes(value);
}

/**
 * Type guard for TaskState
 */
export function isTaskState(value: any): value is TaskState {
  return Object.values(TaskState).includes(value);
}

/**
 * Type guard for AIAgent
 */
export function isAIAgent(value: any): value is AIAgent {
  return Object.values(AIAgent).includes(value);
}