import path from 'path';
import { promises as fs } from 'fs';
import config from '../config/index.js';

/**
 * ProjectController - Thin HTTP adapter with 8 core methods matching ProjectService
 * Additional endpoint functions delegate to these core methods for backward compatibility
 */

// ========== 8 CORE CONTROLLER METHODS ==========

/**
 * Core list method
 */
async function list(req, res, next) {
  try {
    const projectService = req.services.ProjectService;
    const projects = await projectService.list(req.query);
    res.json(projects);
  } catch (error) {
    next(error);
  }
}

/**
 * Core create method
 */
async function create(req, res, next) {
  try {
    const { repoUrl, branch = 'main', projectName } = req.body;
    const projectService = req.services.ProjectService;
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }
    
    const result = await projectService.create(
      { repoUrl, branch, projectName },
      { githubToken: req.githubToken }
    );
    
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Core get method - handles all get variations
 */
async function get(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = req.services.ProjectService;
    
    // Determine includes based on the specific endpoint called
    const routePath = req.route?.path || '';
    let includes = [];
    
    if (routePath.includes('dashboard')) {
      includes = ['tasks', 'status', 'branches', 'planning'];
    } else if (routePath.includes('minimal')) {
      includes = [];
    } else if (routePath.includes('branches')) {
      includes = ['branches'];
    }
    
    const project = await projectService.get(projectId, includes);
    
    // Format response based on endpoint
    if (routePath.includes('minimal')) {
      return res.json({
        id: project.id,
        name: project.name,
        repo_url: project.repo_url,
        base_branch: project.base_branch
      });
    }
    
    res.json(project);
  } catch (error) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Core update method
 */
async function update(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = req.services.ProjectService;
    
    const project = await projectService.update(projectId, req.body);
    res.json(project);
  } catch (error) {
    if (error.statusCode === 404 || error.message === 'Project not found') {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
}

/**
 * Core delete method  
 */
async function deleteMethod(req, res, next) {
  try {
    const { projectId } = req.params;
    const { force } = req.body;
    const projectService = req.services.ProjectService;
    
    const result = await projectService.delete(projectId, { force });
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * Core sync method - handles fetch/pull/push
 */
async function sync(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = req.services.ProjectService;
    const routePath = req.route?.path || '';
    
    // Determine operation from route
    let operation = 'fetch';
    if (routePath.includes('pull')) operation = 'pull';
    else if (routePath.includes('push')) operation = 'push';
    else if (req.body?.operation) operation = req.body.operation;
    
    const result = await projectService.sync(projectId, operation, {
      githubToken: req.githubToken
    });
    
    // Some endpoints expect status back
    if (routePath.includes('refresh') || routePath.includes('status')) {
      const project = await projectService.get(projectId, ['status']);
      return res.json(project.git_status || project);
    }
    
    res.json(result);
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ 
        error: error.message,
        ...(error.details && { details: error.details }),
        ...(error.hasUncommitted && { hasUncommitted: error.hasUncommitted }),
        ...(error.output && { output: error.output })
      });
    }
    next(error);
  }
}

/**
 * Core branch method - handles create/list
 */
async function branch(req, res, next) {
  try {
    const { projectId } = req.params;
    const { name } = req.body;
    const projectService = req.services.ProjectService;
    
    // Determine operation from HTTP method
    if (req.method === 'GET') {
      // List branches
      const branches = await projectService.branch(projectId, 'list', null, {
        githubToken: req.githubToken
      });
      return res.json(branches);
    } else if (req.method === 'POST') {
      // Create branch
      if (!name) {
        return res.status(400).json({ error: 'Branch name is required' });
      }
      const result = await projectService.branch(projectId, 'create', name, {
        githubToken: req.githubToken
      });
      return res.json(result);
    }
    
    res.status(405).json({ error: 'Method not allowed' });
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
 * Core planning method - handles get/update
 */
async function planning(req, res, next) {
  try {
    const { projectId } = req.params;
    const { content } = req.body;
    const projectService = req.services.ProjectService;
    
    // Determine operation from HTTP method
    if (req.method === 'GET') {
      // Get planning
      const result = await projectService.planning(projectId, 'get');
      return res.json(result);
    } else if (req.method === 'PUT') {
      // Update planning
      const result = await projectService.planning(projectId, 'update', content, {
        githubToken: req.githubToken
      });
      return res.json(result);
    }
    
    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    next(error);
  }
}

// ========== BACKWARD COMPATIBILITY EXPORTS ==========

// Basic CRUD
export const listProjects = list;
export const createProject = create;
export const getProject = get;
export const updateProject = update;
export const deleteProject = deleteMethod;

// Sync variations
export const syncProject = sync;
export const fetchProject = sync;
export const pullBaseBranch = sync;
export const pushBaseBranch = sync;
export const refreshProjectStatus = sync;
export const getBaseBranchStatus = sync;
export const getUpdateStatus = sync;

// Get variations
export const getProjectMinimal = get;
export const getProjectDashboard = get;
export const getProjectDashboardCached = get;

// Branch operations
export const createBranch = branch;
export const listBranches = branch;

// Planning operations
export const getProjectPlanning = planning;
export const updateProjectPlanning = planning;