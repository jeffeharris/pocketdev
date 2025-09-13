/**
 * ProjectPlanningManager - Handles project planning documents and GitHub integration
 */
import path from 'path';
import fs from 'fs/promises';

export class ProjectPlanningManager {
  constructor(githubService, projectsDir = '/projects') {
    this.githubService = githubService;
    this.projectsDir = projectsDir;
  }

  async getPlanningContent(projectPath) {
    const planningPath = path.join(projectPath, '.pocketdev', 'PLANNING.md');
    
    try {
      const content = await fs.readFile(planningPath, 'utf-8');
      return {
        exists: true,
        content,
        path: planningPath
      };
    } catch (error) {
      return {
        exists: false,
        content: null,
        path: planningPath
      };
    }
  }

  async updatePlanningContent(projectPath, content) {
    const planningDir = path.join(projectPath, '.pocketdev');
    const planningPath = path.join(planningDir, 'PLANNING.md');
    
    // Ensure directory exists
    await fs.mkdir(planningDir, { recursive: true });
    
    // Write the content
    await fs.writeFile(planningPath, content, 'utf-8');
    
    return planningPath;
  }

  async createDefaultPlanningDocument(project, repoUrl) {
    const content = `# ${project.name} - Development Planning

## Project Overview
Repository: ${repoUrl}
Created: ${new Date().toISOString()}

## Goals
- [ ] Define project objectives
- [ ] Set up development environment
- [ ] Implement core features

## Tasks
<!-- Add your development tasks here -->

## Notes
<!-- Add any additional notes or documentation -->
`;
    
    const projectPath = path.join(this.projectsDir, project.id);
    return await this.updatePlanningContent(projectPath, content);
  }

  async createPlanningViaGitHub(repoUrl, branch, content, githubToken) {
    if (!this.githubService || !githubToken) {
      throw new Error('GitHub service and token required for remote planning creation');
    }
    
    // Extract owner and repo from URL
    const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (!match) {
      throw new Error('Invalid GitHub repository URL');
    }
    
    const [, owner, repo] = match;
    const path = '.pocketdev/PLANNING.md';
    
    // Create or update the file via GitHub API
    return await this.githubService.createOrUpdateFile(
      owner,
      repo,
      path,
      content,
      `Add PocketDev planning document`,
      branch,
      githubToken
    );
  }

  async generateDashboard(project, tasks, gitStatus) {
    const activeTasks = tasks.filter(t => t.status === 'active').length;
    const completedTasks = tasks.filter(t => t.status === 'completed').length;
    const totalTasks = tasks.length;
    
    const dashboard = {
      project: {
        id: project.id,
        name: project.name,
        base_branch: project.base_branch,
        created_at: project.created_at,
        updated_at: project.updated_at
      },
      statistics: {
        total_tasks: totalTasks,
        active_tasks: activeTasks,
        completed_tasks: completedTasks,
        completion_rate: totalTasks > 0 ? (completedTasks / totalTasks * 100).toFixed(1) : 0
      },
      git_status: gitStatus,
      tasks: tasks.map(t => ({
        id: t.id,
        name: t.name,
        branch: t.branch,
        status: t.status,
        created_at: t.created_at,
        updated_at: t.updated_at
      }))
    };
    
    return dashboard;
  }

  async enrichWithGitHubMetadata(project, repoUrl, githubToken) {
    if (!this.githubService || !githubToken) {
      return project;
    }
    
    try {
      // Extract owner and repo from URL
      const match = repoUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (!match) return project;
      
      const [, owner, repo] = match;
      
      // Fetch repository metadata
      const metadata = await this.githubService.getRepositoryInfo(
        owner,
        repo,
        githubToken
      );
      
      return {
        ...project,
        github: {
          stars: metadata.stargazers_count,
          forks: metadata.forks_count,
          open_issues: metadata.open_issues_count,
          description: metadata.description,
          topics: metadata.topics || [],
          default_branch: metadata.default_branch,
          visibility: metadata.visibility || 'public'
        }
      };
    } catch (error) {
      // If GitHub metadata fetch fails, return project as-is
      console.warn('Failed to fetch GitHub metadata:', error.message);
      return project;
    }
  }
}