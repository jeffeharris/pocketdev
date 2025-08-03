/**
 * Git Compatibility Layer
 * 
 * Provides backward compatibility for services that still need GitService
 * functionality while the system transitions to the new architecture.
 * 
 * This is a temporary bridge - these functions should eventually be
 * moved to the appropriate new services.
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

/**
 * Basic GitService-like class for compatibility
 */
export class GitService {
  constructor(githubToken = null, gitConfig = null) {
    this.githubToken = githubToken;
    this.gitConfig = gitConfig || { name: 'PocketDev AI', email: 'ai@pocketdev.io' };
  }

  /**
   * Execute a git command in a specific directory
   */
  async executeCommand(command, workingDirectory, options = {}) {
    try {
      const gitEnv = { ...process.env };
      
      if (this.githubToken) {
        gitEnv.GITHUB_TOKEN = this.githubToken;
      }

      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        env: gitEnv,
        ...options
      });

      return {
        success: true,
        output: stdout.trim(),
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
    return this.executeCommand('git status --porcelain -b', workingDirectory);
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
        files.push({ path: filename, status: 'untracked', staged: false, unstaged: false, untracked: true });
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
export async function configureGitCredentials(workingDirectory, githubToken) {
  if (!githubToken) {
    return { success: true };
  }

  const gitService = new GitService(githubToken);
  const commands = [
    'git config user.name "PocketDev AI"',
    'git config user.email "ai@pocketdev.io"'
  ];

  for (const command of commands) {
    const result = await gitService.executeCommand(command, workingDirectory);
    if (!result.success) {
      return result;
    }
  }

  return { success: true };
}