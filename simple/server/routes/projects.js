import { Router } from 'express';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fsSync from 'fs';
import config from '../config/index.js';
import { gitCommand, configureGitCredentials } from '../utils/git.js';

const exec = promisify(execCallback);
const router = Router();

// Create new project from repo
router.post('/', async (req, res) => {
  const { repoUrl, branch = 'main', projectName } = req.body;
  const { models, githubToken } = req.app.locals;
  
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
    
    if (githubToken && repoUrl.includes('github.com')) {
      if (repoUrl.startsWith('https://github.com/')) {
        cloneUrl = repoUrl.replace('https://github.com/', `https://${githubToken}@github.com/`);
      } else if (repoUrl.startsWith('git@github.com:')) {
        const repoPath = repoUrl.replace('git@github.com:', '').replace('.git', '');
        cloneUrl = `https://${githubToken}@github.com/${repoPath}.git`;
      }
    }
    
    await exec(`git clone ${cloneUrl} ${projectPath}`);
    
    if (cloneUrl !== repoUrl) {
      await exec(`git remote set-url origin ${repoUrl}`, { cwd: projectPath });
    }
    
    await exec(`git checkout ${branch}`, { cwd: projectPath });
    await configureGitCredentials(projectPath, githubToken);
    
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
  const { models } = req.app.locals;
  
  try {
    const projects = await models.projects.findAll();
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project details
router.get('/:id', async (req, res) => {
  const { models } = req.app.locals;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get current git status if local path exists
    let gitStatus = null;
    if (project.local_path && fsSync.existsSync(project.local_path)) {
      const status = await gitCommand(project.local_path, 'git status --porcelain');
      gitStatus = {
        status: status.output,
        hasChanges: status.output.trim().length > 0
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
  const { models } = req.app.locals;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    if (!fsSync.existsSync(project.local_path)) {
      return res.json({ behind: 0, ahead: 0, error: 'Project directory not found' });
    }
    
    try {
      // Fetch latest from remote to get accurate status
      await gitCommand(project.local_path, 'git fetch origin');
      
      // Check if base branch is behind its remote
      const behindResult = await gitCommand(project.local_path, 
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`);
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      // Check if base branch has unpushed commits
      const aheadResult = await gitCommand(project.local_path, 
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`);
      const ahead = parseInt(aheadResult.output.trim()) || 0;
      
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
  const { models, githubToken } = req.app.locals;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await configureGitCredentials(project.local_path, githubToken);
    
    // Check for uncommitted changes in base branch
    const statusResult = await gitCommand(project.local_path, 'git status --porcelain');
    if (statusResult.output && statusResult.output.trim()) {
      return res.status(400).json({ 
        error: 'Cannot pull: Base branch has uncommitted changes',
        hasUncommitted: true 
      });
    }
    
    // Pull updates for base branch
    const result = await gitCommand(project.local_path, 
      `git pull origin ${project.base_branch}`);
    
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
  const { models, githubToken } = req.app.locals;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await configureGitCredentials(project.local_path, githubToken);
    
    // Push base branch
    const result = await gitCommand(project.local_path, 
      `git push origin ${project.base_branch}`);
    
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
  const { models, githubToken } = req.app.locals;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Ensure git credentials are configured
    await configureGitCredentials(project.local_path, githubToken);
    
    // Fetch with git (will use gh credential helper if configured)
    const result = await gitCommand(project.local_path, 'git fetch --all --prune --tags');
    
    // Get updated branch info
    const branchResult = await gitCommand(project.local_path, 'git branch -r');
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
    console.error('Fetch error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check update status for all tasks
router.get('/:id/update-status', async (req, res) => {
  const { models } = req.app.locals;
  
  try {
    const project = await models.projects.findById(req.params.id);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    const tasks = await models.tasks.findByProjectId(project.id);
    const updateStatus = [];
    
    for (const task of tasks) {
      if (!fsSync.existsSync(task.worktree_path)) continue;
      
      try {
        // Check if branch is behind origin/base_branch
        const behindResult = await gitCommand(task.worktree_path, 
          `git rev-list --count HEAD..origin/${project.base_branch}`);
        const behind = parseInt(behindResult.output.trim()) || 0;
        
        // Check if branch has unpushed commits to its own remote
        let ahead = 0;
        try {
          // First check if remote tracking branch exists
          const remoteCheckResult = await gitCommand(task.worktree_path, 
            `git rev-parse --verify origin/${task.branch} 2>/dev/null`);
          
          if (remoteCheckResult.success) {
            // Remote branch exists, count unpushed commits
            const aheadResult = await gitCommand(task.worktree_path, 
              `git rev-list --count origin/${task.branch}..HEAD`);
            ahead = parseInt(aheadResult.output.trim()) || 0;
          } else {
            // No remote branch, count all commits ahead of base branch
            const aheadResult = await gitCommand(task.worktree_path, 
              `git rev-list --count origin/${project.base_branch}..HEAD`);
            ahead = parseInt(aheadResult.output.trim()) || 0;
          }
        } catch (e) {
          // Fallback to comparing with base branch
          const aheadResult = await gitCommand(task.worktree_path, 
            `git rev-list --count origin/${project.base_branch}..HEAD`);
          ahead = parseInt(aheadResult.output.trim()) || 0;
        }
        
        // Check for uncommitted changes
        const statusResult = await gitCommand(task.worktree_path, 'git status --porcelain');
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
    res.status(500).json({ error: error.message });
  }
});

// Delete project
router.delete('/:id', async (req, res) => {
  const { models } = req.app.locals;
  
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