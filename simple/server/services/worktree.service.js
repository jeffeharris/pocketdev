// Worktree management service
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { executeGitCommand, configureGitCredentials } from './git.service.js';

const execAsync = promisify(exec);

/**
 * Initialize a new worktree for a task
 * @param {Object} options - Worktree initialization options
 * @param {string} options.mainRepoPath - Path to the main repository
 * @param {string} options.worktreePath - Path for the new worktree
 * @param {string} options.branch - Branch name for the worktree
 * @param {string} options.baseBranch - Base branch to create from
 * @param {string} options.githubToken - GitHub token for authentication (optional)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function initializeWorktree(options) {
  const { mainRepoPath, worktreePath, branch, baseBranch, githubToken } = options;
  
  try {
    // Create worktree
    await execAsync(`git worktree add -b ${branch} ${worktreePath} ${baseBranch}`, { 
      cwd: mainRepoPath 
    });
    
    // Configure git credentials if token provided
    if (githubToken) {
      await configureGitCredentials(worktreePath, githubToken);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Reset a worktree to a clean state
 * @param {string} worktreePath - Path to the worktree
 * @param {string} branch - Branch to reset to
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resetWorktree(worktreePath, branch) {
  try {
    // Clean up any uncommitted changes
    await executeGitCommand(worktreePath, 'git reset --hard');
    await executeGitCommand(worktreePath, 'git clean -fd');
    
    // Checkout the branch
    await executeGitCommand(worktreePath, `git checkout ${branch}`);
    
    // Pull latest changes
    await executeGitCommand(worktreePath, `git pull origin ${branch}`);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check worktree status
 * @param {string} worktreePath - Path to the worktree
 * @returns {Promise<Object>} Worktree status information
 */
export async function getWorktreeStatus(worktreePath) {
  try {
    // Get git status
    const statusResult = await executeGitCommand(worktreePath, 'git status --porcelain');
    const hasChanges = statusResult.output.trim().length > 0;
    
    // Get current branch
    const branchResult = await executeGitCommand(worktreePath, 'git branch --show-current');
    const currentBranch = branchResult.output.trim();
    
    // Get diff summary
    const diffResult = await executeGitCommand(worktreePath, 'git diff --stat');
    
    return {
      exists: true,
      hasChanges,
      currentBranch,
      status: statusResult.output,
      diffSummary: diffResult.output
    };
  } catch (error) {
    return {
      exists: false,
      error: error.message
    };
  }
}

/**
 * List all worktrees for a project
 * @param {string} mainRepoPath - Path to the main repository
 * @returns {Promise<Array>} List of worktrees
 */
export async function listWorktrees(mainRepoPath) {
  try {
    const result = await executeGitCommand(mainRepoPath, 'git worktree list --porcelain');
    const worktrees = [];
    let currentWorktree = {};
    
    result.output.split('\n').forEach(line => {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push(currentWorktree);
        }
        currentWorktree = { path: line.substring(9) };
      } else if (line.startsWith('HEAD ')) {
        currentWorktree.head = line.substring(5);
      } else if (line.startsWith('branch ')) {
        currentWorktree.branch = line.substring(7);
      } else if (line.startsWith('detached')) {
        currentWorktree.detached = true;
      }
    });
    
    if (currentWorktree.path) {
      worktrees.push(currentWorktree);
    }
    
    return worktrees;
  } catch (error) {
    console.error('Error listing worktrees:', error);
    return [];
  }
}

/**
 * Prune worktrees that no longer exist
 * @param {string} mainRepoPath - Path to the main repository
 * @returns {Promise<{success: boolean, pruned: number, error?: string}>}
 */
export async function pruneWorktrees(mainRepoPath) {
  try {
    const result = await executeGitCommand(mainRepoPath, 'git worktree prune -v');
    
    // Count pruned worktrees from output
    const prunedCount = (result.output.match(/Pruning/g) || []).length;
    
    return { success: true, pruned: prunedCount };
  } catch (error) {
    return { success: false, pruned: 0, error: error.message };
  }
}

/**
 * Move a worktree to a new location
 * @param {string} mainRepoPath - Path to the main repository
 * @param {string} oldPath - Current worktree path
 * @param {string} newPath - New worktree path
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function moveWorktree(mainRepoPath, oldPath, newPath) {
  try {
    // Git 2.17+ supports git worktree move
    await executeGitCommand(mainRepoPath, `git worktree move ${oldPath} ${newPath}`);
    return { success: true };
  } catch (error) {
    // Fallback for older git versions
    try {
      // Manually move directory
      await execAsync(`mv "${oldPath}" "${newPath}"`);
      
      // Update git worktree
      await executeGitCommand(mainRepoPath, 'git worktree prune');
      await executeGitCommand(mainRepoPath, `git worktree add ${newPath}`);
      
      return { success: true };
    } catch (fallbackError) {
      return { success: false, error: fallbackError.message };
    }
  }
}

/**
 * Create a .claude-prompt file in the worktree
 * @param {string} worktreePath - Path to the worktree
 * @param {string} prompt - The prompt content
 * @returns {Promise<void>}
 */
export async function createClaudePrompt(worktreePath, prompt) {
  const promptFile = path.join(worktreePath, '.claude-prompt');
  await fs.writeFile(promptFile, prompt);
}