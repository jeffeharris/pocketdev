import type { Task, CreateTaskDTO } from '../types/task';
import type { GitStatus, ChangedFile, PullRequest } from '../types/git';
import type { DeploymentResult } from '../types/container';
import type { Project } from '../types/project';
import type { Settings, UpdateSettingsDTO, GithubTestResult } from '../api/settings';
import type { AllChangesResponse, DiffViewerResponse, FileDiffResponse } from '../types/diff';
import { mockProjects } from './mockData';
import { SettingsService } from './settings.service';
import { UploadService } from './upload.service';
import { GitService } from './git.service';
import { TerminalService } from './terminal.service';
import { ContainerService } from './container.service';
import { PullRequestService } from './pull-request.service';
import { ProjectService } from './project.service';
import { TaskService } from './task.service';

const API_BASE = '/api';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

// Create service instances for delegation
const settingsService = new SettingsService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

const uploadService = new UploadService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

const gitService = new GitService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

const terminalService = new TerminalService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

const containerService = new ContainerService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

const pullRequestService = new PullRequestService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

const projectService = new ProjectService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

const taskService = new TaskService({ 
  baseUrl: API_BASE, 
  mockEnabled: USE_MOCKS 
});

class ApiService {
  private async fetch<T>(url: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      // Try to parse JSON error response
      try {
        const errorData = await response.json();
        const error = new Error(errorData.error || `API Error: ${response.statusText}`);
        // Attach the full error data to the error object
        (error as any).response = errorData;
        (error as any).status = response.status;
        throw error;
      } catch (parseError) {
        // If JSON parsing fails, throw generic error
        throw new Error(`API Error: ${response.statusText}`);
      }
    }

    return response.json();
  }

  // Project endpoints
  async getProjectMinimal(id: string): Promise<Project> {
    // Delegated to ProjectService
    return projectService.getProject(id, { minimal: true });
  }

  async getProjects(): Promise<Project[]> {
    // Delegated to ProjectService
    return projectService.getProjects();
  }

  async getProject(id: string): Promise<Project> {
    // Delegated to ProjectService
    return projectService.getProject(id);
  }

  async createProject(data: { repoUrl: string; branch: string; projectName: string }): Promise<Project> {
    // Delegated to ProjectService
    return projectService.createProject(data);
  }

  async getProjectBranches(projectId: string): Promise<string[]> {
    // Delegated to ProjectService
    return projectService.getProjectBranches(projectId);
  }

  async getProjectPlanning(projectId: string): Promise<{ exists: boolean; content: string | null }> {
    // Delegated to ProjectService
    return projectService.getProjectPlanning(projectId);
  }

  async updateProjectPlanning(projectId: string, content: string): Promise<{ success: boolean; message: string; needsPush?: boolean }> {
    // Delegated to ProjectService
    return projectService.updateProjectPlanning(projectId, content);
  }

  async getProjectDashboard(projectId: string): Promise<{
    project: any;
    needsAttention: Array<{
      type: string;
      severity: 'error' | 'warning' | 'info';
      message: string;
      details: any;
      actions: string[];
    }>;
    tasksCount: number;
    activeTasks: number;
  }> {
    // Delegated to ProjectService
    return projectService.getProjectDashboard(projectId);
  }

  async pullBaseBranch(projectId: string): Promise<{ success: boolean; message: string }> {
    // Delegated to ProjectService
    return projectService.baseBranchOperation(projectId, 'pull');
  }

  async pushBaseBranch(projectId: string): Promise<{ success: boolean; message: string }> {
    // Delegated to ProjectService
    return projectService.baseBranchOperation(projectId, 'push');
  }

  async getTasksMinimal(projectId: string): Promise<Task[]> {
    // Delegated to TaskService
    return taskService.getTasks(projectId, { minimal: true });
  }

  async getProjectDashboardCached(projectId: string): Promise<any> {
    // Delegated to ProjectService
    return projectService.getProjectDashboard(projectId, { cached: true });
  }

  async refreshProjectStatus(projectId: string): Promise<{ success: boolean; message: string }> {
    // Delegated to ProjectService
    return projectService.baseBranchOperation(projectId, 'refresh');
  }

  // Task endpoints
  async getTasks(projectId: string): Promise<Task[]> {
    // Delegated to TaskService
    return taskService.getTasks(projectId);
  }

  async getTask(projectId: string, taskId: string): Promise<Task> {
    // Delegated to TaskService
    return taskService.getTask(projectId, taskId);
  }

  async createTask(projectId: string, task: CreateTaskDTO): Promise<Task> {
    // Delegated to TaskService
    return taskService.createTask(projectId, task);
  }

  async updateTask(projectId: string, taskId: string, updates: { name?: string; description?: string }): Promise<Task> {
    // Delegated to TaskService
    return taskService.updateTask(projectId, taskId, updates);
  }

  async archiveTask(projectId: string, taskId: string): Promise<void> {
    // Delegated to TaskService
    return taskService.archiveTask(projectId, taskId);
  }

  async getCommitHistory(projectId: string, taskId: string): Promise<any[]> {
    // Delegated to TaskService
    return taskService.getCommitHistory(projectId, taskId);
  }

  // Git endpoints
  async getGitStatus(projectId: string, taskId: string): Promise<GitStatus> {
    // Delegated to GitService
    return gitService.getGitStatus(projectId, taskId);
  }

  async getChangedFiles(projectId: string, taskId: string): Promise<ChangedFile[]> {
    // Delegated to GitService - use getAllChanges and extract files
    const allChanges = await gitService.getAllChanges(projectId, taskId);
    // Map DiffFile format to ChangedFile format
    return allChanges.files.map(file => ({
      name: file.path,
      additions: file.additions,
      deletions: file.deletions,
      type: file.type
    }));
  }

  async getAllChanges(projectId: string, taskId: string): Promise<AllChangesResponse> {
    // Delegated to GitService
    return gitService.getAllChanges(projectId, taskId);
  }

  async getTaskDiff(projectId: string, taskId: string, compareWith: 'working' | 'base' = 'working'): Promise<DiffViewerResponse> {
    // Delegated to GitService
    return gitService.getTaskDiff(projectId, taskId, { compareWith });
  }

  async getFileDiff(projectId: string, taskId: string, filePath: string, compareWith: 'working' | 'base' | 'all' = 'working'): Promise<FileDiffResponse> {
    // Delegated to GitService
    return gitService.getFileDiff(projectId, taskId, filePath, { compareWith });
  }

  async checkConflicts(taskId: string): Promise<boolean> {
    // Delegated to PullRequestService
    return pullRequestService.checkConflicts(taskId);
  }

  async createPR(taskId: string, description: string): Promise<PullRequest> {
    // Delegated to PullRequestService
    return pullRequestService.createPR(taskId, description);
  }

  // Container endpoints
  async deployContainers(taskId: string): Promise<DeploymentResult> {
    // Delegated to ContainerService
    return containerService.deployContainers(taskId);
  }

  async stopContainers(taskId: string): Promise<void> {
    // Delegated to ContainerService
    return containerService.stopContainers(taskId);
  }

  // Git operations
  async gitOperation(projectId: string, taskId: string, operation: string, options?: {
    message?: string;
    files?: string | string[];
    args?: string;
  }): Promise<{ success: boolean; output: string; error?: string }> {
    // Delegated to GitService
    return gitService.performOperation(projectId, taskId, operation, options);
  }

  async stageFile(projectId: string, taskId: string, filePath: string): Promise<{ success: boolean; output: string; error?: string }> {
    // Delegated to GitService
    return gitService.performOperation(projectId, taskId, 'add', { files: filePath });
  }

  async unstageFile(projectId: string, taskId: string, filePath: string): Promise<{ success: boolean; output: string; error?: string }> {
    // Delegated to GitService
    return gitService.performOperation(projectId, taskId, 'unstage', { files: filePath });
  }

  async stageAndCommit(projectId: string, taskId: string, message: string, files?: string | string[]): Promise<{ success: boolean; output: string; error?: string }> {
    // Delegated to GitService
    return gitService.stageAndCommit(projectId, taskId, message, { files });
  }

  async updateBranch(projectId: string, taskId: string): Promise<{ success: boolean; output: string; error?: string }> {
    // Delegated to TaskService
    return taskService.updateBranch(projectId, taskId);
  }

  async mergeToBase(projectId: string, taskId: string): Promise<{ success: boolean; output: string; error?: string }> {
    // Delegated to TaskService
    return taskService.mergeToBase(projectId, taskId);
  }

  async getContainerLogs(taskId: string): Promise<string[]> {
    // Delegated to ContainerService
    return containerService.getContainerLogs(taskId);
  }

  // Terminal endpoint
  async openTerminal(taskId: string): Promise<{ url: string }> {
    // Delegated to TerminalService
    return terminalService.openTerminal(taskId);
  }

  // Settings endpoints
  async getSettings(): Promise<Settings> {
    // Delegated to SettingsService
    return settingsService.getSettings();
  }

  async updateSettings(settings: UpdateSettingsDTO): Promise<any> {
    // Delegated to SettingsService
    return settingsService.updateSettings(settings);
  }

  async testGithubToken(): Promise<GithubTestResult> {
    // Delegated to SettingsService
    return settingsService.testGithubToken();
  }

  async getSystemInfo(): Promise<any> {
    // Delegated to SettingsService
    return settingsService.getSystemInfo();
  }

  // Image upload endpoints
  async getTaskImages(projectId: string, taskId: string): Promise<{ images: Array<{
    filename: string;
    size: number;
    sizeFormatted: string;
    referencePath: string;
    url?: string;
  }> }> {
    // Delegated to UploadService
    const images = await uploadService.getTaskImages(projectId, taskId);
    return { images };
  }

  async uploadTaskImage(projectId: string, taskId: string, formData: FormData): Promise<any> {
    // Delegated to UploadService
    return uploadService.uploadTaskImage(projectId, taskId, formData);
  }

  async deleteTaskImage(projectId: string, taskId: string, filename: string): Promise<void> {
    // Delegated to UploadService
    return uploadService.deleteTaskImage(projectId, taskId, filename);
  }

  // Terminal session endpoints
  async getTerminalSessions(taskId: string): Promise<any[]> {
    // Delegated to TerminalService
    return terminalService.getTerminalSessions(taskId);
  }

  async createTerminalSession(taskId: string, options: {
    tabName?: string;
    aiAgent?: string;
    workingDirectory?: string;
    initialPrompt?: string;
    copyHistoryFrom?: string | null;
  }): Promise<any> {
    // Delegated to TerminalService
    return terminalService.createTerminalSession(taskId, options);
  }

  async updateTerminalTab(sessionId: string, updates: {
    tabName?: string;
    tabOrder?: number;
  }): Promise<any> {
    // Delegated to TerminalService
    return terminalService.updateTerminalTab(sessionId, updates);
  }

  async deleteTerminalSession(sessionId: string): Promise<void> {
    // Delegated to TerminalService
    return terminalService.deleteTerminalSession(sessionId);
  }

  async executeCommand(sessionId: string, command: string): Promise<void> {
    // Delegated to TerminalService
    return terminalService.executeCommand(sessionId, command);
  }
}

export const api = new ApiService();

// Export settings API for convenience (delegated to SettingsService)
export const settingsApi = {
  getSettings: () => api.getSettings(),
  updateSettings: (settings: UpdateSettingsDTO) => api.updateSettings(settings),
  testGithubToken: () => api.testGithubToken(),
  getSystemInfo: () => api.getSystemInfo()
};