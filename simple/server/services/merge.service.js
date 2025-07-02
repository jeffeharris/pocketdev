// Merge operations service
import { executeGitCommand } from './git.service.js';
import { createClaudePrompt } from './worktree.service.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Perform a merge operation
 * @param {Object} options - Merge options
 * @param {string} options.worktreePath - Path to the worktree
 * @param {string} options.sourceBranch - Branch to merge from
 * @param {string} options.targetBranch - Branch to merge into
 * @param {string} options.message - Merge commit message (optional)
 * @returns {Promise<{success: boolean, output: string, error?: string, conflicts?: string[]}>}
 */
export async function performMerge(options) {
  const { worktreePath, sourceBranch, targetBranch, message } = options;
  
  try {
    // Ensure we're on the target branch
    await executeGitCommand(worktreePath, `git checkout ${targetBranch}`);
    
    // Attempt the merge
    const mergeMessage = message || `Merge branch '${sourceBranch}' into ${targetBranch}`;
    const result = await executeGitCommand(worktreePath, 
      `git merge ${sourceBranch} -m "${mergeMessage}"`);
    
    if (result.success) {
      return { success: true, output: result.output };
    }
    
    // Check for conflicts
    const statusResult = await executeGitCommand(worktreePath, 'git status --porcelain');
    const conflicts = statusResult.output
      .split('\n')
      .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
      .map(line => line.substring(3).trim());
    
    return {
      success: false,
      output: result.output,
      error: result.error,
      conflicts
    };
  } catch (error) {
    return { success: false, output: '', error: error.message };
  }
}

/**
 * Perform a rebase operation
 * @param {Object} options - Rebase options
 * @param {string} options.worktreePath - Path to the worktree
 * @param {string} options.sourceBranch - Branch to rebase onto
 * @param {string} options.targetBranch - Branch to rebase (optional, uses current if not specified)
 * @returns {Promise<{success: boolean, output: string, error?: string, conflicts?: string[]}>}
 */
export async function performRebase(options) {
  const { worktreePath, sourceBranch, targetBranch } = options;
  
  try {
    // Checkout target branch if specified
    if (targetBranch) {
      await executeGitCommand(worktreePath, `git checkout ${targetBranch}`);
    }
    
    // Attempt the rebase
    const result = await executeGitCommand(worktreePath, `git rebase ${sourceBranch}`);
    
    if (result.success) {
      return { success: true, output: result.output };
    }
    
    // Check for conflicts
    const statusResult = await executeGitCommand(worktreePath, 'git status --porcelain');
    const conflicts = statusResult.output
      .split('\n')
      .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
      .map(line => line.substring(3).trim());
    
    return {
      success: false,
      output: result.output,
      error: result.error,
      conflicts
    };
  } catch (error) {
    return { success: false, output: '', error: error.message };
  }
}

/**
 * Check for potential merge conflicts
 * @param {string} worktreePath - Path to the worktree
 * @param {string} sourceBranch - Branch to merge from
 * @param {string} targetBranch - Branch to merge into
 * @returns {Promise<{hasConflicts: boolean, conflicts: string[], canMerge: boolean, reason?: string}>}
 */
export async function checkMergeConflicts(worktreePath, sourceBranch, targetBranch) {
  try {
    // First check if branches are identical
    const diffCheck = await executeGitCommand(worktreePath, 
      `git diff ${sourceBranch}..${targetBranch} --name-only`);
    if (!diffCheck.output.trim()) {
      return {
        hasConflicts: false,
        conflicts: [],
        canMerge: false,
        reason: 'Branches are identical - nothing to merge'
      };
    }
    
    // Save current branch state
    await executeGitCommand(worktreePath, 'git add -A');
    await executeGitCommand(worktreePath, 'git stash');
    
    try {
      // Attempt a dry-run merge to check for conflicts
      const mergeResult = await executeGitCommand(worktreePath, 
        `git merge --no-commit --no-ff ${sourceBranch}`);
      
      // Check if there are conflicts
      const statusResult = await executeGitCommand(worktreePath, 'git status --porcelain');
      const conflicts = statusResult.output
        .split('\n')
        .filter(line => line.startsWith('UU ') || line.startsWith('AA '))
        .map(line => line.substring(3).trim());
      
      // Abort the merge
      await executeGitCommand(worktreePath, 'git merge --abort');
      
      return {
        hasConflicts: conflicts.length > 0,
        conflicts: conflicts,
        canMerge: conflicts.length === 0
      };
    } finally {
      // Restore original state
      await executeGitCommand(worktreePath, 'git stash pop');
    }
  } catch (error) {
    // If stash pop fails, try to recover
    try {
      await executeGitCommand(worktreePath, 'git merge --abort');
      await executeGitCommand(worktreePath, 'git stash drop');
    } catch (e) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Resolve merge conflicts
 * @param {string} worktreePath - Path to the worktree
 * @param {Object} resolutions - Map of file paths to resolution strategies
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function resolveConflicts(worktreePath, resolutions) {
  try {
    for (const [filePath, strategy] of Object.entries(resolutions)) {
      switch (strategy) {
        case 'ours':
          await executeGitCommand(worktreePath, `git checkout --ours ${filePath}`);
          break;
        case 'theirs':
          await executeGitCommand(worktreePath, `git checkout --theirs ${filePath}`);
          break;
        case 'manual':
          // Manual resolution - file should already be edited
          break;
        default:
          throw new Error(`Unknown resolution strategy: ${strategy}`);
      }
      
      // Add resolved file
      await executeGitCommand(worktreePath, `git add ${filePath}`);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Continue a merge or rebase after resolving conflicts
 * @param {string} worktreePath - Path to the worktree
 * @param {string} operation - 'merge' or 'rebase'
 * @returns {Promise<{success: boolean, output: string, error?: string}>}
 */
export async function continueOperation(worktreePath, operation) {
  try {
    let result;
    if (operation === 'rebase') {
      result = await executeGitCommand(worktreePath, 'git rebase --continue');
    } else {
      // For merge, we need to commit
      result = await executeGitCommand(worktreePath, 'git commit --no-edit');
    }
    
    return { success: result.success, output: result.output, error: result.error };
  } catch (error) {
    return { success: false, output: '', error: error.message };
  }
}

/**
 * Abort a merge or rebase operation
 * @param {string} worktreePath - Path to the worktree
 * @param {string} operation - 'merge' or 'rebase'
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function abortOperation(worktreePath, operation) {
  try {
    if (operation === 'rebase') {
      await executeGitCommand(worktreePath, 'git rebase --abort');
    } else {
      await executeGitCommand(worktreePath, 'git merge --abort');
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Create a merge task with Claude assistance
 * @param {Object} options - Merge task options
 * @param {Object} options.task - The task object
 * @param {Object} options.project - The project object
 * @param {Object} options.models - Database models
 * @param {string} options.operation - 'merge' or 'rebase'
 * @param {string} options.projectsDir - Projects directory path
 * @returns {Promise<Object>} The created merge task
 */
export async function createClaudeMergeTask(options) {
  const { task, project, models, operation, projectsDir } = options;
  
  const mergeTaskName = `${operation} ${project.base_branch} into ${task.name}`;
  const prompt = `Help me ${operation} the branch '${project.base_branch}' into this task branch '${task.branch}'. ` +
    `IMPORTANT: If there are conflicts, show me each conflicted section using git diff before resolving. ` +
    `For each conflict, explain what would be lost by choosing either version, then suggest a resolution. ` +
    `Start by checking the current status and then perform the ${operation}.`;
  
  // Create a temporary merge task in the database
  const mergeTaskId = models.tasks.generateId();
  const mergeTask = await models.tasks.create(project.id, {
    id: mergeTaskId,
    name: mergeTaskName,
    branch: task.branch, // Same branch as original task
    worktree_path: task.worktree_path // Use the SAME worktree
  });
  
  // Update metadata to mark this as a merge task
  await models.tasks.updateMetadata(mergeTaskId, {
    isMergeTask: true,
    parentTaskId: task.id,
    operation: operation
  });
  
  // Write prompt to a file in the worktree
  await createClaudePrompt(task.worktree_path, prompt);
  
  return mergeTask;
}

/**
 * Create a merge task for merging into base branch with Claude
 * @param {Object} options - Merge task options
 * @param {Object} options.task - The task object
 * @param {Object} options.project - The project object
 * @param {Object} options.models - Database models
 * @param {string} options.projectsDir - Projects directory path
 * @returns {Promise<Object>} The created merge task
 */
export async function createClaudeMergeToBaseTask(options) {
  const { task, project, models, projectsDir } = options;
  
  const mergeTaskName = `merge ${task.branch} into ${project.base_branch}`;
  const mergeTaskId = models.tasks.generateId();
  
  // Switch to base branch in main repo
  await executeGitCommand(project.local_path, `git checkout ${project.base_branch}`);
  await executeGitCommand(project.local_path, `git pull origin ${project.base_branch}`);
  
  // Create a new branch for the merge
  const mergeBranch = `merge/${task.branch}-into-${project.base_branch}`.replace(/[^a-zA-Z0-9-]/g, '-');
  const mergeWorktreePath = path.join(projectsDir, `${project.id}-merge-${mergeTaskId}`);
  
  // Create worktree from base branch
  await execAsync(`git worktree add -b ${mergeBranch} ${mergeWorktreePath} ${project.base_branch}`, {
    cwd: project.local_path
  });
  
  // Attempt merge in the new worktree
  await executeGitCommand(mergeWorktreePath, `git merge origin/${task.branch}`);
  
  // Create merge task in database
  const mergeTask = await models.tasks.create(project.id, {
    id: mergeTaskId,
    name: mergeTaskName,
    branch: mergeBranch,
    worktree_path: mergeWorktreePath
  });
  
  // Add metadata to indicate this is a merge task
  await models.tasks.updateMetadata(mergeTaskId, {
    isMergeTask: true,
    sourceBranch: task.branch,
    targetBranch: project.base_branch,
    originalTaskId: task.id
  });
  
  // Write instructions for Claude
  const prompt = `Help me complete the merge of branch '${task.branch}' into '${project.base_branch}'.

There are merge conflicts that need to be resolved. Please:
1. Check the current git status to see conflicting files
2. For EACH conflict, use 'git diff' to show me the conflicting sections
3. Explain what each version contains and what would be lost by choosing either side
4. Suggest how to resolve the conflict and wait for my approval
5. Only after showing me all conflicts, proceed with resolution
6. Make sure the code still works after merging
7. Commit the merge with an appropriate message

IMPORTANT: Never use 'git checkout --theirs' or '--ours' without first showing what would be removed.

Original task: ${task.name}`;
  
  await createClaudePrompt(mergeWorktreePath, prompt);
  
  return mergeTask;
}