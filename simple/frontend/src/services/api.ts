import type { Task, CreateTaskDTO } from '../types/task';
import { TaskState, WorkerStatus } from '../types/task';
import type { GitStatus, ChangedFile, PullRequest } from '../types/git';
import type { DeploymentResult } from '../types/container';
import type { Project } from '../types/project';
import type { Settings, UpdateSettingsDTO, GithubTestResult } from '../api/settings';
import { mockTasks, mockProjects, mockGitStatus, mockChangedFiles } from './mockData';

const API_BASE = '/api';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

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
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  // Project endpoints
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
    return {
      id: response.project.id,
      name: response.project.name,
      repository: response.project.repo_url,
      baseBranch: response.project.base_branch,
      created: response.project.created_at,
      tasksCount: 0
    };
  }

  async getProjectBranches(projectId: string): Promise<string[]> {
    if (USE_MOCKS) {
      return ['main', 'develop', 'feature/user-auth', 'feature/api-refactor', 'fix/memory-leak'];
    }
    const response = await this.fetch<string[]>(`/projects/${projectId}/branches`);
    return response;
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

  async getTask(taskId: string): Promise<Task> {
    if (USE_MOCKS) {
      const task = mockTasks.find(t => t.id === taskId);
      if (!task) throw new Error('Task not found');
      return task;
    }
    return this.fetch<Task>(`/tasks/${taskId}`);
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

  // Git endpoints
  async getGitStatus(taskId: string): Promise<GitStatus> {
    if (USE_MOCKS) return mockGitStatus;
    return this.fetch<GitStatus>(`/tasks/${taskId}/git/status`);
  }

  async getChangedFiles(taskId: string): Promise<ChangedFile[]> {
    if (USE_MOCKS) return mockChangedFiles;
    return this.fetch<ChangedFile[]>(`/tasks/${taskId}/files/changed`);
  }

  async getTaskDiff(projectId: string, taskId: string): Promise<{ files: Array<{
    path: string;
    type: 'added' | 'modified' | 'deleted' | 'renamed';
    additions: number;
    deletions: number;
    diff: string;
  }> }> {
    if (USE_MOCKS) {
      // Return mock diff data for testing
      return {
        files: [{
          path: 'src/components/Button.tsx',
          type: 'modified',
          additions: 10,
          deletions: 2,
          diff: `diff --git a/src/components/Button.tsx b/src/components/Button.tsx
index abc123..def456 100644
--- a/src/components/Button.tsx
+++ b/src/components/Button.tsx
@@ -1,5 +1,10 @@
-export const Button = ({ children }) => {
+interface ButtonProps {
+  children: React.ReactNode;
+  onClick: () => void;
+}
+
+export const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
   return (
-    <button>{children}</button>
+    <button onClick={onClick}>{children}</button>
   );
 };`
        }]
      };
    }
    return this.fetch<{ files: any[] }>(`/projects/${projectId}/tasks/${taskId}/git/diff`);
  }

  async checkConflicts(taskId: string): Promise<boolean> {
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
    if (USE_MOCKS) {
      return { success: true, output: `Mock ${operation} successful` };
    }
    return this.fetch<{ success: boolean; output: string; error?: string }>(
      `/projects/${projectId}/tasks/${taskId}/git`,
      {
        method: 'POST',
        body: JSON.stringify({ operation, ...options }),
      }
    );
  }

  async stageAndCommit(projectId: string, taskId: string, message: string, files?: string | string[]): Promise<{ success: boolean; output: string; error?: string }> {
    // First stage files
    const addResult = await this.gitOperation(projectId, taskId, 'add', { files: files || '.' });
    if (!addResult.success) {
      return addResult;
    }
    
    // Then commit
    return this.gitOperation(projectId, taskId, 'commit', { message });
  }

  async updateBranch(projectId: string, taskId: string): Promise<{ success: boolean; output: string; error?: string }> {
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
    return this.fetch<{ url: string }>(`/tasks/${taskId}/terminal`, {
      method: 'POST',
    });
  }

  // Settings endpoints
  async getSettings(): Promise<Settings> {
    if (USE_MOCKS) {
      return {
        hasGithubToken: false,
        gitUserName: '',
        gitUserEmail: ''
      };
    }
    return this.fetch<Settings>('/settings');
  }

  async updateSettings(settings: UpdateSettingsDTO): Promise<any> {
    if (USE_MOCKS) {
      return { message: 'Settings updated successfully', hasGithubToken: true };
    }
    return this.fetch('/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async testGithubToken(): Promise<GithubTestResult> {
    if (USE_MOCKS) {
      return { 
        valid: true, 
        user: { 
          login: 'mockuser', 
          name: 'Mock User', 
          email: 'mock@example.com' 
        } 
      };
    }
    return this.fetch<GithubTestResult>('/settings/test-github', {
      method: 'POST',
    });
  }

  async getSystemInfo(): Promise<any> {
    if (USE_MOCKS) {
      return { 
        projectsDir: '/projects',
        nodeVersion: 'v18.0.0',
        platform: 'linux'
      };
    }
    return this.fetch('/settings/system-info');
  }
}

export const api = new ApiService();

// Export settings API for convenience
export const settingsApi = {
  getSettings: () => api.getSettings(),
  updateSettings: (settings: UpdateSettingsDTO) => api.updateSettings(settings),
  testGithubToken: () => api.testGithubToken(),
  getSystemInfo: () => api.getSystemInfo()
};