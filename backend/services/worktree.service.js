// Worktree management service
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { promises as fs } from 'fs';
import { GitService } from './git.service.js';
import { Worktree } from '../../shared/domain/index.js';

const execAsync = promisify(exec);

/**
 * Execute git command helper function
 */
async function executeGitCommand(command, workingDirectory) {
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDirectory,
      maxBuffer: 10 * 1024 * 1024 // 10MB buffer
    });
    return stdout.trim();
  } catch (error) {
    throw new Error(`Git command failed: ${error.message}`);
  }
}


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
  const { mainRepoPath, worktreePath, branch, baseBranch, githubToken, useExistingBranch } = options;
  
  try {
    // Create worktree
    let worktreeCommand;
    if (useExistingBranch) {
      // Check if branch exists locally
      try {
        await execAsync(`git rev-parse --verify ${branch}`, { cwd: mainRepoPath });
        // Branch exists locally
        worktreeCommand = `git worktree add ${worktreePath} ${branch}`;
      } catch (error) {
        // Branch doesn't exist locally, check remote
        try {
          await execAsync(`git rev-parse --verify origin/${branch}`, { cwd: mainRepoPath });
          // Branch exists on remote, create local tracking branch
          worktreeCommand = `git worktree add --track -b ${branch} ${worktreePath} origin/${branch}`;
        } catch (remoteError) {
          throw new Error(`Branch '${branch}' not found locally or on remote`);
        }
      }
    } else {
      // For new branches, create from base branch
      worktreeCommand = `git worktree add -b ${branch} ${worktreePath} ${baseBranch}`;
    }
    
    await execAsync(worktreeCommand, { 
      cwd: mainRepoPath 
    });
    
    // Configure git credentials if token provided
    if (githubToken) {
      await GitService.configureCredentials(worktreePath, githubToken);
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
    await executeGitCommand('git reset --hard', worktreePath);
    await executeGitCommand('git clean -fd', worktreePath);
    
    // Checkout the branch
    await executeGitCommand(`git checkout ${branch}`, worktreePath);
    
    // Pull latest changes
    await executeGitCommand(`git pull origin ${branch}`, worktreePath);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Check worktree status
 * @param {string} worktreePath - Path to the worktree
 * @param {string} githubToken - GitHub token (optional)
 * @returns {Promise<Object>} Worktree status information
 */
export async function getWorktreeStatus(worktreePath, githubToken = null) {
  try {
    const workingTree = new GitWorkingTree(githubToken);
    const analyzer = new GitAnalyzer(githubToken);
    const repository = new GitRepository(githubToken);
    
    // Get git status
    const statusResult = await workingTree.getStatus(worktreePath);
    const hasChanges = statusResult.output.trim().length > 0;
    
    // Get current branch
    const branchResult = await repository.execute('git branch --show-current', worktreePath);
    const currentBranch = branchResult.output.trim();
    
    // Get diff summary
    const diffResult = await analyzer.getDiff(worktreePath, '--stat');
    
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
    const result = await executeGitCommand('git worktree list --porcelain', mainRepoPath);
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
    const result = await executeGitCommand('git worktree prune -v', mainRepoPath);
    
    // Count pruned worktrees from output
    const prunedCount = (result.output.match(/Pruning/g) || []).length;
    
    return { success: true, pruned: prunedCount };
  } catch (error) {
    return { success: false, pruned: 0, error: error.message };
  }
}

/**
 * Remove a worktree
 * @param {string} mainRepoPath - Path to the main repository
 * @param {string} worktreePath - Path to the worktree to remove
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function removeWorktree(mainRepoPath, worktreePath) {
  try {
    // Remove the worktree
    await executeGitCommand(`git worktree remove ${worktreePath} --force`, mainRepoPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
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
    await executeGitCommand(`git worktree move ${oldPath} ${newPath}`, mainRepoPath);
    return { success: true };
  } catch (error) {
    // Fallback for older git versions
    try {
      // Manually move directory
      await execAsync(`mv "${oldPath}" "${newPath}"`);
      
      // Update git worktree
      await executeGitCommand('git worktree prune', mainRepoPath);
      await executeGitCommand(`git worktree add ${newPath}`, mainRepoPath);
      
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

/**
 * WorktreeService class for object-oriented usage
 */
export class WorktreeService {
  constructor(githubToken = '') {
    this.githubToken = githubToken || process.env.GITHUB_TOKEN || '';
  }

  async create(mainRepoPath, branch, worktreePath, baseBranch, useExistingBranch = false, projectId = null, taskId = null) {
    // Validate with domain object first
    if (projectId && taskId) {
      const worktree = new Worktree(
        `wt-${taskId}`,
        projectId,
        taskId,
        worktreePath,
        branch,
        baseBranch,
        false,
        false
      );
      
      // Check if we can create
      if (!worktree.canModify()) {
        throw new Error('Cannot create worktree - it is locked');
      }
    }
    
    const result = await initializeWorktree({
      mainRepoPath,
      worktreePath,
      branch,
      baseBranch,
      githubToken: this.githubToken,
      useExistingBranch
    });
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    // Return with domain object if IDs provided
    if (projectId && taskId) {
      result.worktree = new Worktree(
        `wt-${taskId}`,
        projectId,
        taskId,
        worktreePath,
        branch,
        baseBranch,
        false,
        false
      );
    }
    
    return result;
  }

  async remove(mainRepoPath, worktreePath) {
    const result = await removeWorktree(mainRepoPath, worktreePath);
    if (!result.success) {
      throw new Error(result.error);
    }
    return result;
  }

  async move(oldPath, newPath) {
    // Simple move operation
    await execAsync(`mv "${oldPath}" "${newPath}"`);
  }

  async reset(worktreePath, branch) {
    return resetWorktree(worktreePath, branch);
  }

  async list(mainRepoPath) {
    return listWorktrees(mainRepoPath);
  }

  async prune(mainRepoPath) {
    return pruneWorktrees(mainRepoPath);
  }
  
  /**
   * Check worktree health and repair if needed
   * Uses Worktree domain object for business rules
   */
  async checkHealth(worktreePath, projectId, taskId, branch) {
    // Create domain object to check state
    const worktree = new Worktree(
      `wt-${taskId}`,
      projectId,
      taskId,
      worktreePath,
      branch,
      'main',
      false,
      false
    );
    
    // Check if path exists
    try {
      await fs.access(worktreePath);
    } catch {
      // Path doesn't exist - mark as orphaned
      worktree.markOrphaned();
      return {
        healthy: false,
        needsRepair: worktree.needsRepair(),
        canCheckout: worktree.canCheckout(),
        reason: 'Worktree path does not exist'
      };
    }
    
    // Check git status
    try {
      await execAsync('git status', { cwd: worktreePath });
    } catch (error) {
      // Git command failed - worktree is broken
      worktree.markOrphaned();
      return {
        healthy: false,
        needsRepair: worktree.needsRepair(),
        canCheckout: worktree.canCheckout(),
        reason: 'Git status failed - worktree may be corrupt'
      };
    }
    
    return {
      healthy: true,
      needsRepair: worktree.needsRepair(),
      canCheckout: worktree.canCheckout(),
      canModify: worktree.canModify()
    };
  }
  
  /**
   * Generate standard worktree path
   */
  static generatePath(projectsDir, projectId, taskId) {
    return Worktree.generatePath(projectsDir, projectId, taskId);
  }
}