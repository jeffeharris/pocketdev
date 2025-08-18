/**
 * GitAnalyzer Service - Deep Module
 * 
 * Analyzes repository state and provides insights.
 * Only 5 public methods for all analysis operations.
 * 
 * Public API:
 * - getDiff(workingDirectory, options) - Get diff information
 * - checkMergeConflicts(workingDirectory, targetBranch) - Check for conflicts
 * - getUnpushedCommits(workingDirectory, branch) - Get unpushed commits
 * - getCommitHistory(workingDirectory, options) - Get commit log
 * - getFileChanges(workingDirectory) - Get detailed file change information
 */

import { GitExecutor } from './git-executor.js';

export class GitAnalyzer extends GitExecutor {
  constructor(githubToken = null) {
    super(githubToken);
  }

  /**
   * Get diff information
   */
  async getDiff(workingDirectory, options = {}) {
    const { 
      target = 'HEAD', 
      stat = false, 
      nameOnly = false 
    } = options;
    
    const flags = [];
    if (stat) flags.push('--stat');
    if (nameOnly) flags.push('--name-only');
    
    return this.execute(
      `git diff ${flags.join(' ')} ${target}`.trim(),
      workingDirectory
    );
  }

  /**
   * Check for merge conflicts
   */
  async checkMergeConflicts(workingDirectory, targetBranch) {
    try {
      // Fast conflict check using git merge-tree
      const result = await this.execute(
        `git merge-tree --write-tree --name-only HEAD ${targetBranch} 2>&1`,
        workingDirectory
      );
      
      if (result.success) {
        // Exit code 0 means clean merge is possible
        return {
          hasConflicts: false,
          conflicts: [],
          canMerge: true
        };
      }
      
      // Parse conflict markers from output
      const output = result.output + result.error;
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
      return {
        hasConflicts: false,
        conflicts: [],
        canMerge: true,
        error: 'Unable to check for conflicts'
      };
    }
  }

  /**
   * Get unpushed commits
   */
  async getUnpushedCommits(workingDirectory, branch) {
    // Check if remote branch exists
    const remoteCheck = await this.execute(
      `git rev-parse --verify origin/${branch} 2>/dev/null`,
      workingDirectory
    );
    
    if (!remoteCheck.success) {
      // No remote branch, all commits are unpushed
      const allCommits = await this.execute(
        'git log --oneline',
        workingDirectory
      );
      return this._parseCommitLog(allCommits.output);
    }
    
    // Get unpushed commits
    const result = await this.execute(
      `git log origin/${branch}..HEAD --oneline`,
      workingDirectory
    );
    
    return this._parseCommitLog(result.output);
  }

  /**
   * Get commit history
   */
  async getCommitHistory(workingDirectory, options = {}) {
    const { 
      limit = 10, 
      oneline = true,
      since = null,
      author = null 
    } = options;
    
    const args = [];
    if (oneline) args.push('--oneline');
    if (limit) args.push(`-n ${limit}`);
    if (since) args.push(`--since="${since}"`);
    if (author) args.push(`--author="${author}"`);
    
    const result = await this.execute(
      `git log ${args.join(' ')}`.trim(),
      workingDirectory
    );
    
    if (oneline) {
      return this._parseCommitLog(result.output);
    }
    return result;
  }

  /**
   * Get detailed file change information
   */
  async getFileChanges(workingDirectory, options = {}) {
    const { compareTarget = 'HEAD' } = options;
    
    // Get file status
    const statusResult = await this.execute(
      'git status --porcelain --untracked-files=all',
      workingDirectory
    );
    
    // Get diff statistics
    const diffStatResult = await this.execute(
      `git diff --numstat ${compareTarget}`,
      workingDirectory
    );
    
    // Parse and combine results
    const files = this._parseFileStatus(statusResult.output);
    const stats = this._parseDiffStats(diffStatResult.output);
    
    // Merge statistics into file information
    files.forEach(file => {
      if (stats[file.path]) {
        file.additions = stats[file.path].additions;
        file.deletions = stats[file.path].deletions;
      }
    });
    
    return {
      files,
      summary: {
        totalFiles: files.length,
        staged: files.filter(f => f.staged).length,
        unstaged: files.filter(f => f.unstaged).length,
        untracked: files.filter(f => f.untracked).length,
        totalAdditions: files.reduce((sum, f) => sum + (f.additions || 0), 0),
        totalDeletions: files.reduce((sum, f) => sum + (f.deletions || 0), 0)
      }
    };
  }

  // Private helper methods
  _parseCommitLog(output) {
    if (!output.trim()) return { count: 0, commits: [] };
    
    const commits = output.trim().split('\n').filter(line => line).map(line => {
      const [hash, ...messageParts] = line.split(' ');
      return { hash, message: messageParts.join(' ') };
    });
    
    return { count: commits.length, commits };
  }

  _parseFileStatus(output) {
    const files = [];
    
    output.split('\n').forEach(line => {
      if (!line.trim()) return;
      
      const status = line.substring(0, 2);
      const filename = line.substring(3);
      const indexStatus = status[0];
      const workingStatus = status[1];
      
      if (status === '??') {
        files.push({ 
          path: filename, 
          status: '??', 
          staged: false, 
          unstaged: false, 
          untracked: true 
        });
      } else {
        files.push({ 
          path: filename, 
          status: status,
          staged: indexStatus !== ' ' && indexStatus !== '?',
          unstaged: workingStatus !== ' ' && workingStatus !== '?',
          untracked: false
        });
      }
    });
    
    return files;
  }

  _parseDiffStats(output) {
    const stats = {};
    
    output.split('\n').filter(line => line.trim()).forEach(line => {
      const [add, del, ...pathParts] = line.split('\t');
      const path = pathParts.join('\t');
      if (path) {
        stats[path] = { 
          additions: parseInt(add) || 0, 
          deletions: parseInt(del) || 0 
        };
      }
    });
    
    return stats;
  }
}