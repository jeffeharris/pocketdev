import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import crypto from 'crypto';

/**
 * ProjectService - Handles all project-related business operations
 * 
 * This service provides a clean interface for project management operations,
 * hiding the complexity of git cloning, credential setup, branch management,
 * filesystem operations, and status aggregation.
 * 
 * Following deep module principles: simple interface (10-12 methods), 
 * complex implementation handling project lifecycle, git operations,
 * and dashboard data aggregation.
 */
export class ProjectService {
  constructor(models, gitServiceService, projectsDir = process.env.PROJECTS_DIR || path.join(process.cwd(), '../projects')) {
    this.models = models;
    this.gitServiceService = gitServiceService;
    this.projectsDir = projectsDir;
  }

  /**
   * Create a new project with git clone and setup
   * @param {Object} projectData - Project creation data
   * @param {Object} gitService - GitService instance for git operations
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Created project with metadata
   */
  async createProject(projectData, gitService, options = {}) {
    const { repoUrl, branch = 'main', projectName } = projectData;
    
    if (!repoUrl) {
      throw new Error('Repository URL is required');
    }
    
    // Generate project ID and paths
    const projectId = crypto.randomBytes(8).toString('hex');
    const projectPath = path.join(this.projectsDir, projectId);
    
    // Extract project name from URL if not provided
    const finalProjectName = projectName || repoUrl.split('/').pop().replace('.git', '');
    
    try {
      // Clone repository
      console.log(`Cloning ${repoUrl} to ${projectPath}...`);
      const cloneResult = await gitService.command(
        this.projectsDir,
        `git clone ${repoUrl} ${projectId}`
      );
      
      if (!cloneResult.success) {
        throw new Error(`Failed to clone repository: ${cloneResult.error}`);
      }
      
      // Configure git credentials
      await gitService.configureCredentials(projectPath);
      
      // Checkout branch if different from default
      if (branch && branch !== 'main') {
        const checkoutResult = await gitService.checkout(projectPath, branch);
        
        if (!checkoutResult.success) {
          // Clean up on failure
          await fs.rm(projectPath, { recursive: true, force: true });
          throw new Error(`Failed to checkout branch ${branch}: ${checkoutResult.error}`);
        }
      }
      
      // Save project to database
      const project = await this.models.projects.create({
        id: projectId,
        name: finalProjectName,
        repoUrl: repoUrl,
        baseBranch: branch,
        localPath: projectPath
      });
      
      // Create default planning document
      await this._createDefaultPlanningDocument(project, repoUrl, branch, gitService);
      
      // Get GitHub metadata if available
      const projectWithMetadata = await this._enrichWithGitHubMetadata(project, repoUrl);
      
      return {
        success: true,
        project: projectWithMetadata
      };
    } catch (error) {
      // Cleanup on failure
      try {
        if (fsSync.existsSync(projectPath)) {
          await fs.rm(projectPath, { recursive: true, force: true });
        }
      } catch (cleanupError) {
        console.error('Failed to cleanup after project creation failure:', cleanupError);
      }
      throw error;
    }
  }

  /**
   * Delete a project with complete cleanup
   * @param {string} projectId - Project ID to delete
   * @param {Object} options - Deletion options
   * @returns {Promise<Object>} Deletion result
   */
  async deleteProject(projectId, options = {}) {
    const { force = false } = options;
    
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Check for active tasks before deletion
    const activeTasks = await this.models.tasks.findByProjectId(projectId, false);
    if (activeTasks.length > 0 && !force) {
      throw new Error(`Cannot delete project: ${activeTasks.length} active tasks exist. Use force option to override.`);
    }
    
    // Clean up all tasks first
    if (activeTasks.length > 0) {
      for (const task of activeTasks) {
        try {
          // Clean up task worktrees and sessions
          if (task.worktree_path && fsSync.existsSync(task.worktree_path)) {
            await fs.rm(task.worktree_path, { recursive: true, force: true });
          }
          
          // Archive task in database
          await this.models.tasks.archive(task.id);
        } catch (error) {
          console.error(`Failed to cleanup task ${task.id}:`, error);
        }
      }
    }
    
    // Delete project directory
    try {
      if (project.local_path && fsSync.existsSync(project.local_path)) {
        await fs.rm(project.local_path, { recursive: true, force: true });
      }
    } catch (error) {
      console.error('Failed to delete project directory:', error);
    }
    
    // Archive project in database
    await this.models.projects.archive(projectId);
    
    return {
      success: true,
      message: 'Project deleted successfully',
      cleanedTasks: activeTasks.length
    };
  }

  /**
   * Get project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Project details
   */
  async getProject(projectId) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    return project;
  }

  /**
   * Get minimal project info for fast loading
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Minimal project details
   */
  async getProjectMinimal(projectId) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Return just the project info - no git operations
    return {
      id: project.id,
      name: project.name,
      repository: project.repo_url,
      baseBranch: project.base_branch,
      created: project.created_at,
      local_path: project.local_path
    };
  }

  /**
   * Trigger background refresh of git status
   * @param {string} projectId - Project ID
   * @param {string} githubToken - GitHub token for authentication
   * @returns {Promise<Object>} Refresh status
   */
  async refreshProjectStatus(projectId, githubToken) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Trigger git fetch in background (non-blocking)
    const repository = new GitRepository(githubToken);
    repository.fetch(project.local_path)
      .then(() => console.log(`Background fetch completed for project ${projectId}`))
      .catch(err => console.error(`Background fetch failed for project ${projectId}:`, err));
    
    // Return immediately
    return { 
      message: 'Refresh triggered',
      projectId 
    };
  }

  /**
   * List all active projects
   * @returns {Promise<Array>} List of active projects
   */
  async listProjects() {
    return await this.models.projects.findActive();
  }

  /**
   * Update project metadata
   * @param {string} projectId - Project ID
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} Updated project
   */
  async updateProject(projectId, updates) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Validate allowed updates
    const allowedUpdates = ['name', 'description', 'baseBranch', 'metadata'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = value;
      }
    }
    
    if (Object.keys(filteredUpdates).length === 0) {
      throw new Error('No valid updates provided');
    }
    
    // Update project in database
    await this.models.projects.update(projectId, filteredUpdates);
    
    // Return updated project
    return await this.models.projects.findById(projectId);
  }

  /**
   * Get project branch information and management
   * @param {string} projectId - Project ID
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Branch information and operations
   */
  async getProjectBranches(projectId, gitService) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    
    // Get all branches
    const branchResult = await gitService.command(
      project.local_path,
      'git branch -a'
    );
    
    if (!branchResult.success) {
      throw new Error(`Failed to list branches: ${branchResult.error}`);
    }
    
    // Parse branches
    const branches = branchResult.output
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
    
    return {
      branches,
      currentBranch: branches.find(b => b.isCurrent)?.name,
      baseBranch: project.base_branch
    };
  }

  /**
   * Create a new branch in the project
   * @param {string} projectId - Project ID
   * @param {Object} branchData - Branch creation data
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Branch creation result
   */
  async createProjectBranch(projectId, branchData, gitService) {
    const { branchName, fromBranch = 'main' } = branchData;
    
    if (!branchName) {
      throw new Error('Branch name is required');
    }
    
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    
    // Create branch
    const result = await gitService.command(
      project.local_path,
      `git checkout -b ${branchName} ${fromBranch}`
    );
    
    if (!result.success) {
      throw new Error(`Failed to create branch: ${result.error}`);
    }
    
    return {
      success: true,
      branch: branchName,
      fromBranch,
      output: result.output
    };
  }

  /**
   * Fetch updates from remote repository
   * @param {string} projectId - Project ID
   * @param {string} githubToken - GitHub token for authentication
   * @returns {Promise<Object>} Fetch result with branches
   */
  async fetchProject(projectId, githubToken) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      const error = new Error('Project not found');
      error.statusCode = 404;
      throw error;
    }
    
    // Get git config from settings
    const gitUserName = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_name']
    );
    
    const gitUserEmail = await this.models.db.get(
      'SELECT value FROM settings WHERE key = ?',
      ['git_user_email']
    );
    
    const gitConfig = {
      name: gitUserName?.value || 'PocketDev User',
      email: gitUserEmail?.value || 'user@pocketdev.local'
    };
    
    // Ensure git credentials are configured
    await GitRepository.configureCredentials(project.local_path, githubToken, gitConfig);
    
    // Fetch with git
    const repository = new GitRepository(githubToken);
    const result = await repository.fetch(project.local_path, { all: true, prune: true });
    
    // Get updated branch info
    const branchResult = await repository.execute('git branch -r', project.local_path);
    
    const branches = branchResult.output
      .split('\n')
      .filter(b => b.trim())
      .map(b => b.trim().replace('origin/', ''));
    
    await this.models.projects.updateLastAccessed(project.id);
    
    return { 
      success: result.success, 
      output: result.output,
      branches: branches
    };
  }

  /**
   * Sync project with remote repository
   * @param {string} projectId - Project ID  
   * @param {string} gitService - GitHub token for git operations
   * @param {Object} options - Sync options
   * @returns {Promise<Object>} Sync result
   */
  async syncProject(projectId, gitService, options = {}) {
    const { fetchOnly = false } = options;
    
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    
    // Fetch from remote
    const fetchResult = await gitService.command(
      project.local_path,
      'git fetch --all --prune --tags'
    );
    
    if (!fetchResult.success) {
      throw new Error(`Failed to fetch: ${fetchResult.error}`);
    }
    
    let pullResult = null;
    if (!fetchOnly) {
      // Pull current branch
      pullResult = await gitService.command(
        project.local_path,
        'git pull'
      );
    }
    
    // Update project last accessed
    await this.models.projects.updateLastAccessed(projectId);
    
    return {
      success: true,
      fetch: fetchResult.output,
      pull: pullResult?.output,
      message: fetchOnly ? 'Project fetched successfully' : 'Project synced successfully'
    };
  }

  // Private helper methods

  /**
   * Create default planning document for new project
   * @private
   */
  async _createDefaultPlanningDocument(project, repoUrl, branch, gitService) {
    const planningTemplate = `# Project Planning: ${project.name}

## 🎯 Project Overview
${project.name} - Created on ${new Date().toLocaleDateString()}

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

    try {
      // Try to create via GitHub API for GitHub repositories
      if (repoUrl.includes('github.com')) {
        const success = await this._createPlanningViaGitHubAPI(
          repoUrl, 
          branch, 
          planningTemplate, 
          gitService,
          project
        );
        
        if (success) {
          // Pull the changes to sync local repository
                await gitService.command(
            project.local_path,
            `git pull origin ${branch}`
          );
          return;
        }
      }
      
      // Fallback to local file creation
      const planningPath = path.join(project.local_path, '.pocketdev', 'PLANNING.md');
      await fs.mkdir(path.dirname(planningPath), { recursive: true });
      await fs.writeFile(planningPath, planningTemplate, 'utf8');
    } catch (error) {
      console.error('Failed to create default PLANNING.md:', error);
      // Don't fail project creation if planning file creation fails
    }
  }

  /**
   * Create planning document via GitHub API
   * @private
   */
  async _createPlanningViaGitHubAPI(repoUrl, branch, content, gitService, project) {
    try {
      const [owner, repo] = repoUrl.split('github.com/')[1].replace('.git', '').split('/');
      
      // Create the file using GitHub API via gh CLI
      const base64Content = Buffer.from(content).toString('base64');
      const createFileCommand = `gh api repos/${owner}/${repo}/contents/.pocketdev/PLANNING.md \
        -X PUT \
        -f message="Add PocketDev project planning file" \
        -f content="${base64Content}" \
        -f branch="${branch}"`;
      
        const createResult = await gitService.command(
        project.local_path,
        createFileCommand
      );
      
      if (createResult.success) {
        console.log('Created default PLANNING.md on GitHub for project:', project.name);
        return true;
      } else {
        console.error('Failed to create PLANNING.md via GitHub API:', createResult.error);
        return false;
      }
    } catch (error) {
      console.error('Error creating planning file via GitHub API:', error);
      return false;
    }
  }

  /**
   * Get base branch sync status for project
   * @param {string} projectId - Project ID
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Base branch status
   */
  async getBaseBranchStatus(projectId, gitService) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    if (!fsSync.existsSync(project.local_path)) {
      return { 
        behind: 0, 
        ahead: 0, 
        error: 'Project directory not found' 
      };
    }
    
    try {
        
      // Fetch latest from remote to get accurate status
      await gitService.command(project.local_path, 'git fetch origin');
      
      // Check if base branch is behind its remote
      const behindResult = await gitService.command(
        project.local_path,
        `git rev-list --count ${project.base_branch}..origin/${project.base_branch}`
      );
      const behind = parseInt(behindResult.output.trim()) || 0;
      
      // Check if base branch has unpushed commits
      const aheadResult = await gitService.command(
        project.local_path,
        `git rev-list --count origin/${project.base_branch}..${project.base_branch}`
      );
      const ahead = parseInt(aheadResult.output.trim()) || 0;
      
      return { 
        behind, 
        ahead, 
        branch: project.base_branch 
      };
    } catch (error) {
      return { 
        behind: 0, 
        ahead: 0, 
        error: error.message 
      };
    }
  }

  /**
   * Pull base branch updates
   * @param {string} projectId - Project ID
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Pull result
   */
  async pullBaseBranch(projectId, gitService) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    
    // Check for uncommitted changes in base branch
    const statusResult = await gitService.getStatus(project.local_path);
    
    if (statusResult.output && statusResult.output.trim()) {
      throw new Error('Cannot pull: Base branch has uncommitted changes');
    }
    
    // Pull updates for base branch
    const result = await gitService.command(
      project.local_path,
      `git pull origin ${project.base_branch}`
    );
    
    if (!result.success) {
      throw new Error(`Pull failed: ${result.error}`);
    }
    
    await this.models.projects.updateLastAccessed(project.id);
    
    return {
      success: true,
      output: result.output,
      message: `Successfully pulled updates to ${project.base_branch}`
    };
  }

  /**
   * Push base branch changes
   * @param {string} projectId - Project ID
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Push result
   */
  async pushBaseBranch(projectId, gitService) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    
    // Push base branch
    const result = await gitService.command(
      project.local_path,
      `git push origin ${project.base_branch}`
    );
    
    if (!result.success) {
      throw new Error(`Push failed: ${result.error}`);
    }
    
    await this.models.projects.updateLastAccessed(project.id);
    
    return {
      success: true,
      output: result.output,
      message: `Successfully pushed ${project.base_branch} to origin`
    };
  }

  /**
   * Get comprehensive dashboard data for project
   * @param {string} projectId - Project ID
   * @param {string} gitService - GitHub token for git operations
   * @param {Object} options - Dashboard options
   * @returns {Promise<Object>} Complete dashboard data
   */
  async getProjectDashboard(projectId, gitService, options = {}) {
    const { cached = false } = options;
    
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // Get all active tasks for this project
    const tasks = await this.models.tasks.findByProjectId(projectId, false);
    const needsAttention = [];
    
    // 1. Check base branch sync status
    if (!cached) {
      try {
        const branchStatus = await this.getBaseBranchStatus(projectId, gitService);
        
        if (branchStatus.behind > 0) {
          needsAttention.push({
            type: 'base-behind',
            severity: 'warning',
            message: `Base branch is ${branchStatus.behind} commits behind origin`,
            details: { behind: branchStatus.behind, branch: project.base_branch },
            actions: ['pull']
          });
        }
        
        if (branchStatus.ahead > 0) {
          needsAttention.push({
            type: 'base-ahead',
            severity: 'info',
            message: `Local base is ${branchStatus.ahead} commits ahead of origin`,
            details: { ahead: branchStatus.ahead, branch: project.base_branch },
            actions: ['push']
          });
        }
      } catch (error) {
        console.error('Git status check failed:', error);
      }
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
      
      // 3. Check for merge conflicts (if not cached)
      if (!cached && task.status === 'active' && task.worktree_path) {
        try {
                const mergeResult = await gitService.command(
            task.worktree_path,
            `git merge-tree $(git merge-base HEAD origin/${project.base_branch}) HEAD origin/${project.base_branch}`
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
    
    // 4. Check for open PRs (if not cached and GitHub token available)
    if (!cached && gitService) {
      try {
            const prResult = await gitService.command(
          project.local_path,
          `gh pr list --state open --json number,title,url,author,createdAt`
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
        console.error('PR check failed:', error);
      }
    }
    
    return {
      project,
      needsAttention,
      tasksCount: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'active').length,
      cached,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get project planning document content
   * @param {string} projectId - Project ID
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Planning document content
   */
  async getProjectPlanning(projectId, gitService) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    // First try to read from the filesystem directly
    const planningPath = path.join(project.local_path, '.pocketdev', 'PLANNING.md');
    try {
      const fileContent = await fs.readFile(planningPath, 'utf8');
      return { 
        exists: true, 
        content: fileContent 
      };
    } catch (fsError) {
      // File doesn't exist on filesystem, try git
    }
    
    // Try to read from git
    try {
        const result = await gitService.command(
        project.local_path,
        `git show ${project.base_branch}:.pocketdev/PLANNING.md`
      );
      
      if (result.success) {
        return { 
          exists: true, 
          content: result.output 
        };
      } else {
        return { 
          exists: false, 
          content: null 
        };
      }
    } catch (error) {
      throw new Error(`Failed to read PLANNING.md: ${error.message}`);
    }
  }

  /**
   * Update project planning document
   * @param {string} projectId - Project ID
   * @param {string} content - New planning content
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Update result
   */
  async updateProjectPlanning(projectId, content, gitService) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    
    // Ensure we're on the base branch
    await gitService.command(
      project.local_path,
      `git checkout ${project.base_branch}`
    );
    
    // Create .pocketdev directory if it doesn't exist
    const pocketdevDir = path.join(project.local_path, '.pocketdev');
    await fs.mkdir(pocketdevDir, { recursive: true });
    
    // Write the PLANNING.md file
    const planningPath = path.join(pocketdevDir, 'PLANNING.md');
    await fs.writeFile(planningPath, content, 'utf8');
    
    // Add and commit the file
    await gitService.command(
      project.local_path,
      'git add .pocketdev/PLANNING.md'
    );
    
    const commitResult = await gitService.command(
      project.local_path,
      `git commit -m "Update PLANNING.md for project ${project.name}" || echo "No changes to commit"`
    );
    
    return {
      success: true,
      message: 'PLANNING.md updated successfully',
      needsPush: commitResult.output.includes('file changed')
    };
  }

  /**
   * Get update status for all tasks in project
   * @param {string} projectId - Project ID
   * @param {string} gitService - GitHub token for git operations
   * @returns {Promise<Object>} Update status for all tasks
   */
  async getProjectTasksUpdateStatus(projectId, gitService) {
    const project = await this.models.projects.findById(projectId);
    if (!project) {
      throw new Error('Project not found');
    }
    
    const tasks = await this.models.tasks.findByProjectId(project.id);
    const updateStatus = [];
    
    for (const task of tasks) {
      if (!fsSync.existsSync(task.worktree_path)) continue;
      
      try {
        // Check if branch is behind origin/base_branch
        const behindResult = await gitService.command(
          task.worktree_path,
          `git rev-list --count HEAD..origin/${project.base_branch}`
        );
        const behind = parseInt(behindResult.output.trim()) || 0;
        
        // Check if branch has unpushed commits
        let ahead = 0;
        try {
          // First check if remote tracking branch exists
          const remoteCheckResult = await gitService.command(
            task.worktree_path,
            `git rev-parse --verify origin/${task.branch} 2>/dev/null`
          );
          
          if (remoteCheckResult.success) {
            // Remote branch exists, count unpushed commits
            const aheadResult = await gitService.command(
              task.worktree_path,
              `git rev-list --count origin/${task.branch}..HEAD`
            );
            ahead = parseInt(aheadResult.output.trim()) || 0;
          } else {
            // No remote branch, count all commits ahead of base branch
            const aheadResult = await gitService.command(
              task.worktree_path,
              `git rev-list --count origin/${project.base_branch}..HEAD`
            );
            ahead = parseInt(aheadResult.output.trim()) || 0;
          }
        } catch (e) {
          // Fallback to comparing with base branch
          const aheadResult = await gitService.command(
            task.worktree_path,
            `git rev-list --count origin/${project.base_branch}..HEAD`
          );
          ahead = parseInt(aheadResult.output.trim()) || 0;
        }
        
        // Check for uncommitted changes
        const statusResult = await gitService.getStatus(task.worktree_path);
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
    
    return { updateStatus };
  }

  // Private helper methods

  /**
   * Create default planning document for new project
   * @private
   */

  /**
   * Enrich project with GitHub metadata
   * @private
   */
  async _enrichWithGitHubMetadata(project, repoUrl) {
    try {
      // This would typically use a GitHub API service
      // For now, we'll extract basic info from the URL
      if (repoUrl.includes('github.com')) {
        const [owner, repo] = repoUrl.split('github.com/')[1].replace('.git', '').split('/');
        
        const enrichedProject = {
          ...project,
          github_owner: owner,
          github_repo: repo
        };
        
        // Update project with metadata
        await this.models.projects.update(project.id, {
          metadata: {
            github_owner: owner,
            github_repo: repo
          }
        });
        
        return enrichedProject;
      }
      
      return project;
    } catch (error) {
      console.error('Failed to enrich with GitHub metadata:', error);
      return project;
    }
  }
}