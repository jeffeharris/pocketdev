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
    
    // Create default PLANNING.md in .pocketdev directory
    try {
      const planningTemplate = `# Project Planning: ${finalProjectName}

## 🎯 Project Overview
${finalProjectName} - Created on ${new Date().toLocaleDateString()}

## 🐛 Bugs & Issues
<!-- Track bugs that need to be fixed -->
- [ ] 

## 💡 Feature Ideas
<!-- New features and enhancements to implement -->
- [ ] 

## 🔧 Technical Debt
<!-- Code improvements, refactoring needs, and optimization tasks -->
- [ ] 

## 📋 Current Sprint
<!-- Tasks currently being worked on or planned for the current sprint -->
- [ ] 

## 🏗️ Architecture Decisions
<!-- Important technical decisions and their rationale -->
- 

## 📝 Notes & Context
<!-- Any additional context, links, or information relevant to the project -->
- Repository: ${repoUrl}
- Base Branch: ${branch}

---
*This file is maintained by PocketDev to track project planning and context across all tasks.*
`;

      // Create .pocketdev directory
      await gitService.executeGitCommand(
        projectPath,
        'mkdir -p .pocketdev',
        config.githubToken
      );
      
      // Write the PLANNING.md file using a more robust method
      const planningPath = path.join(projectPath, '.pocketdev', 'PLANNING.md');
      await fs.writeFile(planningPath, planningTemplate, 'utf8');
      
      // Add and commit the file
      await gitService.executeGitCommand(
        projectPath,
        'git add .pocketdev/PLANNING.md',
        config.githubToken
      );
      
      await gitService.executeGitCommand(
        projectPath,
        'git commit -m "Add PocketDev project planning file"',
        config.githubToken
      );
      
      console.log('Created default PLANNING.md for project:', finalProjectName);
    } catch (error) {
      // Don't fail project creation if planning file creation fails
      console.error('Failed to create default PLANNING.md:', error);
    }
    
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
    
    // Try to get GitHub token from various sources
    let githubToken = config.githubToken;
    
    // If no env token, try to extract from existing remote URL
    if (!githubToken) {
      try {
        const { stdout: remoteUrl } = await gitService.executeGitCommand(
          project.local_path,
          'git remote get-url origin'
        );
        
        // Check if URL has embedded token
        if (remoteUrl && remoteUrl.includes('github_pat_')) {
          const tokenMatch = remoteUrl.match(/github_pat_[A-Za-z0-9_]+/);
          if (tokenMatch) {
            githubToken = tokenMatch[0];
            console.log('Using token extracted from remote URL');
          }
        }
      } catch (e) {
        console.error('Failed to check remote URL:', e);
      }
    }
    
    // Ensure git credentials are configured
    await gitService.configureGitCredentials(project.local_path, githubToken);
    
    // Check for uncommitted changes in base branch
    const statusResult = await gitService.executeGitCommand(
      project.local_path,
      'git status --porcelain',
      githubToken
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
      githubToken
    );
    
    if (!result.success) {
      // Check if it's an authentication error
      if (result.error && (result.error.includes('could not read Password') || result.error.includes('Authentication failed'))) {
        return res.status(401).json({ 
          error: 'GitHub authentication failed. Please ensure GITHUB_TOKEN environment variable is set.',
          details: result.error,
          hint: 'Set GITHUB_TOKEN environment variable and restart the containers with: make down && make dev'
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

/**
 * Get PLANNING.md content from base branch
 */
export async function getProjectPlanning(req, res, next) {
  try {
    const { projectId } = req.params;
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Try to read PLANNING.md from .pocketdev directory in base branch
    const result = await gitService.executeGitCommand(
      project.local_path,
      `git show ${project.base_branch}:.pocketdev/PLANNING.md`,
      config.githubToken
    );
    
    if (result.success) {
      res.json({ 
        exists: true, 
        content: result.output 
      });
    } else {
      // File doesn't exist or other error
      if (result.error.includes('does not exist') || result.error.includes('pathspec')) {
        res.json({ 
          exists: false, 
          content: null 
        });
      } else {
        // Some other git error
        res.status(500).json({ 
          error: `Failed to read PLANNING.md: ${result.error}` 
        });
      }
    }
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
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // First, ensure we're on the base branch
    await gitService.executeGitCommand(
      project.local_path,
      `git checkout ${project.base_branch}`,
      config.githubToken
    );
    
    // Create .pocketdev directory if it doesn't exist
    await gitService.executeGitCommand(
      project.local_path,
      'mkdir -p .pocketdev',
      config.githubToken
    );
    
    // Write the PLANNING.md file using fs instead of echo to handle content properly
    const planningPath = path.join(project.local_path, '.pocketdev', 'PLANNING.md');
    try {
      await fs.writeFile(planningPath, content, 'utf8');
    } catch (error) {
      return res.status(500).json({ error: 'Failed to write PLANNING.md: ' + error.message });
    }
    
    // Add and commit the file
    await gitService.executeGitCommand(
      project.local_path,
      'git add .pocketdev/PLANNING.md',
      config.githubToken
    );
    
    const commitResult = await gitService.executeGitCommand(
      project.local_path,
      `git commit -m "Update PLANNING.md for project ${project.name}" || echo "No changes to commit"`,
      config.githubToken
    );
    
    res.json({ 
      success: true, 
      message: 'PLANNING.md updated successfully',
      needsPush: commitResult.output.includes('file changed')
    });
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
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all active tasks for this project
    const tasks = await models.tasks.findByProjectId(projectId, { includeArchived: false });
    
    const needsAttention = [];
    
    // 1. Check base branch sync status WITHOUT FETCH (use cached data)
    try {
      // Just check current status without fetching
      const behindResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`,
        config.githubToken
      );
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      const aheadResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`,
        config.githubToken
      );
      const ahead = parseInt(aheadResult.output.trim()) || 0;
      
      if (behind > 0) {
        needsAttention.push({
          type: 'base-behind',
          severity: 'warning',
          message: `Base branch is ${behind} commits behind origin`,
          details: { behind, branch: project.base_branch },
          actions: ['pull']
        });
      }
      
      if (ahead > 0) {
        needsAttention.push({
          type: 'base-ahead',
          severity: 'info',
          message: `Local base is ${ahead} commits ahead of origin`,
          details: { ahead, branch: project.base_branch },
          actions: ['push']
        });
      }
    } catch (error) {
      // Git error, but continue with other checks
      console.error('Git status check failed:', error);
    }
    
    // Skip expensive checks like stale tasks, merge conflicts, and PR checks
    // These can be loaded progressively or on-demand
    
    res.json({
      project,
      needsAttention,
      tasksCount: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'active').length,
      cached: true,
      lastUpdated: new Date().toISOString()
    });
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
    gitService.executeGitCommand(project.local_path, 'git fetch origin', config.githubToken)
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
    const models = req.app.locals.models;
    
    const project = await models.projects.findById(projectId);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all active tasks for this project
    const tasks = await models.tasks.findByProjectId(projectId, { includeArchived: false });
    
    const needsAttention = [];
    
    // 1. Check base branch sync status
    try {
      await gitService.executeGitCommand(project.local_path, 'git fetch origin', config.githubToken);
      
      const behindResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`,
        config.githubToken
      );
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      const aheadResult = await gitService.executeGitCommand(
        project.local_path,
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`,
        config.githubToken
      );
      const ahead = parseInt(aheadResult.output.trim()) || 0;
      
      if (behind > 0) {
        needsAttention.push({
          type: 'base-behind',
          severity: 'warning',
          message: `Base branch is ${behind} commits behind origin`,
          details: { behind, branch: project.base_branch },
          actions: ['pull']
        });
      }
      
      if (ahead > 0) {
        needsAttention.push({
          type: 'base-ahead',
          severity: 'info',
          message: `Local base is ${ahead} commits ahead of origin`,
          details: { ahead, branch: project.base_branch },
          actions: ['push']
        });
      }
    } catch (error) {
      // Git error, but continue with other checks
      console.error('Git status check failed:', error);
    }
    
    // 2. Check for stale tasks (no commits in 7+ days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    for (const task of tasks) {
      if (task.status === 'active' && task.updated < sevenDaysAgo) {
        const daysSinceUpdate = Math.floor((Date.now() - new Date(task.updated).getTime()) / (1000 * 60 * 60 * 24));
        needsAttention.push({
          type: 'stale-task',
          severity: 'warning',
          message: `Task "${task.name}" inactive for ${daysSinceUpdate} days`,
          details: { taskId: task.id, taskName: task.name, daysSinceUpdate },
          actions: ['open-task', 'archive']
        });
      }
      
      // 3. Check for merge conflicts
      if (task.status === 'active' && task.worktree_path) {
        try {
          // Try to merge base branch into task branch (dry run)
          const mergeResult = await gitService.executeGitCommand(
            task.worktree_path,
            `git merge-tree $(git merge-base HEAD origin/${project.base_branch}) HEAD origin/${project.base_branch}`,
            config.githubToken
          );
          
          if (mergeResult.output && mergeResult.output.includes('<<<<<<< ')) {
            needsAttention.push({
              type: 'merge-conflict',
              severity: 'error',
              message: `Task "${task.name}" has merge conflicts with base branch`,
              details: { taskId: task.id, taskName: task.name },
              actions: ['open-task', 'resolve-conflicts']
            });
          }
        } catch (error) {
          // Skip conflict check for this task
        }
      }
    }
    
    // 4. Check for open PRs (using gh CLI)
    if (config.githubToken) {
      try {
        const prResult = await gitService.executeGitCommand(
          project.local_path,
          `gh pr list --state open --json number,title,url,author,createdAt`,
          config.githubToken
        );
        
        if (prResult.success && prResult.output) {
          const prs = JSON.parse(prResult.output);
          for (const pr of prs) {
            needsAttention.push({
              type: 'open-pr',
              severity: 'info',
              message: `PR #${pr.number}: ${pr.title}`,
              details: { 
                prNumber: pr.number, 
                prUrl: pr.url,
                title: pr.title,
                author: pr.author.login,
                createdAt: pr.createdAt
              },
              actions: ['view-pr', 'merge-pr']
            });
          }
        }
      } catch (error) {
        // gh CLI might not be available or configured
        console.error('PR check failed:', error);
      }
    }
    
    res.json({
      project,
      needsAttention,
      tasksCount: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'active').length
    });
  } catch (error) {
    next(error);
  }
}