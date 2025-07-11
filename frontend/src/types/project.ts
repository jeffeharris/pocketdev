export interface Project {
  id: string;
  name: string;
  repository: string;
  baseBranch: string;
  created: string;
  tasksCount?: number;
}