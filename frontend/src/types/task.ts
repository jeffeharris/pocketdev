/**
 * Task type definitions - Clean re-export from shared types
 * All types are now in /shared/types for consistency
 */

// Re-export types explicitly using type-only exports (required by Vite)
export type {
  // Interfaces
  Project,
  Task,
  TerminalSession,
  GitStatus,
  SessionState,
  APIResponse,
  ErrorResponse,
  CreateProjectDTO,
  CreateTaskDTO,
  CreateTerminalSessionDTO,
  UpdateTaskDTO,
  SplitViewLayout,
  TaskWithStats,
  // Type aliases
  WorkerStatus as WorkerStatusType,
  TaskState as TaskStateType,
  AIAgent as AIAgentType
} from '@shared/types';

// Re-export runtime values (constants and functions)
export {
  // Constants
  WorkerStatus,
  TaskState,
  AIAgent,
  // Functions
  isWorkerStatus,
  isTaskState,
  isAIAgent
} from '@shared/types';

// Frontend-specific extension (the only addition)
import type { Task } from '@shared/types';

export interface TaskWithUIState extends Task {
  // UI-specific callback
  onReload?: () => void;
  
  // UI state flags
  isLoading?: boolean;
  isSelected?: boolean;
}