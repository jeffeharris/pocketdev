import { Router } from 'express';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fsSync from 'fs';
import config from '../config/index.js';
// Removed direct git command import - using GitService instead
import { GitService } from '../services/git.service.js';
import { githubTokenMiddleware } from '../middleware/github-auth.middleware.js';
// Git services middleware removed - modules are instantiated directly

const exec = promisify(execCallback);
const router = Router();

// Apply GitHub token middleware to all routes
router.use(githubTokenMiddleware);
// Middleware removed - git modules instantiated as needed

// Create new project from repo
router.post('/', async (req, res) => {
  const { repoUrl, branch = 'main', projectName } = req.body;
  const { models } = req.services;
  
  try {
    // Check if project already exists
    const existing = await models.projects.findByRepoUrl(repoUrl);
    if (existing) {
      return res.status(400).json({ 
        error: 'Project already exists', 
        project: existing 
      });
    }
    
    const projectId = models.projects.generateId();
    const projectPath = path.join(config.projectsDir, projectId);
    
    // Clone repository with authentication if GitHub token is available
    let cloneUrl = repoUrl;
    
    if (req.githubToken && repoUrl.includes('github.com')) {
      if (repoUrl.startsWith('https://github.com/')) {
        cloneUrl = repoUrl.replace('https://github.com/', `https://${req.githubToken}@github.com/`);
      } else if (repoUrl.startsWith('git@github.com:')) {
        const repoPath = repoUrl.replace('git@github.com:', '').replace('.git', '');
        cloneUrl = `https://${req.githubToken}@github.com/${repoPath}.git`;
      }
    }
    
    await exec(`git clone ${cloneUrl} ${projectPath}`);
    
    if (cloneUrl !== repoUrl) {
      await exec(`git remote set-url origin ${repoUrl}`, { cwd: projectPath });
    }
    
    await exec(`git checkout ${branch}`, { cwd: projectPath });
    await GitService.configureCredentials(projectPath, req.githubToken);
    
    // Create project in database
    const project = await models.projects.create({
      id: projectId,
      name: projectName || path.basename(repoUrl, '.git'),
      repoUrl,
      baseBranch: branch,
      localPath: projectPath
    });
    
    res.json({
      success: true,
      project: {
        ...project,
        apiUrl: `http://${req.hostname}:${config.port}/api/projects/${projectId}`
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// List all projects
router.get('/', async (req, res) => {
  const { models } = req.services;
  
  try {
    const projects = await models.projects.findAll();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project details
router.get('/:id', async (req, res) => {
  const { models } = req.services;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get current git status if local path exists
    let gitStatus = null;
    if (project.local_path && fsSync.existsSync(project.local_path)) {
      const gitService = new GitService(req.githubToken);
      const statusResult = await gitService.getStatus(project.local_path);
      gitStatus = {
        status: statusResult.raw.porcelain,
        hasChanges: statusResult.raw.porcelain.trim().length > 0
      };
    }
    
    res.json({
      ...project,
      git: gitStatus
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get base branch sync status
router.get('/:id/base-branch-status', async (req, res) => {
  const { models } = req.services;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fsSync.existsSync(project.local_path)) {
      return res.json({ behind: 0, ahead: 0, error: 'Project directory not found' });
    }
    
    try {
      const gitService = new GitService(req.githubToken);

      // Fetch latest from remote to get accurate status
      await gitService.sync(project.local_path, { fetchOnly: true });

      // Get ahead/behind counts for base branch
      const counts = await gitService.getAheadBehindCounts(project.local_path, project.base_branch);
      const { ahead, behind } = counts;
      
      res.json({ behind, ahead, branch: project.base_branch });
    } catch (error) {
      // Remote might not be set up or branch might not exist
      res.json({ behind: 0, ahead: 0, error: error.message });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Pull base branch updates
router.post('/:id/pull-base-branch', async (req, res) => {
  const { models } = req.services;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await GitService.configureCredentials(project.local_path, req.githubToken);
    
    const gitService = new GitService(req.githubToken);

    // Check for uncommitted changes in base branch
    const statusResult = await gitService.getStatus(project.local_path);
    if (statusResult.raw.porcelain && statusResult.raw.porcelain.trim()) {
      return res.status(400).json({ 
        error: 'Cannot pull: Base branch has uncommitted changes',
        hasUncommitted: true 
      });
    }
    
    // Pull updates for base branch
    const result = await gitService.sync(project.local_path, {
      branch: project.base_branch,
      remote: 'origin'
    });
    
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
    console.error('Pull error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Push base branch changes
router.post('/:id/push-base-branch', async (req, res) => {
  const { models } = req.services;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await GitService.configureCredentials(project.local_path, req.githubToken);
    
    const gitService = new GitService(req.githubToken);

    // Push base branch
    const result = await gitService.push(project.local_path, project.base_branch);
    
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
    console.error('Push error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Fetch remote updates for project
router.post('/:id/fetch', async (req, res) => {
  const { models } = req.services;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await GitService.configureCredentials(project.local_path, req.githubToken);
    
    const gitService = new GitService(req.githubToken);

    // Fetch with git (will use gh credential helper if configured)
    const result = await gitService.sync(project.local_path, {
      fetchOnly: true
    });

    // Get updated branch info
    const branchResult = await gitService.listBranches(project.local_path, {
      remote: true
    });
    const branches = branchResult.branches
      .map(b => b.name)
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
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check update status for all tasks
router.get('/:id/update-status', async (req, res) => {
  const { models } = req.services;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const tasks = await models.tasks.findByProjectId(project.id);
    const updateStatus = [];
    const gitService = new GitService(req.githubToken);

    for (const task of tasks) {
      if (!fsSync.existsSync(task.worktree_path)) continue;

      try {
        // Get current branch for the task
        const currentBranch = await gitService.getCurrentBranch(task.worktree_path);

        // Check if branch is behind origin/base_branch
        const behindResult = await gitService.execute(
          `git rev-list --count HEAD..origin/${project.base_branch}`,
          task.worktree_path
        );
        const behind = parseInt(behindResult.output.trim()) || 0;

        // Check if branch has unpushed commits to its own remote
        let ahead = 0;
        try {
          // First check if remote tracking branch exists
          const remoteCheckResult = await gitService.execute(
            `git rev-parse --verify origin/${task.branch} 2>/dev/null`,
            task.worktree_path
          );

          if (remoteCheckResult.success) {
            // Remote branch exists, count unpushed commits
            const counts = await gitService.getAheadBehindCounts(task.worktree_path, task.branch);
            ahead = counts.ahead;
          } else {
            // No remote branch, count all commits ahead of base branch
            const aheadResult = await gitService.execute(
              `git rev-list --count origin/${project.base_branch}..HEAD`,
              task.worktree_path
            );
            ahead = parseInt(aheadResult.output.trim()) || 0;
          }
        } catch (e) {
          // Fallback to comparing with base branch
          const aheadResult = await gitService.execute(
            `git rev-list --count origin/${project.base_branch}..HEAD`,
            task.worktree_path
          );
          ahead = parseInt(aheadResult.output.trim()) || 0;
        }

        // Check for uncommitted changes
        const statusResult = await gitService.getStatus(task.worktree_path);
        const hasUncommitted = statusResult.raw.porcelain.trim().length > 0;
        
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
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  const { models } = req.services;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get all tasks
    const tasks = await models.tasks.findByProjectId(project.id, true);
    
    // Remove all task worktrees
    for (const task of tasks) {
      try {
        if (fsSync.existsSync(task.worktree_path)) {
          await exec(`git worktree remove ${task.worktree_path}`, { cwd: project.local_path });
        }
      } catch (e) {
        // Ignore errors, worktree might already be gone
      }
    }
    
    // Optional: cleanup main repo
    if (req.body.cleanup && project.local_path && fsSync.existsSync(project.local_path)) {
      await exec(`rm -rf ${project.local_path}`);
    }
    
    // Delete from database (cascades to tasks and sessions)
    await models.projects.delete(project.id);
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;