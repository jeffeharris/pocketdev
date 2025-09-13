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
    return await this.gitService.getStatus(projectPath);
  }

  async getProjectBranches(projectPath, options = {}) {
    return await this.gitService.listBranches(projectPath, options);
  }

  async createBranch(projectPath, branchName, fromBranch = null) {
    if (fromBranch) {
      await this.gitService.checkoutBranch(projectPath, fromBranch);
    }
    return await this.gitService.createBranch(projectPath, branchName, { checkout: true });
  }

  async checkoutBranch(projectPath, branch) {
    return await this.gitService.checkoutBranch(projectPath, branch);
  }

  async getCommitHistory(projectPath, limit = 50) {
    const commits = await this.gitService.getCommits(projectPath, { limit, oneline: true });
    return { success: true, commits };
  }

  async getBaseBranchStatus(projectPath, baseBranch) {
    // Get current branch info
    const currentBranch = await this.gitService.getCurrentBranch(projectPath);
    
    // Check if we're behind base branch
    if (currentBranch !== baseBranch) {
      await this.checkoutBranch(projectPath, baseBranch);
    }
    
    const status = await this.gitService.getStatus(projectPath);
    return {
      behind: status.behind || 0,
      ahead: status.ahead || 0,
      branch: baseBranch
    };
  }

  async mergeTaskBranch(projectPath, taskBranch, baseBranch) {
    // Checkout base branch
    await this.checkoutBranch(projectPath, baseBranch);
    
    // Merge task branch
    return await this.gitService.merge(projectPath, taskBranch, { checkConflicts: false });
  }
}