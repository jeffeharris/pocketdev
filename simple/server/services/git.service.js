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
  // Configure merge tool globally to avoid permission issues
  await execAsync(`git config --global merge.tool vimdiff`, { cwd: projectPath });
  await execAsync(`git config --global merge.conflictstyle diff3`, { cwd: projectPath });
  await execAsync(`git config --global mergetool.prompt false`, { cwd: projectPath });
  
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

/**
 * GitService class for object-oriented usage
 */
export class GitService {
  constructor(githubToken = '', gitConfig = null) {
    this.githubToken = githubToken || process.env.GITHUB_TOKEN || '';
    this.gitConfig = gitConfig || {
      name: 'PocketDev User',
      email: 'user@pocketdev.local'
    };
  }

  async command(projectPath, command) {
    return executeGitCommand(projectPath, command, this.githubToken);
  }

  async ensureGitConfig(projectPath) {
    // Check if git config is already set
    const nameResult = await this.command(projectPath, 'git config user.name');
    const emailResult = await this.command(projectPath, 'git config user.email');
    
    // Set config if not already set
    if (!nameResult.output.trim() && this.gitConfig.name) {
      await this.command(projectPath, `git config user.name "${this.gitConfig.name}"`);
    }
    if (!emailResult.output.trim() && this.gitConfig.email) {
      await this.command(projectPath, `git config user.email "${this.gitConfig.email}"`);
    }
  }

  async configureCredentials(projectPath) {
    return configureGitCredentials(projectPath, this.githubToken);
  }

  async getStatus(projectPath) {
    return this.command(projectPath, 'git status --porcelain');
  }

  /**
   * Get detailed git status including staged, unstaged, and untracked file counts
   * @param {string} projectPath - Path to the project
   * @returns {Promise<{staged: number, unstaged: number, untracked: number, files: Array, raw: string}>}
   */
  async getDetailedStatus(projectPath) {
    const result = await this.command(projectPath, 'git status --porcelain');
    
    let staged = 0;
    let unstaged = 0;
    let untracked = 0;
    const files = [];
    
    // Parse each line of porcelain output
    // Format: XY filename where X = index status, Y = working tree status
    result.output.split('\n').forEach(line => {
      if (!line.trim()) return;
      
      const indexStatus = line[0];  // First char = staged status
      const workingStatus = line[1]; // Second char = unstaged status
      const filePath = line.substring(3).trim();
      
      // Count untracked files separately
      if (indexStatus === '?' && workingStatus === '?') {
        untracked++;
      } else {
        // Count staged files (index status not ' ')
        if (indexStatus !== ' ') {
          staged++;
        }
        
        // Count unstaged files (working tree status not ' ')
        if (workingStatus !== ' ') {
          unstaged++;
        }
      }
      
      files.push({
        path: filePath,
        staged: indexStatus !== ' ' && indexStatus !== '?',
        unstaged: workingStatus !== ' ' && workingStatus !== '?',
        untracked: indexStatus === '?' && workingStatus === '?',
        status: line.substring(0, 2)
      });
    });
    
    return { 
      staged, 
      unstaged,
      untracked, 
      files, 
      raw: result.output,
      success: result.success 
    };
  }

  async getDiff(projectPath, args = '') {
    return this.command(projectPath, `git diff ${args}`);
  }

  async add(projectPath, files = '.') {
    return this.command(projectPath, `git add ${files}`);
  }

  async commit(projectPath, message) {
    // Ensure git config is set before committing
    await this.ensureGitConfig(projectPath);
    return this.command(projectPath, `git commit -m "${message}"`);
  }

  async push(projectPath, branch, options = {}) {
    const flags = options.setUpstream ? '-u' : '';
    return this.command(projectPath, `git push ${flags} origin ${branch}`);
  }

  async pull(projectPath, remote, branch) {
    return this.command(projectPath, `git pull ${remote} ${branch}`);
  }

  async checkout(projectPath, branch) {
    return this.command(projectPath, `git checkout ${branch}`);
  }

  async merge(projectPath, branch, message = '') {
    const msgFlag = message ? `-m "${message}"` : '';
    return this.command(projectPath, `git merge ${branch} ${msgFlag}`);
  }

  async rebase(projectPath, branch) {
    return this.command(projectPath, `git rebase ${branch}`);
  }

  async log(projectPath, args = '--oneline -n 10') {
    return this.command(projectPath, `git log ${args}`);
  }

  async getHeadCommit(projectPath) {
    return this.command(projectPath, 'git rev-parse HEAD');
  }

  async getUnpushedCommits(projectPath, branch) {
    return this.command(projectPath, `git log origin/${branch}..${branch} --oneline`);
  }

  async createPullRequest(projectPath, title, body, baseBranch) {
    return this.command(projectPath, 
      `gh pr create --title "${title}" --body "${body}" --base ${baseBranch}`
    );
  }

  async checkMergeConflicts(projectPath, targetBranch) {
    // Save current state
    await this.command(projectPath, 'git add -A');
    await this.command(projectPath, 'git stash');
    
    try {
      // Attempt a dry-run merge
      const mergeResult = await this.command(projectPath, 
        `git merge --no-commit --no-ff ${targetBranch}`);
      
      // Check for conflicts
      const statusResult = await this.command(projectPath, 'git status --porcelain');
      const conflicts = statusResult.output
        .split('\n')
        .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
        .map(line => line.substring(3).trim());
      
      // Abort the merge
      await this.command(projectPath, 'git merge --abort');
      
      return {
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts,
        canMerge: conflicts.length === 0
      };
    } finally {
      // Restore original state
      await this.command(projectPath, 'git stash pop');
    }
  }

  async getBranchStatus(projectPath, currentBranch, baseBranch = 'origin/main') {
    try {
      // Fetch latest from remote
      await this.command(projectPath, 'git fetch origin');
      
      // Get ahead count (commits in current branch not in base)
      const aheadResult = await this.command(projectPath, 
        `git rev-list --count ${baseBranch}..HEAD`);
      const ahead = parseInt(aheadResult.output.trim(), 10) || 0;
      
      // Get behind count (commits in base not in current branch)
      const behindResult = await this.command(projectPath, 
        `git rev-list --count HEAD..${baseBranch}`);
      const behind = parseInt(behindResult.output.trim(), 10) || 0;
      
      // Check for conflicts by attempting a merge
      let hasConflicts = false;
      if (behind > 0) {
        const conflictCheck = await this.checkMergeConflicts(projectPath, baseBranch);
        hasConflicts = conflictCheck.hasConflicts;
      }
      
      // Get detailed status including staged/unstaged/untracked counts
      const detailedStatus = await this.getDetailedStatus(projectPath);
      
      return {
        ahead,
        behind,
        hasConflicts,
        staged: detailedStatus.staged,
        unstaged: detailedStatus.unstaged,
        untracked: detailedStatus.untracked
      };
    } catch (error) {
      console.error('Error getting branch status:', error);
      return {
        ahead: 0,
        behind: 0,
        hasConflicts: false,
        staged: 0,
        unstaged: 0,
        untracked: 0
      };
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
  cleanupWorktree,
  GitService
};