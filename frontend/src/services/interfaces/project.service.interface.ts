import type { Project } from '../../types/project';

/**
 * ProjectService Interface - Project management
 * 
 * Handles project-level operations including CRUD, branches, and planning.
 * This service manages the overall project lifecycle.
 */

export interface CreateProjectData {
  repoUrl: string;
  branch: string;
  projectName: string;
}

export interface ProjectPlanning {
  exists: boolean;
  content: string | null;
}

export interface ProjectDashboard {
  project: Project;
  needsAttention: Array<{
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    details: any;
    actions: string[];
  }>;
  tasksCount: number;
  activeTasks: number;
  cached?: boolean;
  lastUpdated?: string;
}

export interface GitOperationResult {
  success: boolean;
  message: string;
}

export interface IProjectService {
  /**
   * Get all projects
   * @returns Promise<Project[]> List of all projects
   */
  getProjects(): Promise<Project[]>;

  /**
   * Get project by ID with options
   * @param projectId Project identifier
   * @param options Fetch options
   * @returns Promise<Project> Project details
   */
  getProject(projectId: string, options?: { minimal?: boolean }): Promise<Project>;

  /**
   * Create a new project
   * @param data Project creation data
   * @returns Promise<Project> Created project
   */
  createProject(data: CreateProjectData): Promise<Project>;

  /**
   * Get project dashboard with optional caching
   * @param projectId Project identifier
   * @param options Dashboard options
   * @returns Promise<ProjectDashboard> Dashboard data
   */
  getProjectDashboard(projectId: string, options?: { cached?: boolean }): Promise<ProjectDashboard>;

  /**
   * Get project planning document
   * @param projectId Project identifier
   * @returns Promise<ProjectPlanning> Planning document status and content
   */
  getProjectPlanning(projectId: string): Promise<ProjectPlanning>;

  /**
   * Update project planning document
   * @param projectId Project identifier
   * @param content Planning document content
   * @returns Promise<GitOperationResult> Update result
   */
  updateProjectPlanning(projectId: string, content: string): Promise<GitOperationResult & { needsPush?: boolean }>;

  /**
   * Get project branches
   * @param projectId Project identifier
   * @returns Promise<string[]> List of branch names
   */
  getProjectBranches(projectId: string): Promise<string[]>;

  /**
   * Perform base branch operations
   * @param projectId Project identifier
   * @param operation Operation type
   * @returns Promise<GitOperationResult> Operation result
   */
  baseBranchOperation(projectId: string, operation: 'pull' | 'push' | 'refresh'): Promise<GitOperationResult>;
}