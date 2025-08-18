/**
 * Git Core Service
 * 
 * This file exports the deep git modules and utility functions.
 * Services should import the specific modules they need directly.
 */

// Export the deep modules - services should use these directly
export { GitRepository } from './git-repository.service.js';
export { GitWorkingTree } from './git-workingtree.service.js';
export { GitAnalyzer } from './git-analyzer.service.js';

// Import modules for utility functions (GitExecutor is internal only)
import { GitRepository } from './git-repository.service.js';
import { GitWorkingTree } from './git-workingtree.service.js';

/**
 * Execute git command utility function
 */
export async function executeGitCommand(command, workingDirectory, githubToken = null) {
  const repository = new GitRepository(githubToken);
  return repository.execute(command, workingDirectory);
}

/**
 * Configure git credentials utility function
 */
export async function configureGitCredentials(workingDirectory, githubToken, gitConfig = null) {
  const repository = new GitRepository(githubToken);
  const workingTree = new GitWorkingTree(githubToken, gitConfig);
  
  // Use provided git config or defaults
  const config = gitConfig || { name: 'PocketDev User', email: 'user@pocketdev.local' };
  
  const commands = [
    `git config user.name "${config.name}"`,
    `git config user.email "${config.email}"`
  ];

  // If we have a GitHub token, configure credential helper
  if (githubToken) {
    // Check if remote is GitHub
    const remoteResult = await repository.execute('git remote get-url origin', workingDirectory);
    if (remoteResult.success && remoteResult.output.includes('github.com')) {
      // Extract the GitHub URL
      const remoteUrl = remoteResult.output.trim();
      
      // Remove any existing authentication from the URL
      let cleanUrl = remoteUrl;
      const urlMatch = remoteUrl.match(/https:\/\/([^@]+@)?github\.com\/(.+)/);
      if (urlMatch) {
        cleanUrl = `https://github.com/${urlMatch[2]}`;
      }
      
      // Create authenticated URL with the new token
      const authenticatedUrl = cleanUrl.replace('https://github.com/', `https://x-access-token:${githubToken}@github.com/`);
      
      
      // Update the remote URL directly
      const setUrlResult = await repository.execute(`git remote set-url origin "${authenticatedUrl}"`, workingDirectory);
      if (!setUrlResult.success) {
        console.error('[configureGitCredentials] Failed to set remote URL:', setUrlResult.error);
        return setUrlResult;
      }
    }
  }

  for (const command of commands) {
    const result = await repository.execute(command, workingDirectory);
    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}