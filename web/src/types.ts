export type EngineerStatus = 'idle' | 'thinking' | 'coding' | 'testing' | 'complete' | 'error';
export type EngineerRole = 'frontend' | 'backend' | 'devops' | 'fullstack';

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