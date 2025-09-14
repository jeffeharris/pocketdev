import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import crypto from 'crypto';
import { ProjectRepository } from './internal/project-repository.js';
import { ProjectGitOperations } from './internal/project-git-operations.js';
import { ProjectPlanningManager } from './internal/project-planning-manager.js';
import { GitService } from './git.service.js';
import { Project as ProjectDomain, ValidationError } from '../../shared/domain/index.js';

/**
 * ProjectService - Orchestrates project operations using internal services
 * A proper "deep module" with 8 public methods hiding complex implementation
 */
export class ProjectService {
  constructor(models, githubTokenService, githubService = null, projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), '../projects')) {
    // Internal services that handle specific aspects
    this.repository = new ProjectRepository(models);
    this.gitOps = new ProjectGitOperations(new GitService(), githubTokenService, projectsDir);
    this.planningManager = new ProjectPlanningManager(githubService, projectsDir);
    
    // Core dependencies
    this.models = models;
    this.githubTokenService = githubTokenService;
    this.githubService = githubService;
    this.projectsDir = projectsDir;
  }

  /**
   * Create a new project
   */
  async create(projectData, options = {}) {
    const { repoUrl, branch = 'main', projectName } = projectData;
    const { githubToken = null } = options;
    
    // Generate project ID
    const projectId = crypto.randomBytes(4).toString('hex');
    const name = projectName || repoUrl.split('/').pop().replace('.git', '');
    
    // Use domain object for validation
    const projectDomain = new ProjectDomain(projectId, name, repoUrl, branch);
    
    // Clone the repository
    const projectPath = await this.gitOps.cloneProject(repoUrl, projectId, branch, githubToken);
    
    // Create project in database
    const project = await this.repository.create({
      id: projectId,
      name,
      repo_url: repoUrl,
      base_branch: branch,
      local_path: projectPath,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    
    // Create default planning document
    await this.planningManager.createDefaultPlanningDocument(project, repoUrl);
    
    // Store GitHub token if provided
    if (githubToken) {
      await this.githubTokenService.storeToken(projectId, githubToken);
    }
    
    return project;
  }

  /**
   * Get project by ID
   */
  async get(projectId, includes = []) {
    const project = await this.repository.findById(projectId);
    
    // Add included data
    if (includes.includes('tasks')) {
      project.tasks = await this.repository.getProjectTasks(projectId);
    }
    
    if (includes.includes('branches')) {
      project.branches = await this.gitOps.getProjectBranches(project.local_path);
    }
    
    if (includes.includes('status')) {
      project.git_status = await this.gitOps.getProjectStatus(project.local_path);
    }
    
    if (includes.includes('planning')) {
      const planning = await this.planningManager.getPlanningContent(project.local_path);
      project.planning = planning.content;
    }
    
    if (includes.includes('github')) {
      const githubToken = await this.githubTokenService.getToken(projectId);
      if (githubToken) {
        project.metadata = await this.planningManager.enrichWithGitHubMetadata(
          project,
          project.repo_url,
          githubToken
        );
      }
    }
    
    return project;
  }

  /**
   * List all projects
   */
  async list(options = {}) {
    return await this.repository.list(options);
  }

  /**
   * Update project metadata
   */
  async update(projectId, updates) {
    // Only allow updating certain fields
    const allowedFields = ['name', 'base_branch', 'description'];
    const filteredUpdates = {};
    
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      return await this.repository.findById(projectId);
    }
    
    filteredUpdates.updated_at = new Date().toISOString();
    await this.repository.update(projectId, filteredUpdates);
    
    return await this.repository.findById(projectId);
  }

  /**
   * Delete project
   */
  async delete(projectId, options = {}) {
    const { cleanupFiles = true } = options;
    
    const project = await this.repository.findById(projectId);
    
    // Delete from database (cascades to tasks)
    await this.repository.delete(projectId);
    
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
   * Sync project with remote (fetch/pull)
   */
  async sync(projectId, operation = 'fetch', options = {}) {
    const { githubToken = null } = options;
    
    const project = await this.repository.findById(projectId);
    
    // Get stored token if not provided
    const token = githubToken || await this.githubTokenService.getToken(projectId);
    
    // Configure git with token if available
    if (token) {
      await GitService.configureCredentials(project.local_path, token);
    }
    
    let result;
    switch (operation) {
      case 'fetch':
        result = await this.gitOps.fetchProject(project.local_path);
        break;
      
      case 'pull':
        result = await this.gitOps.pullProject(project.local_path, project.base_branch);
        break;
      
      case 'push':
        result = await this.gitOps.pushProject(project.local_path, project.base_branch);
        break;
      
      default:
        throw new Error(`Unknown sync operation: ${operation}`);
    }
    
    // Update project timestamp
    await this.repository.update(projectId, {
      updated_at: new Date().toISOString()
    });
    
    return result;
  }

  /**
   * Manage branches (create, checkout, list)
   */
  async branch(projectId, operation, branchName = null, options = {}) {
    const project = await this.repository.findById(projectId);
    
    switch (operation) {
      case 'create':
        if (!branchName) throw new Error('Branch name required');
        return await this.gitOps.createBranch(
          project.local_path,
          branchName,
          options.fromBranch
        );
      
      case 'checkout':
        if (!branchName) throw new Error('Branch name required');
        return await this.gitOps.checkoutBranch(project.local_path, branchName);
      
      case 'list':
        return await this.gitOps.getProjectBranches(project.local_path, options);
      
      default:
        throw new Error(`Unknown branch operation: ${operation}`);
    }
  }

  /**
   * Manage planning documents
   */
  async planning(projectId, operation, content = null, options = {}) {
    const project = await this.repository.findById(projectId);
    
    switch (operation) {
      case 'get':
        return await this.planningManager.getPlanningContent(project.local_path);
      
      case 'update':
        if (!content) throw new Error('Content required for update');
        
        // Update locally
        await this.planningManager.updatePlanningContent(project.local_path, content);
        
        // Commit and push if requested
        if (options.commit) {
          const gitService = new GitService(options.githubToken);
          await gitService.commit(
            project.local_path,
            options.commitMessage || 'Update planning document',
            ['.pocketdev/PLANNING.md']
          );
          
          if (options.push) {
            await gitService.push(project.local_path, project.base_branch);
          }
        }
        
        return { success: true };
      
      case 'create':
        return await this.planningManager.createDefaultPlanningDocument(project, project.repo_url);
      
      default:
        throw new Error(`Unknown planning operation: ${operation}`);
    }
  }
}

// Re-export internal services for testing
export { ProjectRepository, ProjectGitOperations, ProjectPlanningManager };