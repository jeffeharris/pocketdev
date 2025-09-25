import path from "path";
import fs from "fs";
import { TASK_EVENTS, SPLIT_EVENTS } from "./events.js";
import { WorktreeService } from "./worktree.service.js";
import { GitService } from "./git.service.js";
import { TaskTerminalManager } from "./internal/task-terminal-manager.js";
import { getSessionInfo } from "../../shared/shelltender-client.js";
import { Logger } from "../utils/logger.js";

/**
 * TaskService - Orchestrates task operations
 * A deep module with simple interface hiding complex implementation
 */
export class TaskService {
  constructor(
    models,
    githubTokenService,
    eventEmitterService = null,
    gitService = null,
    projectsDir = "/projects",
  ) {
    // Direct model access - simpler and clearer
    this.models = models;

    // Keep terminal manager as it handles complex Shelltender operations
    this.terminalManager = new TaskTerminalManager(models, eventEmitterService);

    // Core dependencies
    this.githubTokenService = githubTokenService;
    this.eventEmitterService = eventEmitterService;
    this.gitService = gitService || new GitService();
    this.projectsDir = projectsDir;
    this.worktreeService = new WorktreeService();
    this.logger = new Logger("TaskService");
  }

  /**
   * Create a new task
   */
  async create(projectId, options = {}) {
    const {
      name,
      branch,
      useExistingBranch = false,
      githubToken = null,
      createSession = false,
      hostname = null,
    } = options;

    return await this.logger.timeOperation(
      "task.create",
      async () => {
        // Get project directly
        const project = await this.models.projects.findById(projectId);
        if (!project) {
          const error = new Error("Project not found");
          error.statusCode = 404;
          throw error;
        }

        // Generate task ID and worktree path
        const { v4: uuidv4 } = await import("uuid");
        const taskId = uuidv4().slice(0, 8);
        const worktreePath = path.join(
          this.projectsDir,
          `${project.id}-task-${taskId}`,
        );

        try {
          // Create worktree
          await this.worktreeService.create(
            project.local_path,
            branch,
            worktreePath,
            project.base_branch,
            useExistingBranch,
          );

          // Configure git credentials if token provided
          if (githubToken) {
            await GitService.configureCredentials(worktreePath, githubToken);
          }

          // Create task in database
          const task = await this.models.tasks.create({
            id: taskId,
            project_id: project.id,
            name,
            branch,
            worktree_path: worktreePath,
          });

          // Update project last accessed
          await this.models.projects.updateLastAccessed(projectId);

          // Create terminal session if requested
          let sessionInfo = null;
          if (createSession) {
            sessionInfo = await this._createTaskSession(taskId, worktreePath);
          }

          const result = {
            task: {
              ...task,
              claudeUrl: hostname
                ? `http://${hostname}:7681/?arg=${encodeURIComponent(worktreePath)}`
                : null,
            },
            session: sessionInfo,
          };

          // Emit task created event
          if (this.eventEmitterService) {
            this.eventEmitterService.emit(TASK_EVENTS.CREATED, {
              task: result.task,
            });
          }

          return result;
        } catch (error) {
          // Cleanup on failure
          try {
            await this.worktreeService.removeIfExists(
              project.local_path,
              worktreePath,
            );
          } catch (cleanupError) {
            console.error(
              "Failed to cleanup after task creation failure:",
              cleanupError,
            );
          }
          throw error;
        }
      },
      { projectId, name, branch },
    );
  }

  /**
   * Get task details
   */
  async get(taskId, includes = [], options = {}) {
    const { githubToken, projectId } = options;

    // Get base task data
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    // Validate project ownership if projectId provided
    if (projectId && task.project_id !== projectId) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    // Add optional includes
    if (includes.includes("sessions")) {
      const sessions = await this.models.sessions.findByTaskId(taskId);
      task.sessions = sessions;
      task.active_session_count = sessions.filter((s) => s.is_active).length;

      // Add session state from active sessions
      const activeSession = sessions.find((s) => s.is_active);
      if (activeSession) {
        task.sessionState = {
          state: activeSession.ai_state,
          lastActivity: activeSession.last_activity,
        };
      }
    }

    if (includes.includes("gitStatus")) {
      task.gitStatus = await this._getTaskGitStatus(task, githubToken);
    }

    if (includes.includes("terminals")) {
      task.terminals = await this.models.sessions.findByTaskId(taskId);
    }

    return task;
  }

  /**
   * List tasks for a project
   */
  async list(projectId, options = {}) {
    const { minimal = false, githubToken, monitors = {} } = options;

    const tasks = await this.models.tasks.findByProjectId(projectId);

    if (minimal) {
      return tasks;
    }

    // Enrich with git status and session state
    const enrichedTasks = await Promise.all(
      tasks.map(async (task) => {
        let gitStatus = null;

        if (
          task.worktree_path &&
          (await this.worktreeService.exists(task.worktree_path))
        ) {
          try {
            gitStatus = await this._getTaskGitStatus(task, githubToken);
          } catch (error) {
            console.error(
              `Failed to get git status for task ${task.id}:`,
              error.message,
            );
          }
        }

        // Get session state
        const sessions = await this.models.sessions.findByTaskId(task.id);
        const activeSession = sessions.find((s) => s.is_active);

        return {
          ...task,
          gitStatus,
          sessionState: activeSession
            ? {
                state: activeSession.ai_state,
                lastActivity: activeSession.last_activity,
              }
            : null,
          active_session_count: sessions.filter((s) => s.is_active).length,
        };
      }),
    );

    return enrichedTasks;
  }

  /**
   * Update task metadata only
   */
  async update(taskId, updates = {}) {
    // Validate allowed updates
    const allowedUpdates = [
      "name",
      "description",
      "split_layout",
      "status",
      "metadata",
      "merged_at",
      "merge_commit_sha",
      "has_commits_since_merge",
    ];
    const filteredUpdates = {};

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error("No valid updates provided");
    }

    const updatedTask = await this.models.tasks.update(taskId, filteredUpdates);

    // Emit task updated event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(TASK_EVENTS.UPDATED, {
        taskId,
        changes: filteredUpdates,
      });
    }

    return updatedTask;
  }

  /**
   * Delete or archive a task
   */
  async delete(taskId, options = {}) {
    const {
      force = false,
      softDelete = true,
      checkSafety = false,
      githubToken,
    } = options;

    if (checkSafety) {
      return this._checkDeletionSafety(taskId, githubToken);
    }

    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error("Project not found for task");
    }

    // Clean up terminal sessions
    await this.terminalManager.cleanupSessions(taskId);

    if (softDelete && !force) {
      // Archive the task
      await this.models.tasks.archive(taskId);

      // Move worktree to archived location
      const archivePath = path.join(
        this.projectsDir,
        ".archived",
        `${project.id}-task-${task.id}-${Date.now()}`,
      );
      await this.worktreeService.archive(
        project.local_path,
        task.worktree_path,
        archivePath,
      );

      // Emit event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit(TASK_EVENTS.ARCHIVED, { taskId });
      }

      return { success: true, message: "Task archived", archived: true };
    } else {
      // Delete all associated sessions first
      const sessions = await this.models.sessions.findByTaskId(taskId);
      for (const session of sessions) {
        await this.models.sessions.delete(session.id);
      }

      // Delete the task
      await this.models.tasks.delete(taskId);

      // Remove worktree
      await this.worktreeService.removeIfExists(
        project.local_path,
        task.worktree_path,
      );

      // Emit event
      if (this.eventEmitterService) {
        this.eventEmitterService.emit(TASK_EVENTS.DELETED, { taskId });
      }

      return { success: true, message: "Task deleted", deleted: true };
    }
  }

  /**
   * Sync task with remote repository
   */
  async sync(taskId, operation = "pull", options = {}) {
    const { githubToken } = options;

    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error("Project not found for task");
    }

    const git = githubToken ? new GitService(githubToken) : this.gitService;

    if (operation === "pull") {
      // Check if we can pull
      const status = await git.getStatus(task.worktree_path);
      if (status.hasUncommittedChanges) {
        const error = new Error("Cannot pull: uncommitted changes present");
        error.statusCode = 409;
        error.hasUncommitted = true;
        error.changes = status.files || [];
        throw error;
      }

      // Fetch and merge from base branch
      const fetchResult = await git.sync(task.worktree_path, {
        branch: project.base_branch,
        remote: "origin",
      });

      if (!fetchResult.success) {
        throw new Error(`Failed to sync: ${fetchResult.error}`);
      }

      return {
        success: true,
        message: "Successfully updated from base branch",
        details: fetchResult.output,
      };
    } else if (operation === "push") {
      return await git.push(task.worktree_path, task.branch, {
        setUpstream: true,
      });
    }

    throw new Error(`Unknown sync operation: ${operation}`);
  }

  /**
   * Get task split layout configuration
   */
  async getLayout(taskId) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    // Return the layout or default
    return task.split_layout || { mode: "tab" };
  }

  /**
   * Set task split layout configuration
   */
  async setLayout(taskId, projectId, layout) {
    const task = await this.models.tasks.findById(taskId);
    if (!task || task.project_id !== projectId) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    // Validate layout structure
    const validModes = ["tab", "split", "split-4"];
    const validOrientations = ["horizontal", "vertical"];

    if (layout.mode && !validModes.includes(layout.mode)) {
      const error = new Error(
        'Invalid mode. Must be "tab", "split", or "split-4"',
      );
      error.statusCode = 400;
      throw error;
    }

    if (layout.orientation && !validOrientations.includes(layout.orientation)) {
      const error = new Error(
        'Invalid orientation. Must be "horizontal" or "vertical"',
      );
      error.statusCode = 400;
      throw error;
    }

    if (layout.splitRatio !== undefined) {
      const ratio = parseFloat(layout.splitRatio);
      if (isNaN(ratio) || ratio < 0.1 || ratio > 0.9) {
        const error = new Error(
          "Invalid splitRatio. Must be between 0.1 and 0.9",
        );
        error.statusCode = 400;
        throw error;
      }
      layout.splitRatio = ratio;
    }

    // Update the task
    await this.models.tasks.update(taskId, { split_layout: layout });

    // Emit event
    if (this.eventEmitterService) {
      this.eventEmitterService.emit(SPLIT_EVENTS.LAYOUT_CHANGED, {
        taskId,
        layout,
      });
    }

    return layout;
  }

  /**
   * Merge task operations
   */
  async merge(taskId, operation = "toBase", options = {}) {
    const { githubToken } = options;

    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    const project = await this.models.projects.findById(task.project_id);
    if (!project) {
      throw new Error("Project not found for task");
    }

    const git = githubToken ? new GitService(githubToken) : this.gitService;

    switch (operation) {
      case "toBase":
        // First ensure the task branch is pushed
        const pushResult = await git.push(task.worktree_path, task.branch, {
          setUpstream: true,
        });
        if (!pushResult.success) {
          const error = new Error(`Failed to push branch: ${pushResult.error}`);
          error.statusCode = 500;
          throw error;
        }

        // Switch to base branch in main project directory
        const checkoutResult = await git.checkoutBranch(
          project.local_path,
          project.base_branch,
        );
        if (!checkoutResult.success) {
          throw new Error(
            `Failed to checkout base branch: ${checkoutResult.error}`,
          );
        }

        // Pull latest base branch changes
        const pullResult = await git.sync(project.local_path, {
          branch: project.base_branch,
        });
        if (!pullResult.success) {
          throw new Error(`Failed to pull latest changes: ${pullResult.error}`);
        }

        // Merge the task branch
        const mergeResult = await git.merge(project.local_path, task.branch);

        if (!mergeResult.success) {
          // Try to recover by checking out task branch again
          await git.checkoutBranch(project.local_path, task.branch);

          const error = new Error(`Failed to merge: ${mergeResult.error}`);
          error.statusCode = 409;
          if (mergeResult.output?.includes("CONFLICT")) {
            error.hasConflicts = true;
          }
          throw error;
        }

        // Push the merged changes
        const pushMergeResult = await git.push(
          project.local_path,
          project.base_branch,
        );
        if (!pushMergeResult.success) {
          throw new Error(
            `Failed to push merged changes: ${pushMergeResult.error}`,
          );
        }

        // Get merge commit SHA
        const commitResult = await git.execute(
          "git rev-parse HEAD",
          project.local_path,
        );
        const mergeCommitSha = commitResult.output?.trim();

        // Update task with merge info
        await this.models.tasks.update(taskId, {
          merged_at: new Date().toISOString(),
          merge_commit_sha: mergeCommitSha,
          status: "merged",
        });

        // Switch back to task branch
        await git.checkoutBranch(project.local_path, task.branch);

        return {
          success: true,
          message: `Successfully merged ${task.branch} into ${project.base_branch}`,
          mergedCommit: mergeCommitSha,
          mergedAt: new Date().toISOString(),
        };

      case "checkConflicts":
        // Use git merge-tree for non-destructive conflict check
        const conflicts = await git.checkConflicts(
          task.worktree_path,
          project.base_branch,
        );

        // Check if task branch exists on remote
        const branchesResult = await git.listBranches(task.worktree_path, {
          all: true,
        });
        const remoteBranch = `origin/${task.branch}`;
        const hasRemoteBranch = branchesResult.branches?.some(
          (b) =>
            b.includes(remoteBranch) || b.includes(`remotes/${remoteBranch}`),
        );

        return {
          hasConflicts: conflicts.hasConflicts,
          conflicts: conflicts.conflicts || [],
          canMerge: !conflicts.hasConflicts,
          hasRemoteBranch,
        };

      case "status":
        if (!task.merged_at || !task.merge_commit_sha) {
          return null;
        }

        try {
          // Check if there are commits since merge
          const result = await git.execute(
            `git rev-list ${task.merge_commit_sha}..HEAD --count 2>/dev/null || echo 0`,
            task.worktree_path,
          );
          const commitsSinceMerge = parseInt(result.output.trim()) || 0;
          const hasCommitsSinceMerge = commitsSinceMerge > 0;

          // Update database if status changed
          if (hasCommitsSinceMerge !== task.has_commits_since_merge) {
            await this.models.tasks.update(taskId, {
              has_commits_since_merge: hasCommitsSinceMerge,
            });
          }

          return {
            mergedAt: task.merged_at,
            mergeCommitSha: task.merge_commit_sha,
            hasCommitsSinceMerge,
            commitsSinceMerge,
          };
        } catch (error) {
          console.error("Error checking merge status:", error);
          return {
            mergedAt: task.merged_at,
            mergeCommitSha: task.merge_commit_sha,
            error: "Could not verify merge status",
          };
        }

      default:
        throw new Error(`Unknown merge operation: ${operation}`);
    }
  }

  /**
   * Manage terminal sessions
   */
  async terminal(taskId, action = "start", options = {}) {
    const { sessionData = {}, monitors = {} } = options;

    switch (action) {
      case "start":
        return await this.terminalManager.createSession(
          taskId,
          sessionData,
          monitors,
        );
      case "stop":
        return await this.terminalManager.stopSession(
          taskId,
          options.sessionId,
        );
      case "cleanup":
        return await this.terminalManager.cleanupSessions(taskId);
      default:
        throw new Error(`Unknown terminal action: ${action}`);
    }
  }

  /**
   * Private helper methods
   */

  async _getTaskGitStatus(task, githubToken) {
    if (!task.worktree_path || !fs.existsSync(task.worktree_path)) {
      return null;
    }

    const git = githubToken ? new GitService(githubToken) : this.gitService;
    const status = await git.getStatus(task.worktree_path);

    // Get branch info
    const currentBranch = await git.getCurrentBranch(task.worktree_path);

    return {
      branch: currentBranch,
      ...status,
    };
  }

  async _createTaskSession(taskId, worktreePath) {
    // Check for existing Shelltender session
    try {
      const sessionId = `task-${taskId}`;
      const existingSession = await getSessionInfo(sessionId);

      if (existingSession?.active) {
        return {
          sessionId,
          isReconnect: true,
          ...existingSession,
        };
      } else {
        // Create new session via terminal manager
        const session = await this.terminalManager.createSession(taskId, {
          workingDirectory: worktreePath,
          sessionId,
        });

        if (session) {
          return {
            sessionId: session.id,
            isReconnect: false,
            ...session,
          };
        }
      }
    } catch (error) {
      console.warn("Could not create terminal session:", error.message);
      return null;
    }
  }

  async _checkDeletionSafety(taskId, githubToken) {
    const task = await this.models.tasks.findById(taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.statusCode = 404;
      throw error;
    }

    // Check for uncommitted changes
    let hasUncommittedChanges = false;
    let uncommittedFiles = [];

    if (
      task.worktree_path &&
      (await this.worktreeService.exists(task.worktree_path))
    ) {
      const gitStatus = await this._getTaskGitStatus(task, githubToken);
      hasUncommittedChanges = gitStatus?.hasChanges || false;
      uncommittedFiles = gitStatus?.files || [];
    }

    // Check for active sessions
    const sessions = await this.models.sessions.findByTaskId(taskId);
    const hasActiveSessions = sessions.some((s) => s.is_active);

    // Check if branch is pushed
    const git = githubToken ? new GitService(githubToken) : this.gitService;
    let isPushed = false;

    try {
      const branchesResult = await git.listBranches(task.worktree_path, {
        all: true,
      });
      isPushed =
        branchesResult.branches?.some(
          (b) =>
            b.includes(`origin/${task.branch}`) ||
            b.includes(`remotes/origin/${task.branch}`),
        ) || false;
    } catch (error) {
      console.warn("Could not check if branch is pushed:", error.message);
    }

    return {
      canDelete: !hasUncommittedChanges && !hasActiveSessions,
      hasUncommittedChanges,
      uncommittedFiles,
      hasActiveSessions,
      isPushed,
      warnings: [
        hasUncommittedChanges && "Task has uncommitted changes",
        hasActiveSessions && "Task has active terminal sessions",
        !isPushed && "Branch has not been pushed to remote",
      ].filter(Boolean),
    };
  }
}
