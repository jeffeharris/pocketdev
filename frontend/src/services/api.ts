import type { Task, CreateTaskDTO } from '../types/task';
import { TaskState, WorkerStatus } from '../types/task';
import type { GitStatus, ChangedFile, PullRequest } from '../types/git';
import type { DeploymentResult } from '../types/container';
import type { Project } from '../types/project';
import type { Settings, UpdateSettingsDTO, GithubTestResult } from '../api/settings';
import type { AllChangesResponse, DiffViewerResponse, FileDiffResponse } from '../types/diff';
import { mockTasks, mockProjects } from './mockData';
import { SettingsService } from './settings.service';
import { UploadService } from './upload.service';
import { GitService } from './git.service';
import { TerminalService } from './terminal.service';

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
    if (USE_MOCKS) {
      const project = mockProjects.find(p => p.id === id);
      if (!project) throw new Error('Project not found');
      return project;
    }
    const response = await this.fetch<any>(`/projects/${id}/minimal`);
    // Map backend format to our Project type
    return {
      id: response.id,
      name: response.name,
      repository: response.repository,
      baseBranch: response.baseBranch,
      created: response.created,
      tasksCount: 0
    };
  }

  async getProjects(): Promise<Project[]> {
    if (USE_MOCKS) return mockProjects;
    const response = await this.fetch<any[]>('/projects');
    // Map backend format to our Project type
    return response.map(p => ({
      id: p.id,
      name: p.name,
      repository: p.repo_url,
      baseBranch: p.base_branch,
      created: p.created_at,
      tasksCount: p.task_count || 0
    }));
  }

  async getProject(id: string): Promise<Project> {
    if (USE_MOCKS) {
      const project = mockProjects.find(p => p.id === id);
      if (!project) throw new Error('Project not found');
      return project;
    }
    const response = await this.fetch<any>(`/projects/${id}`);
    // Map backend format to our Project type
    return {
      id: response.id,
      name: response.name,
      repository: response.repo_url,
      baseBranch: response.base_branch,
      created: response.created_at,
      tasksCount: response.task_count || 0
    };
  }

  async createProject(data: { repoUrl: string; branch: string; projectName: string }): Promise<Project> {
    if (USE_MOCKS) {
      const newProject: Project = {
        id: `proj_${Date.now()}`,
        name: data.projectName,
        repository: data.repoUrl,
        baseBranch: data.branch,
        created: new Date().toISOString(),
        tasksCount: 0
      };
      mockProjects.push(newProject);
      return newProject;
    }
    const response = await this.fetch<any>('/projects', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    // Map backend format to our Project type
    // The backend returns { success: true, project: {...} }
    const project = response.project || response;
    return {
      id: project.id,
      name: project.name,
      repository: project.repo_url,
      baseBranch: project.base_branch,
      created: project.created_at,
      tasksCount: 0
    };
  }

  async getProjectBranches(projectId: string): Promise<string[]> {
    if (USE_MOCKS) {
      return ['main', 'develop', 'feature/user-auth', 'feature/api-refactor', 'fix/memory-leak'];
    }
    const response = await this.fetch<Array<{ name: string; isRemote: boolean; fullName: string }>>(`/projects/${projectId}/branches`);
    
    // Get unique branch names, preferring local over remote
    const branchMap = new Map<string, boolean>();
    
    // First add local branches
    response
      .filter(branch => !branch.isRemote)
      .forEach(branch => branchMap.set(branch.name, true));
    
    // Then add remote branches (cleaning up the name)
    response
      .filter(branch => branch.isRemote && !branch.name.includes('HEAD'))
      .forEach(branch => {
        // Extract clean branch name from remote (e.g., "main" from "remotes/origin/main")
        const cleanName = branch.fullName.replace(/^remotes\/origin\//, '');
        if (!branchMap.has(cleanName)) {
          branchMap.set(cleanName, false);
        }
      });
    
    return Array.from(branchMap.keys());
  }

  async getProjectPlanning(projectId: string): Promise<{ exists: boolean; content: string | null }> {
    if (USE_MOCKS) {
      return {
        exists: true,
        content: `# Project Planning

## 🐛 Bugs
- [ ] Cart total not updating when quantity changes
- [ ] Login redirect loop on mobile Safari

## 💡 Ideas
- [ ] AI-powered product recommendations
- [ ] Wishlist functionality
- [ ] Guest checkout flow

## 🔧 Tech Debt
- [ ] Refactor auth system to use middleware
- [ ] Upgrade to React 18`
      };
    }
    return this.fetch<{ exists: boolean; content: string | null }>(`/projects/${projectId}/planning`);
  }

  async updateProjectPlanning(projectId: string, content: string): Promise<{ success: boolean; message: string; needsPush?: boolean }> {
    if (USE_MOCKS) {
      return { success: true, message: 'Planning updated successfully', needsPush: true };
    }
    return this.fetch<any>(`/projects/${projectId}/planning`, {
      method: 'PUT',
      body: JSON.stringify({ content })
    });
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
    if (USE_MOCKS) {
      return {
        project: mockProjects[0],
        needsAttention: [
          {
            type: 'base-behind',
            severity: 'warning',
            message: 'Base branch is 5 commits behind origin',
            details: { behind: 5, branch: 'main' },
            actions: ['pull']
          },
          {
            type: 'stale-task',
            severity: 'warning', 
            message: 'Task "Auth system" inactive for 12 days',
            details: { taskId: '1', taskName: 'Auth system', daysSinceUpdate: 12 },
            actions: ['open-task', 'archive']
          }
        ],
        tasksCount: 3,
        activeTasks: 2
      };
    }
    return this.fetch<any>(`/projects/${projectId}/dashboard`);
  }

  async pullBaseBranch(projectId: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCKS) {
      return { success: true, message: 'Successfully pulled updates to main' };
    }
    return this.fetch<any>(`/projects/${projectId}/pull-base-branch`, {
      method: 'POST'
    });
  }

  async pushBaseBranch(projectId: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCKS) {
      return { success: true, message: 'Successfully pushed main to origin' };
    }
    return this.fetch<any>(`/projects/${projectId}/push-base-branch`, {
      method: 'POST'
    });
  }

  async getTasksMinimal(projectId: string): Promise<Task[]> {
    if (USE_MOCKS) return mockTasks.filter(t => t.id.startsWith(projectId.slice(0, 8)));
    const response = await this.fetch<any[]>(`/projects/${projectId}/tasks/minimal`);
    // Minimal response - no git status
    return response.map(t => ({
      id: t.id,
      name: t.name || 'Untitled Task',
      description: '',
      branch: t.branch,
      worktree_path: t.worktree_path,
      created_at: t.created_at,
      taskState: t.taskState || 'active',
      sessionState: t.sessionState || { status: 'not-started', lastStateChange: null }
    }));
  }

  async getProjectDashboardCached(projectId: string): Promise<any> {
    if (USE_MOCKS) {
      return {
        project: mockProjects[0],
        needsAttention: [],
        tasksCount: 3,
        activeTasks: 2,
        cached: true,
        lastUpdated: new Date().toISOString()
      };
    }
    return this.fetch<any>(`/projects/${projectId}/dashboard/cached`);
  }

  async refreshProjectStatus(projectId: string): Promise<{ success: boolean; message: string }> {
    if (USE_MOCKS) {
      return { success: true, message: 'Refresh triggered' };
    }
    return this.fetch<any>(`/projects/${projectId}/refresh`, {
      method: 'POST'
    });
  }

  // Task endpoints
  async getTasks(projectId: string): Promise<Task[]> {
    if (USE_MOCKS) return mockTasks.filter(t => t.id.startsWith(projectId.slice(0, 8)));
    const response = await this.fetch<any[]>(`/projects/${projectId}/tasks`);
    // Backend now includes sessionState and taskState
    return response.map(t => ({
      id: t.id,
      name: t.name || 'Untitled Task',
      description: '', // Not in backend yet
      branch: t.branch,
      worktree_path: t.worktree_path,
      created_at: t.created_at,
      
      // These come from backend now
      taskState: t.taskState || 'active',
      sessionState: t.sessionState || { status: 'not-started', lastStateChange: null },
      
      // Optional fields
      project_id: t.project_id,
      is_archived: t.is_archived,
      merged_at: t.merged_at,
      has_uncommitted_changes: t.has_uncommitted_changes,
      gitStatus: t.gitStatus
    }));
  }

  async getTask(projectId: string, taskId: string): Promise<Task> {
    if (USE_MOCKS) {
      const task = mockTasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');
      return task;
    }
    const response = await this.fetch<any>(`/projects/${projectId}/tasks/${taskId}`);
    // Include terminals if present
    return {
      ...response,
      terminals: response.terminals || []
    };
  }

  async createTask(projectId: string, task: CreateTaskDTO): Promise<Task> {
    if (USE_MOCKS) {
      const branch = task.useExistingBranch 
        ? task.branch 
        : (task.branchPrefix ? `${task.branchPrefix}${task.branch}` : task.branch);
      
      const newTask: Task = {
        id: Math.random().toString(36).substr(2, 8),
        name: task.name,
        description: task.description,
        branch: branch,
        worktree_path: `/projects/${projectId}-task-${Date.now()}`,
        created_at: new Date().toISOString(),
        taskState: TaskState.Active,
        sessionState: {
          status: WorkerStatus.NotStarted,
          lastStateChange: null
        }
      };
      mockTasks.push(newTask);
      return newTask;
    }
    return this.fetch<Task>(`/projects/${projectId}/tasks`, {
      method: 'POST',
      body: JSON.stringify(task),
    });
  }

  async updateTask(projectId: string, taskId: string, updates: { name?: string; description?: string }): Promise<Task> {
    if (USE_MOCKS) {
      const taskIndex = mockTasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        mockTasks[taskIndex] = { ...mockTasks[taskIndex], ...updates };
        return mockTasks[taskIndex];
      }
      throw new Error('Task not found');
    }
    return this.fetch<Task>(`/projects/${projectId}/tasks/${taskId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async archiveTask(projectId: string, taskId: string): Promise<void> {
    if (USE_MOCKS) {
      const taskIndex = mockTasks.findIndex(t => t.id === taskId);
      if (taskIndex >= 0) {
        mockTasks[taskIndex].taskState = TaskState.Archived;
      }
      return;
    }
    await this.fetch<void>(`/projects/${projectId}/tasks/${taskId}/archive`, {
      method: 'POST',
    });
  }

  async getCommitHistory(projectId: string, taskId: string): Promise<any[]> {
    if (USE_MOCKS) {
      return [
        {
          hash: 'abc123def456',
          message: 'Fix responsive layout in header',
          author: 'You',
          date: '2 hours ago',
          isMerge: false
        },
        {
          hash: 'def456ghi789',
          message: 'Add user authentication',
          author: 'You',
          date: '4 hours ago',
          isMerge: false
        },
        {
          hash: 'ghi789jkl012',
          message: 'Merge branch \'main\' into feature/auth',
          author: 'You',
          date: 'Yesterday',
          isMerge: true
        },
        {
          hash: 'jkl012mno345',
          message: 'Initial auth setup',
          author: 'You',
          date: '2 days ago',
          isMerge: false
        }
      ];
    }
    return this.fetch<any[]>(`/projects/${projectId}/tasks/${taskId}/git/commits`);
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
    // Delegated to GitService - Note: This method needs to be added to GitService
    // For now, using direct fetch until GitService is enhanced
    if (USE_MOCKS) return Math.random() > 0.7; // 30% chance of conflicts
    const result = await this.fetch<{ hasConflicts: boolean }>(`/tasks/${taskId}/git/check-conflicts`);
    return result.hasConflicts;
  }

  async createPR(taskId: string, description: string): Promise<PullRequest> {
    if (USE_MOCKS) {
      return {
        id: Math.floor(Math.random() * 1000),
        url: `https://github.com/user/repo/pull/${Math.floor(Math.random() * 1000)}`,
        title: 'Mock PR',
        description,
        state: 'open',
        mergeable: true,
        conflicts: false,
      };
    }
    return this.fetch<PullRequest>(`/tasks/${taskId}/pr/create`, {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  }

  // Container endpoints
  async deployContainers(taskId: string): Promise<DeploymentResult> {
    if (USE_MOCKS) {
      return {
        success: true,
        services: [
          { id: '1', name: 'web-app', port: 9001, status: 'running', autoAssigned: true, type: 'web-app' },
          { id: '2', name: 'api', port: 9002, status: 'running', autoAssigned: true, type: 'api' },
          { id: '3', name: 'database', port: 9003, status: 'stopped', autoAssigned: true, type: 'database' },
        ],
      };
    }
    return this.fetch<DeploymentResult>(`/tasks/${taskId}/deploy`, {
      method: 'POST',
    });
  }

  async stopContainers(taskId: string): Promise<void> {
    if (USE_MOCKS) return;
    await this.fetch(`/tasks/${taskId}/containers`, {
      method: 'DELETE',
    });
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
    // Delegated to GitService - Note: This uses a different endpoint, keeping direct implementation for now
    if (USE_MOCKS) {
      return { success: true, output: 'Mock update successful' };
    }
    return this.fetch<{ success: boolean; output: string; error?: string }>(
      `/projects/${projectId}/tasks/${taskId}/update`,
      {
        method: 'POST',
      }
    );
  }

  async mergeToBase(projectId: string, taskId: string): Promise<{ success: boolean; output: string; error?: string }> {
    // Delegated to GitService - Note: This uses a different endpoint, keeping direct implementation for now
    if (USE_MOCKS) {
      return { success: true, output: 'Mock merge successful' };
    }
    return this.fetch<{ success: boolean; output: string; error?: string }>(
      `/projects/${projectId}/tasks/${taskId}/merge-to-base`,
      {
        method: 'POST',
      }
    );
  }

  async getContainerLogs(taskId: string): Promise<string[]> {
    if (USE_MOCKS) {
      return [
        '[10:30:45] Starting container deployment...',
        '[10:30:46] Building Docker images...',
        '[10:30:50] Starting web-app service on port 9001',
        '[10:30:52] Starting api service on port 9002',
        '[10:30:55] All services started successfully',
      ];
    }
    return this.fetch<string[]>(`/tasks/${taskId}/container-logs`);
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