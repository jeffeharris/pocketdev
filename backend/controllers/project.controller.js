import path from 'path';
import { promises as fs } from 'fs';
import config from '../config/index.js';
import { GitRepository } from '../services/git-repository.service.js';
import { GitWorkingTree } from '../services/git-workingtree.service.js';
import { GitAnalyzer } from '../services/git-analyzer.service.js';
import { ProjectService } from '../services/project.service.js';

// GitHub token is now injected by middleware as req.services.git

/**
 * List all projects
 */
export async function listProjects(req, res, next) {
  try {
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const projects = await projectService.listProjects();
    res.json(projects);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new project
 */
export async function createProject(req, res, next) {
  try {
    const { repoUrl, branch = 'main', projectName } = req.body;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }
    
    const result = await projectService.createProject(
      { repoUrl, branch, projectName },
      req.services.git
    );
    
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get a specific project
 */
export async function getProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const project = await projectService.getProject(projectId);
    res.json(project);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Update a project
 */
export async function updateProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const updatedProject = await projectService.updateProject(projectId, req.body);
    res.json(updatedProject);
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Delete a project
 */
export async function deleteProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const { force } = req.body; // Allow force deletion via request body
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    
    const result = await projectService.deleteProject(projectId, { force });
    
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Create a new branch
 */
export async function createBranch(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const result = await projectService.createProjectBranch(projectId, req.body, req.services.git);
    res.json(result);
  } catch (error) {
    if (error.message === 'Branch name is required') {
      return res.status(400).json({ error: error.message });
    }
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * List branches for a project
 */
export async function listBranches(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const branches = await projectService.getProjectBranches(projectId, req.services.git);
    res.json(branches);
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Sync project with remote
 */
export async function syncProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const result = await projectService.syncProject(projectId, req.services.git);
    res.json(result);
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: error.message });
    }
    if (error.message && error.message.includes('Failed to')) {
      return res.status(500).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Fetch remote updates for project
 */
export async function fetchProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const result = await projectService.fetchProject(projectId, req.githubToken);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Get base branch sync status
 */
export async function getBaseBranchStatus(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const status = await projectService.getBaseBranchStatus(projectId, req.services.git);
    res.json(status);
  } catch (error) {
    if (error.message === 'Project not found') {
      return res.status(404).json({ error: error.message });
    }
    // Handle directory not found as non-error response
    if (error.message && error.message.includes('directory')) {
      return res.json({ behind: 0, ahead: 0, error: error.message });
    }
    next(error);
  }
}

/**
 * Pull base branch updates
 */
export async function pullBaseBranch(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const result = await projectService.pullBaseBranch(projectId, req.services.git);
    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ 
        error: error.message,
        ...(error.details && { details: error.details }),
        ...(error.hasUncommitted && { hasUncommitted: error.hasUncommitted })
      });
    }
    next(error);
  }
}

/**
 * Push base branch to remote
 */
export async function pushBaseBranch(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const result = await projectService.pushBaseBranch(projectId, req.services.git);
    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ 
        error: error.message,
        ...(error.output && { output: error.output })
      });
    }
    next(error);
  }
}

/**
 * Check update status for all tasks
 */
export async function getUpdateStatus(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    
    const result = await projectService.getProjectTasksUpdateStatus(projectId, req.services.git);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get PLANNING.md content from base branch
 */
export async function getProjectPlanning(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    
    const planning = await projectService.getProjectPlanning(projectId, req.services.git);
    
    res.json(planning);
  } catch (error) {
    next(error);
  }
}

/**
 * Create or update PLANNING.md in the .pocketdev directory
 */
export async function updateProjectPlanning(req, res, next) {
  try {
    const { projectId } = req.params;
    const { content } = req.body;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    
    const result = await projectService.updateProjectPlanning(projectId, content, req.services.git);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Get minimal project info for fast loading
 */
export async function getProjectMinimal(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const project = await projectService.getProjectMinimal(projectId);
    res.json(project);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Get dashboard status from cache (no git fetch)
 */
export async function getProjectDashboardCached(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    
    const dashboard = await projectService.getProjectDashboard(
      projectId, 
      req.services.git, 
      { cached: true }
    );
    
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
}

/**
 * Trigger background refresh of git status
 */
export async function refreshProjectStatus(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    const result = await projectService.refreshProjectStatus(projectId, req.githubToken);
    res.json(result);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Get comprehensive dashboard status for a project (includes git fetch)
 */
export async function getProjectDashboard(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = new ProjectService(
      req.services.models,
      req.services.GitHubTokenService,
      config.projectsDir
    );
    
    const dashboard = await projectService.getProjectDashboard(
      projectId, 
      req.services.git, 
      { cached: false }
    );
    
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
}