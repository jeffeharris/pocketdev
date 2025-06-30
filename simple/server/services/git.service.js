import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Execute a git command in a project directory
 * @param {string} projectPath - Path to the project
 * @param {string} command - Git command to execute
 * @param {string} githubToken - Optional GitHub token for authentication
 * @returns {Promise<{success: boolean, output: string, error: string}>}
 */
export async function executeGitCommand(projectPath, command, githubToken = '') {
  try {
    const env = { ...process.env };
    if (githubToken) {
      env.GH_TOKEN = githubToken;
      env.GITHUB_TOKEN = githubToken;
    }
    
    // Add safe directory config to avoid dubious ownership errors
    const safeCommand = `git config --global --add safe.directory ${projectPath} 2>/dev/null; ${command}`;
    
    const { stdout, stderr } = await execAsync(safeCommand, { 
      cwd: projectPath,
      env,
      shell: '/bin/sh'
    });
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    return { success: false, output: '', error: error.message };
  }
}

/**
 * Configure git credentials and merge tools for a repository
 * @param {string} projectPath - Path to the project
 * @param {string} githubToken - Optional GitHub token
 */
export async function configureGitCredentials(projectPath, githubToken = '') {
  // Configure merge tool
  await execAsync(`git config merge.tool vimdiff`, { cwd: projectPath });
  await execAsync(`git config merge.conflictstyle diff3`, { cwd: projectPath });
  await execAsync(`git config mergetool.prompt false`, { cwd: projectPath });
  
  if (!githubToken) return;
  
  try {
    const { stdout: remoteUrl } = await execAsync('git remote get-url origin', { cwd: projectPath });
    
    if (remoteUrl.includes('github.com')) {
      // Configure git to use GitHub CLI as credential helper
      await execAsync(`git config credential.helper "!gh auth git-credential"`, { cwd: projectPath });
      
      // Make sure GH_TOKEN is set for the environment
      process.env.GH_TOKEN = githubToken;
      process.env.GITHUB_TOKEN = githubToken;
    }
  } catch (error) {
    console.error('Failed to configure git credentials:', error);
  }
}

/**
 * Check if a branch exists locally or remotely
 * @param {string} projectPath - Path to the project
 * @param {string} branchName - Name of the branch to check
 * @returns {Promise<{exists: boolean, isRemote: boolean}>}
 */
export async function checkBranchExists(projectPath, branchName) {
  try {
    // Check local branches
    const { stdout: localBranches } = await execAsync('git branch --list', { cwd: projectPath });
    const localExists = localBranches.split('\n').some(b => b.trim().replace('* ', '') === branchName);
    
    if (localExists) {
      return { exists: true, isRemote: false };
    }
    
    // Check remote branches
    const { stdout: remoteBranches } = await execAsync('git branch -r --list', { cwd: projectPath });
    const remoteExists = remoteBranches.split('\n').some(b => {
      const branch = b.trim();
      return branch === `origin/${branchName}` || branch.endsWith(`/${branchName}`);
    });
    
    return { exists: remoteExists, isRemote: remoteExists };
  } catch (error) {
    console.error('Error checking branch existence:', error);
    return { exists: false, isRemote: false };
  }
}

/**
 * Get the current commit SHA
 * @param {string} projectPath - Path to the project
 * @returns {Promise<string>}
 */
export async function getCurrentCommitSHA(projectPath) {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: projectPath });
    return stdout.trim();
  } catch (error) {
    console.error('Error getting current commit SHA:', error);
    return '';
  }
}

/**
 * Count commits between two refs
 * @param {string} projectPath - Path to the project
 * @param {string} fromRef - Starting reference
 * @param {string} toRef - Ending reference
 * @returns {Promise<number>}
 */
export async function countCommitsBetween(projectPath, fromRef, toRef) {
  try {
    const { stdout } = await execAsync(
      `git rev-list --count ${fromRef}..${toRef}`,
      { cwd: projectPath }
    );
    return parseInt(stdout.trim(), 10);
  } catch (error) {
    console.error('Error counting commits:', error);
    return 0;
  }
}

/**
 * Check if there are differences between two refs
 * @param {string} projectPath - Path to the project
 * @param {string} ref1 - First reference
 * @param {string} ref2 - Second reference
 * @returns {Promise<boolean>}
 */
export async function hasDifferencesBetween(projectPath, ref1, ref2) {
  try {
    const { stdout } = await execAsync(
      `git diff --name-only ${ref1}...${ref2}`,
      { cwd: projectPath }
    );
    return stdout.trim().length > 0;
  } catch (error) {
    console.error('Error checking differences:', error);
    return false;
  }
}

/**
 * Clean up a worktree
 * @param {string} projectPath - Path to the main project
 * @param {string} worktreePath - Path to the worktree
 * @returns {Promise<boolean>}
 */
export async function cleanupWorktree(projectPath, worktreePath) {
  try {
    // First try to remove the worktree properly
    await execAsync(`git worktree remove --force "${worktreePath}"`, { cwd: projectPath });
    return true;
  } catch (error) {
    // If that fails, try pruning
    try {
      await execAsync('git worktree prune', { cwd: projectPath });
      return true;
    } catch (pruneError) {
      console.error('Failed to cleanup worktree:', pruneError);
      return false;
    }
  }
}

export default {
  executeGitCommand,
  configureGitCredentials,
  checkBranchExists,
  getCurrentCommitSHA,
  countCommitsBetween,
  hasDifferencesBetween,
  cleanupWorktree
};