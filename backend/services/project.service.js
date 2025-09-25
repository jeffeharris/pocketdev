import path from "path";
import fs from "fs/promises";
import fsSync from "fs";
import crypto from "crypto";
import { GitService } from "./git.service.js";
import { Logger } from "../utils/logger.js";

/**
 * ProjectService - Orchestrates project operations
 * A deep module with simple interface hiding complex implementation
 */
export class ProjectService {
  constructor(
    models,
    githubTokenService,
    githubService = null,
    projectsDir = process.env.PROJECTS_DIR ||
      path.join(process.cwd(), "../projects"),
  ) {
    // Direct model access - simpler and clearer
    this.models = models;

    // Core dependencies
    this.githubTokenService = githubTokenService;
    this.githubService = githubService;
    this.gitService = new GitService();
    this.projectsDir = projectsDir;
    this.logger = new Logger("ProjectService");
  }

  /**
   * Create a new project
   */
  async create(projectData, options = {}) {
    const { repoUrl, branch = "main", projectName } = projectData;
    const { githubToken = null } = options;

    return await this.logger.timeOperation(
      "project.create",
      async () => {
        // Generate project ID
        const projectId = crypto.randomBytes(4).toString("hex");
        const name =
          projectName || repoUrl.split("/").pop().replace(".git", "");
        const projectPath = path.join(this.projectsDir, projectId);

        // Clone the repository
        const git = githubToken ? new GitService(githubToken) : this.gitService;
        const cloneResult = await git.clone(repoUrl, projectPath, { branch });

        if (!cloneResult.success) {
          throw new Error(`Failed to clone repository: ${cloneResult.error}`);
        }

        // Configure credentials if token provided
        if (githubToken) {
          await GitService.configureCredentials(projectPath, githubToken);
        }

        // Create project in database
        const project = await this.models.projects.create({
          id: projectId,
          name,
          repo_url: repoUrl,
          base_branch: branch,
          local_path: projectPath,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        // Create default planning document
        await this._createDefaultPlanningDocument(project, repoUrl);

        // Store GitHub token if provided
        if (githubToken) {
          await this.githubTokenService.storeToken(projectId, githubToken);
        }

        return project;
      },
      { repoUrl, branch },
    );
  }

  /**
   * Get project by ID
   */
  async get(projectId, includes = []) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    // Add included data
    if (includes.includes("tasks")) {
      project.tasks = await this.models.tasks.findByProjectId(projectId);
    }

    if (includes.includes("branches")) {
      const branchesResult = await this.gitService.listBranches(
        project.local_path,
      );
      project.branches = branchesResult;
    }

    if (includes.includes("status")) {
      project.git_status = await this.gitService.getStatus(project.local_path);
    }

    if (includes.includes("planning")) {
      const planningContent = await this._getPlanningContent(
        project.local_path,
      );
      project.planning = planningContent.content;
    }

    if (includes.includes("github") && this.githubService) {
      const githubToken = await this.githubTokenService.getToken(projectId);
      if (githubToken) {
        project.metadata = await this._enrichWithGitHubMetadata(
          project,
          project.repo_url,
          githubToken,
        );
      }
    }

    return project;
  }

  /**
   * List all projects
   */
  async list(options = {}) {
    const { nameOnly = false } = options;
    return nameOnly
      ? await this.models.projects.findAllMinimal()
      : await this.models.projects.findAll();
  }

  /**
   * Update project metadata
   */
  async update(projectId, updates) {
    // Only allow updating certain fields
    const allowedFields = ["name", "base_branch", "description"];
    const filteredUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return await this.models.projects.findById(projectId);
    }

    filteredUpdates.updated_at = new Date().toISOString();
    await this.models.projects.update(projectId, filteredUpdates);

    return await this.models.projects.findById(projectId);
  }

  /**
   * Delete project
   */
  async delete(projectId, options = {}) {
    const { cleanupFiles = true } = options;

    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    // Delete all associated tasks first
    const tasks = await this.models.tasks.findByProjectId(projectId);
    for (const task of tasks) {
      await this.models.tasks.delete(task.id);
    }

    // Delete project from database
    await this.models.projects.delete(projectId);

    // Clean up files if requested
    if (cleanupFiles && project.local_path) {
      try {
        await fs.rm(project.local_path, { recursive: true, force: true });
      } catch (error) {
        console.warn(`Failed to delete project files: ${error.message}`);
      }
    }

    // Remove stored credentials
    await this.githubTokenService.removeToken(projectId);

    return { success: true, deleted: project };
  }

  /**
   * Sync project with remote (fetch/pull/push)
   */
  async sync(projectId, operation = "fetch", options = {}) {
    const { githubToken = null } = options;

    return await this.logger.timeOperation(
      `project.sync.${operation}`,
      async () => {
        const project = await this.models.projects.findById(projectId);
        if (!project) {
          const error = new Error("Project not found");
          error.statusCode = 404;
          throw error;
        }

        // Get stored token if not provided
        const token =
          githubToken || (await this.githubTokenService.getToken(projectId));
        const git = token ? new GitService(token) : this.gitService;

        // Configure git with token if available
        if (token) {
          await GitService.configureCredentials(project.local_path, token);
        }

        let result;
        switch (operation) {
          case "fetch":
            result = await git.sync(project.local_path, { fetchOnly: true });
            break;

          case "pull":
            result = await git.sync(project.local_path, {
              branch: project.base_branch,
            });
            break;

          case "push":
            result = await git.push(project.local_path, project.base_branch);
            break;

          default:
            throw new Error(`Unknown sync operation: ${operation}`);
        }

        // Update project timestamp
        await this.models.projects.update(projectId, {
          updated_at: new Date().toISOString(),
        });

        return result;
      },
      { projectId, operation },
    );
  }

  /**
   * Manage branches (create, checkout, list)
   */
  async branch(projectId, operation, branchName = null, options = {}) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    switch (operation) {
      case "create":
        if (!branchName) throw new Error("Branch name required");

        // Checkout source branch if specified
        if (options.fromBranch) {
          await this.gitService.checkoutBranch(
            project.local_path,
            options.fromBranch,
          );
        }

        return await this.gitService.createBranch(
          project.local_path,
          branchName,
          { checkout: true },
        );

      case "checkout":
        if (!branchName) throw new Error("Branch name required");
        return await this.gitService.checkoutBranch(
          project.local_path,
          branchName,
        );

      case "list":
        return await this.gitService.listBranches(project.local_path, options);

      default:
        throw new Error(`Unknown branch operation: ${operation}`);
    }
  }

  /**
   * Manage planning documents
   */
  async planning(projectId, operation, content = null, options = {}) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    switch (operation) {
      case "get":
        return await this._getPlanningContent(project.local_path);

      case "update":
        if (!content) throw new Error("Content required for update");

        // Update locally
        await this._updatePlanningContent(project.local_path, content);

        // Commit and push if requested
        if (options.commit) {
          const git = options.githubToken
            ? new GitService(options.githubToken)
            : this.gitService;
          await git.commit(
            project.local_path,
            options.commitMessage || "Update planning document",
            [".pocketdev/PLANNING.md"],
          );

          if (options.push) {
            await git.push(project.local_path, project.base_branch);
          }
        }

        return { success: true };

      case "create":
        return await this._createDefaultPlanningDocument(
          project,
          project.repo_url,
        );

      default:
        throw new Error(`Unknown planning operation: ${operation}`);
    }
  }

  /**
   * Private helper methods
   */

  async _getPlanningContent(projectPath) {
    const planningPath = path.join(projectPath, ".pocketdev", "PLANNING.md");

    try {
      const content = await fs.readFile(planningPath, "utf-8");
      return {
        exists: true,
        content,
        path: planningPath,
      };
    } catch (error) {
      return {
        exists: false,
        content: null,
        path: planningPath,
      };
    }
  }

  async _updatePlanningContent(projectPath, content) {
    const planningDir = path.join(projectPath, ".pocketdev");
    const planningPath = path.join(planningDir, "PLANNING.md");

    // Ensure directory exists
    await fs.mkdir(planningDir, { recursive: true });

    // Write the content
    await fs.writeFile(planningPath, content, "utf-8");

    return planningPath;
  }

  async _createDefaultPlanningDocument(project, repoUrl) {
    const content = `# ${project.name} - Development Planning

## Project Overview
Repository: ${repoUrl}
Created: ${new Date().toISOString()}

## Goals
- [ ] Define project objectives
- [ ] Set up development environment
- [ ] Implement core features

## Tasks
<!-- Add your development tasks here -->

## Notes
<!-- Add any additional notes or documentation -->
`;

    const projectPath = path.join(this.projectsDir, project.id);
    return await this._updatePlanningContent(projectPath, content);
  }

  async _enrichWithGitHubMetadata(project, repoUrl, githubToken) {
    if (!this.githubService || !githubToken) {
      return project;
    }

    try {
      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (!match) return project;

      const [, owner, repo] = match;

      // Fetch repository metadata
      const metadata = await this.githubService.getRepositoryInfo(
        owner,
        repo,
        githubToken,
      );

      return {
        ...project,
        github: {
          stars: metadata.stargazers_count,
          forks: metadata.forks_count,
          open_issues: metadata.open_issues_count,
          description: metadata.description,
          topics: metadata.topics || [],
          default_branch: metadata.default_branch,
          visibility: metadata.visibility || "public",
        },
      };
    } catch (error) {
      // If GitHub metadata fetch fails, return project as-is
      console.warn("Failed to fetch GitHub metadata:", error.message);
      return project;
    }
  }
}
