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
    const models = req.services.models;
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
    const models = req.services.models;
    
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
    const models = req.services.models;
    
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
    const { branchName, fromBranch = 'main' } = req.body;
    const models = req.services.models;
    
    if (!branchName) {
      return res.status(400).json({ error: 'Branch name is required' });
    }
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    
    // Create branch
    const repository = new GitRepository(req.githubToken);
    const result = await repository.execute(
      `git checkout -b ${branchName} ${fromBranch}`,
      project.local_path
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
    const models = req.services.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all branches
    const repository = new GitRepository(req.githubToken);
    const result = await repository.execute('git branch -a', project.local_path);
    
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
    const models = req.services.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Fetch from remote
    const repository = new GitRepository(req.githubToken);
    const fetchResult = await repository.fetch(project.local_path, { all: true, prune: true });
    
    if (!fetchResult.success) {
      return res.status(500).json({ error: `Failed to fetch: ${fetchResult.error}` });
    }
    
    // Pull current branch (reuse repository instance)
    const pullResult = await repository.pull(project.local_path);
    
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
    const models = req.services.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get git config from settings
    const gitUserName = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    const gitConfig = {
      name: gitUserName?.value || 'PocketDev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
    
    // Ensure git credentials are configured
    await GitRepository.configureCredentials(project.local_path, req.githubToken, gitConfig);
    
    // Fetch with git
    const repository = new GitRepository(req.githubToken);
    const result = await repository.fetch(project.local_path, { all: true, prune: true });
    
    // Get updated branch info
    const branchResult = await repository.execute('git branch -r', project.local_path);
    
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
    const models = req.services.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!await fs.access(project.local_path).then(() => true).catch(() => false)) {
      return res.json({ behind: 0, ahead: 0, error: 'Project directory not found' });
    }
    
    try {
      // Fetch latest from remote to get accurate status
      const repository = new GitRepository(req.githubToken);
      await repository.fetch(project.local_path);
      
      // Check if base branch is behind its remote
      const behindResult = await repository.execute(
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`,
        project.local_path
      );
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      // Check if base branch has unpushed commits
      const aheadResult = await repository.execute(
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`,
        project.local_path
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
    const models = req.services.models;
    
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get git config from settings
    const gitUserName = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    const gitConfig = {
      name: gitUserName?.value || 'PocketDev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
    
    // Ensure git credentials are configured
    await GitRepository.configureCredentials(project.local_path, req.githubToken, gitConfig);
    
    // Check for uncommitted changes in base branch
    const workingTree = new GitWorkingTree(req.githubToken);
    const statusResult = await workingTree.getStatus(project.local_path);
    
    if (statusResult.output && statusResult.output.trim()) {
      return res.status(400).json({ 
        error: 'Cannot pull: Base branch has uncommitted changes',
        hasUncommitted: true 
      });
    }
    
    // Pull updates for base branch
    const repository = new GitRepository(req.githubToken);
    const result = await repository.pull(project.local_path, 'origin', project.base_branch);
    
    if (!result.success) {
      // Check if it's an authentication error
      if (result.error && (result.error.includes('could not read Password') || result.error.includes('Authentication failed'))) {
        // Check if we have a token configured
        const hasToken = !!req.services.git;
        
        return res.status(401).json({ 
          error: 'GitHub authentication failed',
          details: result.error,
          hasToken,
          tokenLength: req.services.git ? req.services.git.length : 0,
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
    const models = req.services.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get git config from settings
    const gitUserName = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    const gitConfig = {
      name: gitUserName?.value || 'PocketDev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
    
    // Ensure git credentials are configured
    await GitRepository.configureCredentials(project.local_path, req.githubToken, gitConfig);
    
    // Push base branch
    const repository = new GitRepository(req.githubToken);
    const result = await repository.push(project.local_path, project.base_branch);
    
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
    const models = req.services.models;
    
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
    const models = req.services.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Trigger git fetch in background (non-blocking)
    const repository = new GitRepository(req.githubToken);
    repository.fetch(project.local_path)
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