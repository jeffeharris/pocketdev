import path from 'path';
import { promises as fs } from 'fs';
import config from '../config/index.js';
import * as gitService from '../services/git.service.js';

// GitHub token is now injected by middleware as req.githubToken

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
    const projectService = req.app.locals.serviceRegistry.get('ProjectService');
    
    if (!repoUrl) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }
    
    const result = await projectService.createProject(
      { repoUrl, branch, projectName },
      req.githubToken
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
    const { force } = req.body; // Allow force deletion via request body
    const projectService = req.app.locals.serviceRegistry.get('ProjectService');
    
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
      req.githubToken
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
      req.githubToken
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
      req.githubToken
    );
    
    if (!fetchResult.success) {
      return res.status(500).json({ error: `Failed to fetch: ${fetchResult.error}` });
    }
    
    // Pull current branch
    const pullResult = await gitService.executeGitCommand(
      project.local_path,
      'git pull',
      req.githubToken
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
    await gitService.configureGitCredentials(project.local_path, req.githubToken);
    
    // Fetch with git
    const result = await gitService.executeGitCommand(
      project.local_path,
      'git fetch --all --prune --tags',
      req.githubToken
    );
    
    // Get updated branch info
    const branchResult = await gitService.executeGitCommand(
      project.local_path,
      'git branch -r',
      req.githubToken
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
      await gitService.executeGitCommand(project.local_path, 'git fetch origin', req.githubToken);
      
      // Check if base branch is behind its remote
      const behindResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`,
        req.githubToken
      );
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      // Check if base branch has unpushed commits
      const aheadResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`,
        req.githubToken
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
    await gitService.configureGitCredentials(project.local_path, req.githubToken);
    
    // Check for uncommitted changes in base branch
    const statusResult = await gitService.executeGitCommand(
      project.local_path,
      'git status --porcelain',
      req.githubToken
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
      req.githubToken
    );
    
    if (!result.success) {
      // Check if it's an authentication error
      if (result.error && (result.error.includes('could not read Password') || result.error.includes('Authentication failed'))) {
        // Check if we have a token configured
        const hasToken = !!req.githubToken;
        
        return res.status(401).json({ 
          error: 'GitHub authentication failed',
          details: result.error,
          hasToken,
          tokenLength: req.githubToken ? req.githubToken.length : 0,
          settingsUrl: '/settings',
          helpText: hasToken 
            ? 'Your GitHub token appears to be invalid or expired. Please update it in the settings.'
            : 'No GitHub token found. Please configure one in the settings.',
          steps: [
            'Click the link below to create a new GitHub token',
            'Set Token name: "PocketDev"',
            'Set Expiration: 90 days (or your preference)',
            'Repository access: Select "Selected repositories" and choose the repos you want to use',
            'Repository permissions - set these to Read & Write:',
            '  • Contents (for git pull/push)',
            '  • Pull requests (for creating PRs)',
            '  • Metadata (Read only)',
            'Click "Generate token" and copy the token',
            'Paste it in PocketDev Settings and save'
          ],
          githubTokenUrl: 'https://github.com/settings/personal-access-tokens/new',
          githubTokenDocs: 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
          tokenType: 'fine-grained',
          requiredPermissions: {
            contents: 'write',
            metadata: 'read',
            pull_requests: 'write' // For future PR functionality
          },
          createTokenUrl: 'https://github.com/settings/personal-access-tokens/new'
        });
      }
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
    await gitService.configureGitCredentials(project.local_path, req.githubToken);
    
    // Push base branch
    const result = await gitService.executeGitCommand(
      project.local_path,
      `git push origin ${project.base_branch}`,
      req.githubToken
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
    const projectService = req.app.locals.serviceRegistry.get('ProjectService');
    
    const result = await projectService.getProjectTasksUpdateStatus(projectId, req.githubToken);
    
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
    const projectService = req.app.locals.serviceRegistry.get('ProjectService');
    
    const planning = await projectService.getProjectPlanning(projectId, req.githubToken);
    
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
    const projectService = req.app.locals.serviceRegistry.get('ProjectService');
    
    const result = await projectService.updateProjectPlanning(projectId, content, req.githubToken);
    
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
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Return just the project info - no git operations
    res.json({
      id: project.id,
      name: project.name,
      repository: project.repo_url,
      baseBranch: project.base_branch,
      created: project.created_at,
      local_path: project.local_path
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get dashboard status from cache (no git fetch)
 */
export async function getProjectDashboardCached(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = req.app.locals.serviceRegistry.get('ProjectService');
    
    const dashboard = await projectService.getProjectDashboard(
      projectId, 
      req.githubToken, 
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
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Trigger git fetch in background (non-blocking)
    gitService.executeGitCommand(project.local_path, 'git fetch origin', req.githubToken)
      .then(() => console.log(`Background fetch completed for project ${projectId}`))
      .catch(err => console.error(`Background fetch failed for project ${projectId}:`, err));
    
    // Return immediately
    res.json({ 
      success: true, 
      message: 'Refresh triggered',
      projectId 
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Get comprehensive dashboard status for a project (includes git fetch)
 */
export async function getProjectDashboard(req, res, next) {
  try {
    const { projectId } = req.params;
    const projectService = req.app.locals.serviceRegistry.get('ProjectService');
    
    const dashboard = await projectService.getProjectDashboard(
      projectId, 
      req.githubToken, 
      { cached: false }
    );
    
    res.json(dashboard);
  } catch (error) {
    next(error);
  }
}