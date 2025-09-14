/**
 * Task type definitions - Clean re-export from shared types
 * All types are now in /shared/types for consistency
 */

// Re-export everything from shared types
export * from '../../../shared/types/index';

// Frontend-specific extension (the only addition)
import { Task } from '../../../shared/types/index';

export interface TaskWithUIState extends Task {
  // UI-specific callback
  onReload?: () => void;
  
  // UI state flags
  isLoading?: boolean;
  isSelected?: boolean;
}