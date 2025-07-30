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
    
    // ALWAYS set GitHub token in environment if provided
    // This ensures gh CLI and git commands have access to credentials
    if (githubToken) {
      env.GH_TOKEN = githubToken;
      env.GITHUB_TOKEN = githubToken;
      
      // Set git credential helper for ALL operations when token is available
      try {
        const { stdout: credHelper } = await execAsync('git config credential.helper', { cwd: projectPath });
        if (!credHelper || !credHelper.includes('gh auth')) {
          await execAsync(`git config credential.helper "!gh auth git-credential"`, { cwd: projectPath });
        }
      } catch (e) {
        // No credential helper set, configure it
        await execAsync(`git config credential.helper "!gh auth git-credential"`, { cwd: projectPath });
      }
    }
    
    // Handle git clone commands with authentication
    if (githubToken && command.includes('git clone') && command.includes('github.com')) {
      // Extract the URL from the clone command
      const urlMatch = command.match(/git clone\s+(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const originalUrl = urlMatch[1];
        
        // Replace the URL with authenticated version
        const authUrl = originalUrl.replace(
          /https:\/\/github\.com/,
          `https://x-access-token:${githubToken}@github.com`
        );
        // Replace the URL in the command
        command = command.replace(originalUrl, authUrl);
      }
    }
    
    const { stdout, stderr } = await execAsync(command, { 
      cwd: projectPath,
      env,
      shell: '/bin/sh'
    });
    
    return { success: true, output: stdout, error: stderr };
  } catch (error) {
    // Don't log expected failures for branch existence checks
    const isExpectedFailure = 
      command.includes('git rev-parse --verify') ||
      command.includes('git ls-remote') ||
      (command.includes('git merge-tree') && error.message.includes('merge-tree'));
    
    if (!isExpectedFailure) {
      console.error('[Git Service] Command failed:', error.message);
    }
    
    // Check for authentication errors
    if (error.message.includes('could not read Username') || 
        error.message.includes('Authentication failed') ||
        error.message.includes('Repository not found')) {
      const authError = `Authentication failed. Please check:
1. Your GitHub token has access to this repository
2. The repository URL is correct
3. For private repos, ensure your token has 'repo' scope`;
      return { success: false, output: error.stdout || '', error: authError, originalError: error.message };
    }
    
    // For commands like git merge-tree, we need stdout even on non-zero exit
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.stderr || error.message 
    };
  }
}

/**
 * Configure git credentials and merge tools for a repository
 * @param {string} projectPath - Path to the project
 * @param {string} githubToken - Optional GitHub token
 */
export async function configureGitCredentials(projectPath, githubToken = '') {
  try {
    // First, add this directory as safe if needed (only once per repo)
    try {
      const { stdout } = await execAsync('git config --get safe.directory', { cwd: projectPath });
      if (!stdout.includes(projectPath)) {
        await execAsync(`git config --add safe.directory ${projectPath}`, { cwd: projectPath });
      }
    } catch (e) {
      // Config doesn't exist yet, add it
      await execAsync(`git config --add safe.directory ${projectPath}`, { cwd: projectPath });
    }
    
    // Configure merge tools at repository level (not global)
    await execAsync(`git config merge.tool vimdiff`, { cwd: projectPath });
    await execAsync(`git config merge.conflictstyle diff3`, { cwd: projectPath });
    await execAsync(`git config mergetool.prompt false`, { cwd: projectPath });
    
    // Configure pull strategy to handle divergent branches
    await execAsync(`git config pull.rebase false`, { cwd: projectPath });
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
    // Always pass the token to executeGitCommand
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
    // Use --untracked-files=all to get individual files instead of directory summaries
    const result = await this.command(projectPath, 'git status --porcelain --untracked-files=all');
    
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

  /**
   * Get comprehensive diff information for files
   * @param {string} projectPath - Path to the project
   * @param {string} compareTarget - What to compare against ('working' or a ref like 'origin/main')
   * @returns {Promise<{files: Array, stats: Map}>}
   */
  async getComprehensiveDiff(projectPath, compareTarget = 'working') {
    const files = new Map(); // path -> file info
    
    if (compareTarget === 'working') {
      // Get all file statuses
      const statusResult = await this.getDetailedStatus(projectPath);
      
      // Get numstat for staged and unstaged
      const stagedNumstat = await this.command(projectPath, 'git diff --numstat --cached');
      const unstagedNumstat = await this.command(projectPath, 'git diff --numstat');
      
      // Parse numstats
      const parseNumstat = (output) => {
        const stats = new Map();
        output.split('\n').filter(line => line.trim()).forEach(line => {
          const [add, del, ...pathParts] = line.split('\t');
          const path = pathParts.join('\t');
          if (path) stats.set(path, { additions: parseInt(add) || 0, deletions: parseInt(del) || 0 });
        });
        return stats;
      };
      
      const stagedStats = parseNumstat(stagedNumstat.output);
      const unstagedStats = parseNumstat(unstagedNumstat.output);
      
      // Process each file from status
      for (const file of statusResult.files) {
        const fileInfo = {
          path: file.path,
          status: file.status,
          staged: file.staged,
          unstaged: file.unstaged,
          untracked: file.untracked,
          additions: 0,
          deletions: 0,
          type: 'modified'
        };
        
        // Determine type
        if (file.status === '??') fileInfo.type = 'added';
        else if (file.status[0] === 'A' || file.status[1] === 'A') fileInfo.type = 'added';
        else if (file.status[0] === 'D' || file.status[1] === 'D') fileInfo.type = 'deleted';
        else if (file.status[0] === 'R' || file.status[1] === 'R') fileInfo.type = 'renamed';
        
        // Get stats based on file state
        if (file.staged && !file.unstaged) {
          // Only staged changes
          const stats = stagedStats.get(file.path) || { additions: 0, deletions: 0 };
          fileInfo.additions = stats.additions;
          fileInfo.deletions = stats.deletions;
          fileInfo.diffType = 'staged';
        } else if (!file.staged && file.unstaged) {
          // Only unstaged changes
          const stats = unstagedStats.get(file.path) || { additions: 0, deletions: 0 };
          fileInfo.additions = stats.additions;
          fileInfo.deletions = stats.deletions;
          fileInfo.diffType = 'unstaged';
        } else if (file.staged && file.unstaged) {
          // Both staged and unstaged - show unstaged by default
          const stats = unstagedStats.get(file.path) || { additions: 0, deletions: 0 };
          fileInfo.additions = stats.additions;
          fileInfo.deletions = stats.deletions;
          fileInfo.diffType = 'unstaged';
          fileInfo.hasBothChanges = true;
        } else if (file.untracked) {
          // Untracked file - count lines
          fileInfo.diffType = 'untracked';
          // Count all lines as additions for untracked files
          try {
            const content = await this.command(projectPath, `wc -l "${file.path}"`);
            const lineCount = parseInt(content.output.trim().split(' ')[0]) || 0;
            fileInfo.additions = lineCount;
            fileInfo.deletions = 0;
          } catch (error) {
            // If we can't count lines, leave as 0
            console.warn(`Could not count lines for untracked file ${file.path}:`, error);
          }
        }
        
        files.set(file.path, fileInfo);
      }
    } else {
      // Compare against a ref (like origin/main)
      const diffNumstatResult = await this.command(projectPath, 
        `git diff --numstat ${compareTarget}...HEAD`);
      const diffStatusResult = await this.command(projectPath, 
        `git diff --name-status ${compareTarget}...HEAD`);
      
      // Parse numstat
      const stats = new Map();
      diffNumstatResult.output.split('\n').filter(line => line.trim()).forEach(line => {
        const [add, del, ...pathParts] = line.split('\t');
        const path = pathParts.join('\t');
        if (path) stats.set(path, { 
          additions: parseInt(add) || 0, 
          deletions: parseInt(del) || 0 
        });
      });
      
      // Parse status
      diffStatusResult.output.split('\n').filter(line => line.trim()).forEach(line => {
        const [status, ...pathParts] = line.split('\t');
        const path = pathParts.join('\t');
        if (!path) return;
        
        let type = 'modified';
        if (status.includes('A')) type = 'added';
        else if (status.includes('D')) type = 'deleted';
        else if (status.includes('R')) type = 'renamed';
        
        const fileStats = stats.get(path) || { additions: 0, deletions: 0 };
        // For committed files, use the single-letter status codes from git diff
        // These are different from the two-letter working tree status codes
        let gitStatus = status; // Keep the original single-letter status (A, M, D, R)
        
        files.set(path, {
          path,
          type,
          additions: fileStats.additions,
          deletions: fileStats.deletions,
          diffType: 'committed',
          status: gitStatus,
          staged: false,
          unstaged: false,
          untracked: false,
          committed: true
        });
      });
    }
    
    return { files };
  }

  /**
   * Get diff content for a specific file
   * @param {string} projectPath - Path to the project
   * @param {string} filePath - Path to the file
   * @param {string} compareTarget - What to compare against
   * @param {object} fileInfo - Optional file info from getComprehensiveDiff
   */
  async getFileDiffContent(projectPath, filePath, compareTarget = 'working', fileInfo = null, showCompleteDiff = false) {
    let diff = '';
    
    // For 'all' mode, always show complete diff from base to working tree
    if (showCompleteDiff && compareTarget !== 'working') {
      const result = await this.command(projectPath, 
        `git diff ${compareTarget} -- "${filePath}"`);
      return result.output;
    }
    
    if (compareTarget === 'working') {
      // Use file info to determine how to get diff
      if (fileInfo) {
        if (fileInfo.diffType === 'staged') {
          const result = await this.getDiff(projectPath, `--cached -- "${filePath}"`);
          diff = result.output;
        } else if (fileInfo.diffType === 'unstaged') {
          const result = await this.getDiff(projectPath, `-- "${filePath}"`);
          diff = result.output;
        } else if (fileInfo.diffType === 'untracked') {
          // Generate diff for untracked file
          const content = await this.command(projectPath, `cat "${filePath}"`);
          const lines = content.output.split('\n');
          diff = `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
          lines.forEach(line => {
            diff += `+${line}\n`;
          });
        }
      } else {
        // Fallback: try both staged and unstaged
        const stagedResult = await this.getDiff(projectPath, `--cached -- "${filePath}"`);
        if (stagedResult.output.trim()) {
          diff = stagedResult.output;
        } else {
          const unstagedResult = await this.getDiff(projectPath, `-- "${filePath}"`);
          diff = unstagedResult.output;
        }
      }
    } else {
      // Compare against ref
      const result = await this.command(projectPath, 
        `git diff ${compareTarget}...HEAD -- "${filePath}"`);
      diff = result.output;
      
      // If no diff found and file exists (might be a new file)
      if (!diff && fileInfo && fileInfo.type === 'added') {
        // For new files, show the entire file content as additions
        try {
          const content = await this.command(projectPath, `cat "${filePath}"`);
          if (content.success) {
            const lines = content.output.split('\n');
            diff = `diff --git a/${filePath} b/${filePath}\nnew file mode 100644\nindex 0000000..1234567\n--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${lines.length} @@\n`;
            lines.forEach(line => {
              diff += `+${line}\n`;
            });
          }
        } catch (e) {
          console.error(`Failed to get content for new file ${filePath}:`, e);
        }
      }
    }
    
    return diff;
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
    const pushCommand = `git push ${flags} origin ${branch}`;
    console.log(`[GitService.push] Executing: ${pushCommand} in ${projectPath}`);
    const result = await this.command(projectPath, pushCommand);
    console.log(`[GitService.push] Result:`, result);
    return result;
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
    // Use command() which ensures token is passed
    return this.command(projectPath, 
      `gh pr create --title "${title}" --body "${body}" --base ${baseBranch}`
    );
  }

  async checkMergeConflicts(projectPath, targetBranch) {
    try {
      // Fast conflict check using git merge-tree (available in git 2.38+)
      // This doesn't modify the working tree at all
      const mergeTreeResult = await this.command(projectPath,
        `git merge-tree --write-tree --name-only HEAD ${targetBranch} 2>&1`);
      
      if (mergeTreeResult.success) {
        // Exit code 0 means clean merge is possible
        return {
          hasConflicts: false,
          conflicts: [],
          canMerge: true
        };
      }
      
      // Exit code 1 means there are conflicts
      // Parse the output to get conflicted files
      // Note: conflict info might be in stderr (error) rather than stdout
      const output = (mergeTreeResult.output || '') + (mergeTreeResult.error || '');
      const conflicts = [];
      
      // Parse conflict information from merge-tree output
      // Format: "CONFLICT (content): Merge conflict in <filename>"
      const conflictRegex = /CONFLICT.*:\s+.*?\s+in\s+(.+)/g;
      let match;
      while ((match = conflictRegex.exec(output)) !== null) {
        conflicts.push(match[1]);
      }
      
      // Alternative parsing for different output format
      if (conflicts.length === 0) {
        // Look for lines with conflict markers (file status lines)
        const lines = output.split('\n');
        lines.forEach(line => {
          // Format: "100644 <hash> 1\t<filename>" (stage 1, 2, or 3 indicates conflict)
          if (line.match(/^\d{6}\s+\w{40}\s+[123]\t/)) {
            const parts = line.split('\t');
            if (parts[1] && !conflicts.includes(parts[1])) {
              conflicts.push(parts[1]);
            }
          }
        });
      }
      
      return {
        hasConflicts: true,
        conflicts: [...new Set(conflicts)], // Remove duplicates
        canMerge: false
      };
    } catch (error) {
      // If merge-tree fails (old git version or other error), 
      // fall back to safe defaults - assume merge is possible to not block operations
      console.error('[Git] checkMergeConflicts error:', error.message);
      
      // Could implement fallback to old merge-tree syntax here if needed
      return {
        hasConflicts: false,
        conflicts: [],
        canMerge: true,
        error: 'Unable to check for conflicts'
      };
    }
  }

  /**
   * Get detailed merge conflict information using a temporary worktree
   * This is used when we need to actually analyze conflicts, not just check if they exist
   * @param {string} projectPath - Path to the project
   * @param {string} targetBranch - Branch to merge from
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Detailed conflict information
   */
  async getDetailedMergeConflicts(projectPath, targetBranch, options = {}) {
    const tempWorktreePath = `/tmp/merge-check-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    try {
      // Get current branch
      const currentBranchResult = await this.command(projectPath, 'git branch --show-current');
      const currentBranch = currentBranchResult.output.trim();
      
      // Create temporary worktree
      await this.command(projectPath, 
        `git worktree add -q "${tempWorktreePath}" HEAD`);
      
      // Attempt merge in temporary worktree
      const mergeResult = await this.command(tempWorktreePath,
        `git merge --no-commit --no-ff ${targetBranch}`);
      
      const conflictDetails = {
        hasConflicts: false,
        conflicts: [],
        conflictedFiles: [],
        canMerge: true,
        mergeMessage: mergeResult.output
      };
      
      if (!mergeResult.success) {
        // Get detailed conflict information
        const statusResult = await this.command(tempWorktreePath, 'git status --porcelain');
        const diffResult = await this.command(tempWorktreePath, 'git diff --name-only --diff-filter=U');
        
        // Parse conflicted files
        conflictDetails.hasConflicts = true;
        conflictDetails.canMerge = false;
        conflictDetails.conflictedFiles = diffResult.output
          .split('\n')
          .filter(file => file.trim())
          .map(file => file.trim());
        
        // Get conflict details for each file
        for (const file of conflictDetails.conflictedFiles) {
          const diffDetail = await this.command(tempWorktreePath, `git diff "${file}"`);
          conflictDetails.conflicts.push({
            file,
            diff: diffDetail.output,
            status: 'unmerged'
          });
        }
        
        // Abort the merge
        await this.command(tempWorktreePath, 'git merge --abort');
      }
      
      return conflictDetails;
    } catch (error) {
      console.error('[Git] getDetailedMergeConflicts error:', error.message);
      return {
        hasConflicts: false,
        conflicts: [],
        conflictedFiles: [],
        canMerge: false,
        error: error.message
      };
    } finally {
      // Clean up temporary worktree
      try {
        await this.command(projectPath, `git worktree remove --force "${tempWorktreePath}"`);
      } catch (cleanupError) {
        console.error('[Git] Failed to clean up temporary worktree:', cleanupError.message);
        // Try alternative cleanup
        try {
          await execAsync(`rm -rf "${tempWorktreePath}"`);
          await this.command(projectPath, 'git worktree prune');
        } catch (e) {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Check if a merge is currently in progress
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>}
   */
  async isMergeInProgress(projectPath) {
    try {
      // Check for MERGE_HEAD which exists during an incomplete merge
      await this.command(projectPath, 'git rev-parse --verify MERGE_HEAD');
      return true;
    } catch {
      // MERGE_HEAD doesn't exist, no merge in progress
      return false;
    }
  }

  /**
   * Check if a rebase is currently in progress
   * @param {string} projectPath - Path to the project
   * @returns {Promise<boolean>}
   */
  async isRebaseInProgress(projectPath) {
    try {
      // Check for rebase-merge or rebase-apply directories
      const { stdout } = await execAsync('ls .git/rebase-merge .git/rebase-apply 2>/dev/null', { 
        cwd: projectPath 
      });
      return stdout.trim().length > 0;
    } catch {
      return false;
    }
  }

  async getBranchStatus(projectPath, currentBranch, baseBranch = 'origin/main', options = {}) {
    try {
      // Only fetch if explicitly requested (default: false for performance)
      if (options.fetch) {
        await this.command(projectPath, 'git fetch origin');
      }
      
      // Get ahead count (commits in current branch not in base)
      const aheadResult = await this.command(projectPath, 
        `git rev-list --count ${baseBranch}..HEAD`);
      const ahead = parseInt(aheadResult.output.trim(), 10) || 0;
      
      // Get behind count (commits in base not in current branch)
      const behindResult = await this.command(projectPath, 
        `git rev-list --count HEAD..${baseBranch}`);
      const behind = parseInt(behindResult.output.trim(), 10) || 0;
      
      // Check for unpushed commits (commits not in origin/currentBranch)
      let unpushed = 0;
      let hasRemoteTracking = false;
      try {
        // Check if remote tracking branch exists
        const remoteCheck = await this.command(projectPath, 
          `git rev-parse --verify origin/${currentBranch} 2>/dev/null`);
        if (remoteCheck.success) {
          hasRemoteTracking = true;
          // Count unpushed commits
          const unpushedResult = await this.command(projectPath, 
            `git rev-list --count origin/${currentBranch}..HEAD`);
          unpushed = parseInt(unpushedResult.output.trim(), 10) || 0;
        }
      } catch (error) {
        // Remote tracking branch doesn't exist, all commits are unpushed
        unpushed = ahead;
      }
      
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
        untracked: detailedStatus.untracked,
        unpushed,
        hasRemoteTracking
      };
    } catch (error) {
      console.error('Error getting branch status:', error);
      return {
        ahead: 0,
        behind: 0,
        hasConflicts: false,
        staged: 0,
        unstaged: 0,
        untracked: 0,
        unpushed: 0,
        hasRemoteTracking: false
      };
    }
  }

  /**
   * Get all changes including working tree and committed changes not in base branch
   * @param {string} projectPath - Path to the project
   * @param {string} baseBranch - Base branch to compare against (default: origin/main)
   * @returns {Promise<{files: Array, summary: Object}>}
   */
  async getAllChanges(projectPath, baseBranch = 'origin/main') {
    const allFiles = new Map(); // path -> file info
    
    // Get working tree changes (staged, unstaged, untracked)
    const workingTreeDiff = await this.getComprehensiveDiff(projectPath, 'working');
    
    // Add all working tree files
    for (const [path, fileInfo] of workingTreeDiff.files) {
      allFiles.set(path, {
        ...fileInfo,
        category: fileInfo.untracked ? 'untracked' : 
                 fileInfo.staged && !fileInfo.unstaged ? 'staged' :
                 'unstaged'
      });
    }
    
    // Get committed changes not in base branch
    const committedDiff = await this.getComprehensiveDiff(projectPath, baseBranch);
    
    // Add committed files that aren't already in working tree
    for (const [path, fileInfo] of committedDiff.files) {
      if (!allFiles.has(path)) {
        allFiles.set(path, {
          ...fileInfo,
          category: 'committed'
        });
      }
    }
    
    // Convert to array and categorize
    const fileArray = Array.from(allFiles.values());
    const summary = {
      staged: fileArray.filter(f => f.category === 'staged').length,
      unstaged: fileArray.filter(f => f.category === 'unstaged').length,
      untracked: fileArray.filter(f => f.category === 'untracked').length,
      committed: fileArray.filter(f => f.category === 'committed').length,
      total: fileArray.length
    };
    
    return {
      files: fileArray,
      summary
    };
  }

  /**
   * Stage a specific file
   * @param {string} projectPath - Path to the project
   * @param {string} filePath - Path to the file to stage
   * @returns {Promise<{success: boolean, output: string, error: string}>}
   */
  async stageFile(projectPath, filePath) {
    return this.command(projectPath, `git add "${filePath}"`);
  }

  /**
   * Unstage a specific file
   * @param {string} projectPath - Path to the project
   * @param {string} filePath - Path to the file to unstage
   * @returns {Promise<{success: boolean, output: string, error: string}>}
   */
  async unstageFile(projectPath, filePath) {
    return this.command(projectPath, `git reset HEAD "${filePath}"`);
  }

  /**
   * Check if there are unpushed commits
   * @param {string} projectPath - Path to the project
   * @param {string} currentBranch - Current branch name
   * @returns {Promise<{count: number, commits: Array}>}
   */
  async getUnpushedCommitsInfo(projectPath, currentBranch) {
    try {
      // Check if remote tracking branch exists
      const remoteCheck = await this.command(projectPath, 
        `git rev-parse --verify origin/${currentBranch} 2>/dev/null`);
      
      if (!remoteCheck.success) {
        // No remote tracking branch, all commits are unpushed
        const allCommits = await this.command(projectPath, 
          'git log --oneline --pretty=format:"%h %s"');
        const commits = allCommits.output.trim().split('\n').filter(line => line);
        return {
          count: commits.length,
          commits: commits.map(line => {
            const [hash, ...messageParts] = line.split(' ');
            return { hash, message: messageParts.join(' ') };
          })
        };
      }
      
      // Count unpushed commits
      const countResult = await this.command(projectPath, 
        `git rev-list --count origin/${currentBranch}..HEAD`);
      const count = parseInt(countResult.output.trim(), 10) || 0;
      
      if (count === 0) {
        return { count: 0, commits: [] };
      }
      
      // Get unpushed commit details
      const logResult = await this.command(projectPath, 
        `git log origin/${currentBranch}..HEAD --oneline --pretty=format:"%h %s"`);
      const commits = logResult.output.trim().split('\n').filter(line => line).map(line => {
        const [hash, ...messageParts] = line.split(' ');
        return { hash, message: messageParts.join(' ') };
      });
      
      return { count, commits };
    } catch (error) {
      console.error('Error getting unpushed commits:', error);
      return { count: 0, commits: [] };
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