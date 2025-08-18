/**
 * Git Core Service
 * 
 * This file now re-exports the simplified GitService that composes
 * three deep modules: GitRepository, GitWorkingTree, and GitAnalyzer.
 * 
 * The old monolithic GitService implementation is preserved below for
 * reference during migration, but should be removed once all consumers
 * are updated.
 */

// Export the new simplified service as the main GitService
export { GitService } from './git-simple.service.js';

// Also export the deep modules for services that need specific functionality
export { GitRepository } from './git-repository.service.js';
export { GitWorkingTree } from './git-workingtree.service.js';
export { GitAnalyzer } from './git-analyzer.service.js';

// Legacy imports for the old implementation below
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * LEGACY GitService - TO BE REMOVED
 * This is the old monolithic implementation preserved for reference.
 * All new code should use the simplified GitService exported above.
 * 
 * Public API Methods:
 * - command(dir, cmd) - Execute any git command
 * - executeCommand(cmd, dir) - Alternative signature
 * - getStatus(dir) - Get repository status
 * - push(dir, branch, opts) - Push changes
 * - commit(dir, message) - Commit staged changes
 * - configureCredentials(dir) - Setup git credentials
 * 
 * All other methods are considered internal implementation details.
 */
class LegacyGitService {
  constructor(githubToken = null, gitConfig = null) {
    this.githubToken = githubToken;
    this.gitConfig = gitConfig || { name: 'PocketDev AI', email: 'ai@pocketdev.io' };
  }

  // ========================================
  // PUBLIC API METHODS
  // ========================================

  /**
   * Execute a git command in a specific directory
   */
  async executeCommand(command, workingDirectory, options = {}) {
    try {
      const gitEnv = { ...process.env };
      
      if (this.githubToken) {
        // Set both tokens for compatibility
        gitEnv.GITHUB_TOKEN = this.githubToken;
        gitEnv.GH_TOKEN = this.githubToken;
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        env: gitEnv,
        ...options
      });

      return {
        success: true,
        output: stdout.replace(/\s+$/, ''),  // Only trim trailing whitespace
        error: stderr.trim()
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: error.message
      };
    }
  }

  /**
   * Get repository status
   */
  async getStatus(workingDirectory) {
    return this.executeCommand('git status --porcelain', workingDirectory);
  }

  /**
   * Get current branch
   */
  async getCurrentBranch(workingDirectory) {
    const result = await this.executeCommand('git branch --show-current', workingDirectory);
    return result.success ? result.output : null;
  }

  /**
   * Get diff for repository
   */
  async getDiff(workingDirectory, args = '') {
    return this.executeCommand(`git diff ${args}`, workingDirectory);
  }

  /**
   * Add files to staging
   */
  async add(workingDirectory, files = '.') {
    const filesArg = Array.isArray(files) ? files.join(' ') : files;
    return this.executeCommand(`git add ${filesArg}`, workingDirectory);
  }

  /**
   * Ensure git config is set
   */
  async ensureGitConfig(workingDirectory) {
    // Check if git config is already set
    const nameResult = await this.command(workingDirectory, 'git config user.name');
    const emailResult = await this.command(workingDirectory, 'git config user.email');
    
    // Set config if not already set
    if (!nameResult.output.trim() && this.gitConfig.name) {
      await this.command(workingDirectory, `git config user.name "${this.gitConfig.name}"`);
    }
    if (!emailResult.output.trim() && this.gitConfig.email) {
      await this.command(workingDirectory, `git config user.email "${this.gitConfig.email}"`);
    }
  }

  /**
   * Commit staged changes
   */
  async commit(workingDirectory, message) {
    // Ensure git config is set before committing
    await this.ensureGitConfig(workingDirectory);
    return this.executeCommand(`git commit -m "${message}"`, workingDirectory);
  }

  /**
   * Push changes to remote
   */
  async push(workingDirectory, branch, options = {}) {
    const flags = options.setUpstream ? '-u' : '';
    return this.executeCommand(`git push ${flags} origin ${branch}`, workingDirectory);
  }


  /**
   * Pull changes from remote
   */
  async pull(workingDirectory, remote = 'origin', branch) {
    return this.executeCommand(`git pull ${remote} ${branch}`, workingDirectory);
  }

  /**
   * Unstage a file
   */
  async unstageFile(workingDirectory, filePath) {
    return this.executeCommand(`git reset HEAD "${filePath}"`, workingDirectory);
  }

  /**
   * Reset to a specific commit
   */
  async reset(workingDirectory, commit, hard = false) {
    const mode = hard ? '--hard' : '--mixed';
    return this.executeCommand(`git reset ${mode} ${commit}`, workingDirectory);
  }

  /**
   * Checkout a branch
   */
  async checkout(workingDirectory, branch) {
    return this.executeCommand(`git checkout ${branch}`, workingDirectory);
  }

  /**
   * Merge a branch
   */
  async merge(workingDirectory, branch, message = '') {
    const msgFlag = message ? `-m "${message}"` : '';
    return this.executeCommand(`git merge ${branch} ${msgFlag}`, workingDirectory);
  }

  /**
   * Rebase on a branch
   */
  async rebase(workingDirectory, branch) {
    return this.executeCommand(`git rebase ${branch}`, workingDirectory);
  }

  /**
   * Get log
   */
  async log(workingDirectory, args = '--oneline -n 10') {
    return this.executeCommand(`git log ${args}`, workingDirectory);
  }

  /**
   * Get HEAD commit SHA
   */
  async getHeadCommit(workingDirectory) {
    return this.executeCommand('git rev-parse HEAD', workingDirectory);
  }

  /**
   * Get unpushed commits
   */
  async getUnpushedCommits(workingDirectory, branch) {
    // Check if remote branch exists
    const remoteCheck = await this.executeCommand(
      `git rev-parse --verify origin/${branch} 2>/dev/null`,
      workingDirectory
    );
    
    if (!remoteCheck.success) {
      // No remote branch, all commits are unpushed
      return this.executeCommand('git log --oneline', workingDirectory);
    }
    
    // Get unpushed commits
    return this.executeCommand(
      `git log origin/${branch}..HEAD --oneline`,
      workingDirectory
    );
  }

  /**
   * Stage a specific file
   */
  async stageFile(workingDirectory, filePath) {
    return this.executeCommand(`git add "${filePath}"`, workingDirectory);
  }

  /**
   * Execute a git command (alias for executeCommand for compatibility)
   */
  async command(workingDirectory, command) {
    return this.executeCommand(command, workingDirectory);
  }

  // ========================================
  // INTERNAL METHODS (Complex Analysis)
  // These are used by git-status.service.js
  // ========================================

  /**
   * Get detailed git status including staged, unstaged, and untracked file counts
   */
  async getDetailedStatus(workingDirectory) {
    const result = await this.executeCommand('git status --porcelain --untracked-files=all', workingDirectory);
    
    let staged = 0;
    let unstaged = 0;
    let untracked = 0;
    const files = [];
    
    // Parse each line of porcelain output
    result.output.split('\n').forEach(line => {
      if (!line.trim()) return;
      
      const status = line.substring(0, 2);
      const filename = line.substring(3);
      const indexStatus = status[0];
      const workingStatus = status[1];
      
      if (status === '??') {
        untracked++;
        files.push({ path: filename, status: '??', staged: false, unstaged: false, untracked: true });
      } else {
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged++;
        }
        if (workingStatus !== ' ' && workingStatus !== '?') {
          unstaged++;
        }
        files.push({ 
          path: filename, 
          status: status,
          staged: indexStatus !== ' ' && indexStatus !== '?',
          unstaged: workingStatus !== ' ' && workingStatus !== '?',
          untracked: false
        });
      }
    });
    
    return {
      staged,
      unstaged,
      untracked,
      files,
      raw: result.output
    };
  }

  /**
   * Get comprehensive diff information for files
   */
  async getComprehensiveDiff(workingDirectory, compareTarget = 'working') {
    const files = new Map();
    
    if (compareTarget === 'working') {
      // Get all file statuses
      const statusResult = await this.getDetailedStatus(workingDirectory);
      
      // Get numstat for staged and unstaged
      const stagedNumstat = await this.command(workingDirectory, 'git diff --numstat --cached');
      const unstagedNumstat = await this.command(workingDirectory, 'git diff --numstat');
      
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
      
      // Build file map
      for (const file of statusResult.files) {
        const fileInfo = {
          path: file.path,
          type: file.untracked ? 'added' : 'modified',
          status: file.status,  // Add the git status code for the icon
          additions: 0,
          deletions: 0,
          staged: file.staged,
          unstaged: file.unstaged,
          untracked: file.untracked,
          diffType: file.untracked ? 'untracked' : (file.staged && !file.unstaged) ? 'staged' : 'unstaged'
        };
        
        // Get stats from appropriate source
        if (file.staged && stagedStats.has(file.path)) {
          const stats = stagedStats.get(file.path);
          fileInfo.additions = stats.additions;
          fileInfo.deletions = stats.deletions;
        } else if (file.unstaged && unstagedStats.has(file.path)) {
          const stats = unstagedStats.get(file.path);
          fileInfo.additions = stats.additions;
          fileInfo.deletions = stats.deletions;
        } else if (file.untracked) {
          // For untracked files, count lines
          try {
            const content = await this.command(workingDirectory, `wc -l "${file.path}"`);
            const lineCount = parseInt(content.output.trim().split(' ')[0]) || 0;
            fileInfo.additions = lineCount;
            fileInfo.deletions = 0;
          } catch (error) {
            // If we can't count lines, leave as 0
          }
        }
        
        files.set(file.path, fileInfo);
      }
    } else {
      // Compare against a specific ref
      const diffNumstatResult = await this.command(workingDirectory, 
        `git diff --numstat ${compareTarget}...HEAD`);
      const diffStatusResult = await this.command(workingDirectory, 
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
        if (path && stats.has(path)) {
          const fileStats = stats.get(path);
          files.set(path, {
            path,
            type: status === 'A' ? 'added' : status === 'D' ? 'deleted' : 'modified',
            status: status,  // Add git status code for committed files
            additions: fileStats.additions,
            deletions: fileStats.deletions,
            diffType: 'committed'
          });
        }
      });
    }
    
    return { files };
  }

  /**
   * Get all changes including working tree and committed changes
   */
  async getAllChanges(workingDirectory, baseBranch = 'origin/main') {
    const allFiles = new Map();
    
    // Get working tree changes
    const workingTreeDiff = await this.getComprehensiveDiff(workingDirectory, 'working');
    
    // Add all working tree files
    for (const [path, fileInfo] of workingTreeDiff.files) {
      allFiles.set(path, {
        ...fileInfo,
        category: fileInfo.untracked ? 'untracked' : 
                 fileInfo.staged && !fileInfo.unstaged ? 'staged' :
                 'unstaged'
      });
    }
    
    // Get committed changes
    const committedDiff = await this.getComprehensiveDiff(workingDirectory, baseBranch);
    
    // Add committed files that aren't already in working tree
    for (const [path, fileInfo] of committedDiff.files) {
      if (!allFiles.has(path)) {
        allFiles.set(path, {
          ...fileInfo,
          category: 'committed'
        });
      }
    }
    
    // Convert to array and create summary
    const files = Array.from(allFiles.values());
    const summary = {
      totalFiles: files.length,
      committedFiles: files.filter(f => f.category === 'committed').length,
      stagedFiles: files.filter(f => f.category === 'staged').length,
      unstagedFiles: files.filter(f => f.category === 'unstaged').length,
      untrackedFiles: files.filter(f => f.category === 'untracked').length,
      totalAdditions: files.reduce((sum, f) => sum + (f.additions || 0), 0),
      totalDeletions: files.reduce((sum, f) => sum + (f.deletions || 0), 0)
    };
    
    return { files, summary };
  }

  /**
   * Configure git credentials for a repository
   */
  async configureCredentials(workingDirectory) {
    // Use the existing configureGitCredentials function
    return configureGitCredentials(workingDirectory, this.githubToken, this.gitConfig);
  }

  /**
   * Get unpushed commits info
   */
  async getUnpushedCommitsInfo(workingDirectory, currentBranch) {
    try {
      // Check if remote tracking branch exists
      const remoteCheck = await this.command(workingDirectory, 
        `git rev-parse --verify origin/${currentBranch} 2>/dev/null`);
      
      if (!remoteCheck.success) {
        // No remote tracking branch, all commits are unpushed
        const allCommits = await this.command(workingDirectory, 
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
      const countResult = await this.command(workingDirectory, 
        `git rev-list --count origin/${currentBranch}..HEAD`);
      const count = parseInt(countResult.output.trim(), 10) || 0;
      
      if (count === 0) {
        return { count: 0, commits: [] };
      }
      
      // Get unpushed commit details
      const logResult = await this.command(workingDirectory, 
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

  /**
   * Check for merge conflicts
   */
  async checkMergeConflicts(workingDirectory, targetBranch) {
    try {
      // Fast conflict check using git merge-tree
      const mergeTreeResult = await this.command(workingDirectory,
        `git merge-tree --write-tree --name-only HEAD ${targetBranch} 2>&1`);
      
      if (mergeTreeResult.success) {
        // Exit code 0 means clean merge is possible
        return {
          hasConflicts: false,
          conflicts: [],
          canMerge: true
        };
      }
      
      // Parse conflict markers from output
      const output = mergeTreeResult.output + mergeTreeResult.error;
      const conflictedFiles = [];
      const lines = output.split('\n');
      
      lines.forEach(line => {
        if (line.includes('CONFLICT')) {
          const match = line.match(/CONFLICT.*in (.+)/);
          if (match) {
            conflictedFiles.push(match[1]);
          }
        }
      });
      
      return {
        hasConflicts: conflictedFiles.length > 0,
        conflicts: conflictedFiles.map(file => ({ file, status: 'conflicted' })),
        canMerge: conflictedFiles.length === 0
      };
    } catch (error) {
      console.error('[Git] checkMergeConflicts error:', error.message);
      return {
        hasConflicts: false,
        conflicts: [],
        canMerge: true,
        error: 'Unable to check for conflicts'
      };
    }
  }

  /**
   * Get diff content for a specific file
   */
  async getFileDiffContent(workingDirectory, filePath, compareTarget = 'working', fileInfo = null, getCompleteDiff = false) {
    try {
      let diffCommand;
      
      if (compareTarget === 'working') {
        // For working tree comparisons
        if (fileInfo) {
          if (fileInfo.untracked) {
            // For untracked files, show as new file
            const content = await this.command(workingDirectory, `cat "${filePath}" 2>/dev/null || echo ""`);
            if (content.output) {
              const lines = content.output.split('\n');
              const diffHeader = `diff --git a/${filePath} b/${filePath}
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/${filePath}`;
              const diffContent = lines.map(line => `+${line}`).join('\n');
              return `${diffHeader}\n@@ -0,0 +1,${lines.length} @@\n${diffContent}`;
            }
            return '';
          } else if (fileInfo.staged && !fileInfo.unstaged) {
            // Only staged changes
            diffCommand = `git diff --cached -- "${filePath}"`;
          } else if (!fileInfo.staged && fileInfo.unstaged) {
            // Only unstaged changes
            diffCommand = `git diff -- "${filePath}"`;
          } else if (fileInfo.staged && fileInfo.unstaged) {
            // Both staged and unstaged - show working tree diff
            diffCommand = `git diff HEAD -- "${filePath}"`;
          }
        } else {
          // Default to working tree diff
          diffCommand = `git diff HEAD -- "${filePath}"`;
        }
      } else {
        // Compare against a specific ref (base branch)
        if (getCompleteDiff) {
          // For 'all' mode - show complete diff from base to working tree
          diffCommand = `git diff ${compareTarget}...HEAD -- "${filePath}"`;
          
          // Also check for uncommitted changes
          const workingDiff = await this.command(workingDirectory, `git diff HEAD -- "${filePath}"`);
          if (workingDiff.output.trim()) {
            const baseDiff = await this.command(workingDirectory, diffCommand);
            // Combine the diffs if both exist
            if (baseDiff.output.trim()) {
              return baseDiff.output + '\n' + workingDiff.output;
            }
            return workingDiff.output;
          }
        } else {
          // Normal base comparison
          diffCommand = `git diff ${compareTarget}...HEAD -- "${filePath}"`;
        }
      }
      
      if (!diffCommand) {
        return '';
      }
      
      const result = await this.command(workingDirectory, diffCommand);
      return result.output || '';
    } catch (error) {
      console.error(`Error getting file diff for ${filePath}:`, error);
      return '';
    }
  }
}

/**
 * Execute git command utility function
 */
export async function executeGitCommand(command, workingDirectory, githubToken = null) {
  const gitService = new GitService(githubToken);
  return gitService.executeCommand(command, workingDirectory);
}

/**
 * Configure git credentials utility function
 */
export async function configureGitCredentials(workingDirectory, githubToken, gitConfig = null) {
  const gitService = new GitService(githubToken);
  
  // Use provided git config or defaults
  const config = gitConfig || { name: 'PocketDev User', email: 'user@pocketdev.local' };
  
  const commands = [
    `git config user.name "${config.name}"`,
    `git config user.email "${config.email}"`
  ];

  // If we have a GitHub token, configure credential helper
  if (githubToken) {
    // Check if remote is GitHub
    const remoteResult = await gitService.executeCommand('git remote get-url origin', workingDirectory);
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
      const setUrlResult = await gitService.executeCommand(`git remote set-url origin "${authenticatedUrl}"`, workingDirectory);
      if (!setUrlResult.success) {
        console.error('[configureGitCredentials] Failed to set remote URL:', setUrlResult.error);
        return setUrlResult;
      }
    }
  }

  for (const command of commands) {
    const result = await gitService.executeCommand(command, workingDirectory);
    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}