/**
 * ProjectGitOperations - Handles all git operations for projects
 */
import path from 'path';
import fs from 'fs/promises';

export class ProjectGitOperations {
  constructor(gitService, githubTokenService, projectsDir = '/projects') {
    this.gitService = gitService;
    this.githubTokenService = githubTokenService;
    this.projectsDir = projectsDir;
  }

  async cloneProject(repoUrl, projectId, branch = 'main', githubToken = null) {
    const projectPath = path.join(this.projectsDir, projectId);
    
    // Clone with authentication if token provided
    const cloneResult = await this.gitService.clone(
      repoUrl,
      projectPath,
      { branch }
    );
    
    if (!cloneResult.success) {
      throw new Error(`Failed to clone repository: ${cloneResult.error}`);
    }
    
    // Configure git credentials
    if (githubToken) {
      await this.gitService.constructor.configureCredentials(projectPath, githubToken);
    }
    
    return projectPath;
  }

  async fetchProject(projectPath) {
    return await this.gitService.sync(projectPath, { fetchOnly: true });
  }

  async pullProject(projectPath, branch) {
    return await this.gitService.sync(projectPath, { branch });
  }

  async pushProject(projectPath, branch, options = {}) {
    return await this.gitService.push(projectPath, branch, options);
  }

  async getProjectStatus(projectPath) {
    return await this.gitService.info(projectPath, 'status');
  }

  async getProjectBranches(projectPath, options = {}) {
    return await this.gitService.info(projectPath, 'branches', options);
  }

  async createBranch(projectPath, branchName, fromBranch = null) {
    if (fromBranch) {
      await this.gitService.branch(projectPath, 'checkout', fromBranch);
    }
    return await this.gitService.branch(projectPath, 'create', branchName, { checkout: true });
  }

  async checkoutBranch(projectPath, branch) {
    return await this.gitService.branch(projectPath, 'checkout', branch);
  }

  async getCommitHistory(projectPath, limit = 50) {
    return await this.gitService.info(projectPath, 'log', { limit, oneline: true });
  }

  async getBaseBranchStatus(projectPath, baseBranch) {
    // Get current branch info
    const currentInfo = await this.gitService.info(projectPath, 'current');
    
    // Check if we're behind base branch
    if (currentInfo.branch !== baseBranch) {
      await this.checkoutBranch(projectPath, baseBranch);
      const status = await this.gitService.info(projectPath, 'current');
      return {
        behind: status.behind || 0,
        ahead: status.ahead || 0,
        branch: baseBranch
      };
    }
    
    return {
      behind: currentInfo.behind || 0,
      ahead: currentInfo.ahead || 0,
      branch: currentInfo.branch
    };
  }

  async mergeTaskBranch(projectPath, taskBranch, baseBranch) {
    // Checkout base branch
    await this.checkoutBranch(projectPath, baseBranch);
    
    // Merge task branch
    return await this.gitService.merge(projectPath, taskBranch, { checkConflicts: false });
  }
}