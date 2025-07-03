import path from 'path';
import { promises as fs } from 'fs';
import crypto from 'crypto';
import config from '../config/index.js';
import * as gitService from '../services/git.service.js';

/**
 * List all projects
 */
export async function listProjects(req, res, next) {
  try {
    const models = req.app.locals.models;
    const projects = await models.projects.findAll();
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
    const models = req.app.locals.models;
    const github = req.app.locals.github;
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }
    
    // Generate project ID and paths
    const projectId = crypto.randomBytes(8).toString('hex');
    const projectPath = path.join(config.projectsDir, projectId);
    
    // Extract project name from URL if not provided
    const finalProjectName = projectName || repoUrl.split('/').pop().replace('.git', '');
    
    // Clone repository
    console.log(`Cloning ${repoUrl} to ${projectPath}...`);
    const cloneResult = await gitService.executeGitCommand(
      config.projectsDir,
      `git clone ${repoUrl} ${projectId}`,
      config.githubToken
    );
    
    if (!cloneResult.success) {
      return res.status(500).json({ error: `Failed to clone repository: ${cloneResult.error}` });
    }
    
    // Configure git credentials
    await gitService.configureGitCredentials(projectPath, config.githubToken);
    
    // Checkout branch if different from default
    if (branch && branch !== 'main') {
      const checkoutResult = await gitService.executeGitCommand(
        projectPath,
        `git checkout ${branch}`,
        config.githubToken
      );
      
      if (!checkoutResult.success) {
        // Clean up on failure
        await fs.rm(projectPath, { recursive: true, force: true });
        return res.status(500).json({ error: `Failed to checkout branch ${branch}: ${checkoutResult.error}` });
      }
    }
    
    // Save project to database
    const project = await models.projects.create({
      id: projectId,
      name: finalProjectName,
      repoUrl: repoUrl,
      baseBranch: branch,
      localPath: projectPath
    });
    
    // Get GitHub metadata if available
    if (github && repoUrl.includes('github.com')) {
      try {
        const [owner, repo] = repoUrl.split('github.com/')[1].replace('.git', '').split('/');
        const repoData = await github.getRepository(owner, repo);
        
        // Update project with GitHub metadata
        await models.projects.update(projectId, {
          metadata: {
            github_owner: owner,
            github_repo: repo,
            description: repoData.description,
            default_branch: repoData.default_branch
          }
        });
        
        project.github_owner = owner;
        project.github_repo = repo;
        project.description = repoData.description;
      } catch (error) {
        console.error('Failed to fetch GitHub metadata:', error);
      }
    }
    
    res.status(201).json({ 
      success: true, 
      project: project 
    });
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
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    res.json(project);
  } catch (error) {
    next(error);
  }
}

/**
 * Update a project
 */
export async function updateProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Update project in database
    await models.projects.update(projectId, req.body);
    
    // Get updated project
    const updatedProject = await models.projects.findById(projectId);
    res.json(updatedProject);
  } catch (error) {
    next(error);
  }
}

/**
 * Delete a project
 */
export async function deleteProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Delete project directory
    try {
      await fs.rm(project.local_path, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to delete project directory:', error);
    }
    
    // Delete from database
    await models.projects.archive(projectId);
    
    res.json({ message: 'Project deleted successfully' });
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
    const { branchName, fromBranch = 'main' } = req.body;
    const models = req.app.locals.models;
    
    if (!branchName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Create branch
    const result = await gitService.executeGitCommand(
      project.local_path,
      `git checkout -b ${branchName} ${fromBranch}`,
      config.githubToken
    );
    
    if (!result.success) {
      return res.status(500).json({ error: `Failed to create branch: ${result.error}` });
    }
    
    res.json({ 
      message: 'Branch created successfully',
      branch: branchName,
      output: result.output
    });
  } catch (error) {
    next(error);
  }
}

/**
 * List branches for a project
 */
export async function listBranches(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all branches
    const result = await gitService.executeGitCommand(
      project.local_path,
      'git branch -a',
      config.githubToken
    );
    
    if (!result.success) {
      return res.status(500).json({ error: `Failed to list branches: ${result.error}` });
    }
    
    // Parse branches
    const branches = result.output
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const branch = line.trim().replace('* ', '');
        const isRemote = branch.startsWith('remotes/');
        const isCurrent = line.startsWith('* ');
        
        return {
          name: isRemote ? branch.replace('remotes/origin/', '') : branch,
          isRemote,
          isCurrent,
          fullName: branch
        };
      });
    
    res.json(branches);
  } catch (error) {
    next(error);
  }
}

/**
 * Sync project with remote
 */
export async function syncProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Fetch from remote
    const fetchResult = await gitService.executeGitCommand(
      project.local_path,
      'git fetch --all --prune',
      config.githubToken
    );
    
    if (!fetchResult.success) {
      return res.status(500).json({ error: `Failed to fetch: ${fetchResult.error}` });
    }
    
    // Pull current branch
    const pullResult = await gitService.executeGitCommand(
      project.local_path,
      'git pull',
      config.githubToken
    );
    
    res.json({
      message: 'Project synced successfully',
      fetch: fetchResult.output,
      pull: pullResult.output
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Fetch remote updates for project
 */
export async function fetchProject(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await gitService.configureGitCredentials(project.local_path, config.githubToken);
    
    // Fetch with git
    const result = await gitService.executeGitCommand(
      project.local_path,
      'git fetch --all --prune --tags',
      config.githubToken
    );
    
    // Get updated branch info
    const branchResult = await gitService.executeGitCommand(
      project.local_path,
      'git branch -r',
      config.githubToken
    );
    
    const branches = branchResult.output
      .split('\n')
      .filter(b => b.trim())
      .map(b => b.trim().replace('origin/', ''));
    
    await models.projects.updateLastAccessed(project.id);
    
    res.json({ 
      success: result.success, 
      output: result.output,
      branches: branches
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get base branch sync status
 */
export async function getBaseBranchStatus(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!await fs.access(project.local_path).then(() => true).catch(() => false)) {
      return res.json({ behind: 0, ahead: 0, error: 'Project directory not found' });
    }
    
    try {
      // Fetch latest from remote to get accurate status
      await gitService.executeGitCommand(project.local_path, 'git fetch origin', config.githubToken);
      
      // Check if base branch is behind its remote
      const behindResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`,
        config.githubToken
      );
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      // Check if base branch has unpushed commits
      const aheadResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`,
        config.githubToken
      );
      const ahead = parseInt(aheadResult.output.trim()) || 0;
      
      res.json({ behind, ahead, branch: project.base_branch });
    } catch (error) {
      // Remote might not be set up or branch might not exist
      res.json({ behind: 0, ahead: 0, error: error.message });
    }
  } catch (error) {
    next(error);
  }
}

/**
 * Pull base branch updates
 */
export async function pullBaseBranch(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await gitService.configureGitCredentials(project.local_path, config.githubToken);
    
    // Check for uncommitted changes in base branch
    const statusResult = await gitService.executeGitCommand(
      project.local_path,
      'git status --porcelain',
      config.githubToken
    );
    
    if (statusResult.output && statusResult.output.trim()) {
      return res.status(400).json({ 
        error: 'Cannot pull: Base branch has uncommitted changes',
        hasUncommitted: true 
      });
    }
    
    // Pull updates for base branch
    const result = await gitService.executeGitCommand(
      project.local_path,
      `git pull origin ${project.base_branch}`,
      config.githubToken
    );
    
    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Pull failed',
        output: result.output 
      });
    }
    
    await models.projects.updateLastAccessed(project.id);
    
    res.json({ 
      success: true, 
      output: result.output,
      message: `Successfully pulled updates to ${project.base_branch}`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Push base branch changes
 */
export async function pushBaseBranch(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await gitService.configureGitCredentials(project.local_path, config.githubToken);
    
    // Push base branch
    const result = await gitService.executeGitCommand(
      project.local_path,
      `git push origin ${project.base_branch}`,
      config.githubToken
    );
    
    if (!result.success) {
      return res.status(500).json({ 
        error: result.error || 'Push failed',
        output: result.output 
      });
    }
    
    await models.projects.updateLastAccessed(project.id);
    
    res.json({ 
      success: true, 
      output: result.output,
      message: `Successfully pushed ${project.base_branch} to origin`
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Check update status for all tasks
 */
export async function getUpdateStatus(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const tasks = await models.tasks.findByProjectId(project.id);
    const updateStatus = [];
    
    for (const task of tasks) {
      if (!await fs.access(task.worktree_path).then(() => true).catch(() => false)) continue;
      
      try {
        // Check if branch is behind origin/base_branch
        const behindResult = await gitService.executeGitCommand(
          task.worktree_path,
          `git rev-list --count HEAD..origin/${project.base_branch}`,
          config.githubToken
        );
        const behind = parseInt(behindResult.output.trim()) || 0;
        
        // Check if branch has unpushed commits to its own remote
        let ahead = 0;
        try {
          // First check if remote tracking branch exists
          const remoteCheckResult = await gitService.executeGitCommand(
            task.worktree_path,
            `git rev-parse --verify origin/${task.branch} 2>/dev/null`,
            config.githubToken
          );
          
          if (remoteCheckResult.success) {
            // Remote branch exists, count unpushed commits
            const aheadResult = await gitService.executeGitCommand(
              task.worktree_path,
              `git rev-list --count origin/${task.branch}..HEAD`,
              config.githubToken
            );
            ahead = parseInt(aheadResult.output.trim()) || 0;
          } else {
            // No remote branch, count all commits ahead of base branch
            const aheadResult = await gitService.executeGitCommand(
              task.worktree_path,
              `git rev-list --count origin/${project.base_branch}..HEAD`,
              config.githubToken
            );
            ahead = parseInt(aheadResult.output.trim()) || 0;
          }
        } catch (e) {
          // Fallback to comparing with base branch
          const aheadResult = await gitService.executeGitCommand(
            task.worktree_path,
            `git rev-list --count origin/${project.base_branch}..HEAD`,
            config.githubToken
          );
          ahead = parseInt(aheadResult.output.trim()) || 0;
        }
        
        // Check for uncommitted changes
        const statusResult = await gitService.executeGitCommand(
          task.worktree_path,
          'git status --porcelain',
          config.githubToken
        );
        const hasUncommitted = statusResult.output.trim().length > 0;
        
        updateStatus.push({
          taskId: task.id,
          taskName: task.name,
          branch: task.branch,
          behind,
          ahead,
          hasUncommitted,
          needsUpdate: behind > 0
        });
      } catch (error) {
        // Task might not have tracking set up
        updateStatus.push({
          taskId: task.id,
          taskName: task.name,
          branch: task.branch,
          behind: 0,
          ahead: 0,
          hasUncommitted: false,
          needsUpdate: false,
          error: error.message
        });
      }
    }
    
    res.json({ updateStatus });
  } catch (error) {
    next(error);
  }
}