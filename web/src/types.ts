export type EngineerStatus = 'idle' | 'thinking' | 'coding' | 'testing' | 'complete' | 'error' | 'busy' | 'running';
export type EngineerRole = 'frontend' | 'backend' | 'devops' | 'fullstack' | 'qa_manual';

export interface Engineer {
  id: string;
  name: string;
  role: EngineerRole;
  status: EngineerStatus;
  current_task?: string;
  progress?: number;
  assistant_id?: string;
  last_update: string;
  created_at: string;
  // Container-specific fields
  systemPrompt?: string;
  totalTasks?: number;
  successfulTasks?: number;
  averageDurationMs?: number | null;
  averageTurns?: number | null;
  totalCostUsd?: number;
  taskHistory?: Array<{
    taskId: string;
    startTime: string;
    endTime?: string;
    status: string;
    success: boolean;
    cost: number;
  }>;
  currentTaskDetails?: {
    id: string;
    description: string;
    repository: string;
    startTime: string;
  };
}

export interface Task {
  id: string;
  description: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  output?: string;
  created_at: string;
  completed_at?: string;
}

export interface TaskAssignment {
  engineerId: string;
  task: string;
  mode: 'non-interactive' | 'interactive' | 'streaming' | 'simulated';
  allowedTools?: string[];
}