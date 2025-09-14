/**
 * Task type definitions - Using shared types
 * This file re-exports and extends the shared type definitions
 */

// Import all shared types
export {
  // Enums and constants
  WorkerStatus,
  TaskState,
  AIAgent,
  
  // Core types
  type Task,
  type Project,
  type TerminalSession,
  type GitStatus,
  type SessionState,
  
  // DTOs
  type CreateTaskDTO,
  type UpdateTaskDTO,
  type CreateTerminalSessionDTO,
  
  // UI types
  type SplitViewLayout,
  type TaskWithStats,
  
  // Type guards
  isWorkerStatus,
  isTaskState,
  isAIAgent
} from '../../../shared/types/index';

// Re-export specific types for backward compatibility
export type { WorkerStatus as WorkerStatusType } from '../../../shared/types/index';
export type { TaskState as TaskStateType } from '../../../shared/types/index';

// Legacy types for backward compatibility (deprecated)
export type TaskPhase = 'generate' | 'validate' | 'merge';

/**
 * @deprecated Use SessionState from shared types
 */
export interface IndividualSessionState {
  id: string;
  shelltenderSessionId: string;
  tabName: string;
  aiState: WorkerStatus;
  lastStateChange?: string;
}

/**
 * Extended Task interface for UI-specific needs
 * @deprecated Use TaskWithStats from shared types
 */
export interface ExtendedTask extends Task {
  filesChanged?: number;
  additions?: number;
  deletions?: number;
}

// Frontend-specific extension (if needed)
export interface TaskWithUIState extends Task {
  // UI-specific callback
  onReload?: () => void;
  
  // UI state flags
  isLoading?: boolean;
  isSelected?: boolean;
}