/**
 * Shared task assignment logic
 * Handles credential resolution and repository configuration
 */

export function prepareTaskAssignment(activeProject, projectConfigService, taskParams) {
  const { repository, branch, gitUsername, gitToken, ...otherParams } = taskParams;
  
  // Format repository with credentials
  let repoConfig = repository;
  let finalCredentials = { username: gitUsername, token: gitToken };
  
  // If no credentials provided, try to use active project
  if (!gitUsername || !gitToken) {
    if (activeProject?.config) {
      const projectCreds = projectConfigService.getCredentials(activeProject.config);
      if (projectCreds) {
        finalCredentials = projectCreds;
        // Use repository from active project if not provided
        if (!repository && activeProject.config.project.repository) {
          repoConfig = activeProject.config.project.repository;
        }
      }
    }
  }
  
  // Validate credentials
  if (!finalCredentials.username || !finalCredentials.token) {
    throw new Error('No credentials available. Configure project settings or provide credentials.');
  }
  
  // Format for container orchestrator
  const formattedRepo = {
    url: repoConfig,
    credentials: finalCredentials,
    branch: branch || activeProject?.config?.project?.default_branch || 'main'
  };
  
  return {
    ...otherParams,
    repository: formattedRepo
  };
}

export default { prepareTaskAssignment };