/**
 * GitWorkingTree Service - Deep Module
 * 
 * Handles working tree operations with a simple interface.
 * Only 6 public methods for all working tree operations.
 * 
 * Public API:
 * - stage(workingDirectory, files) - Stage files for commit
 * - commit(workingDirectory, message) - Commit staged changes
 * - reset(workingDirectory, mode) - Reset working tree
 * - getStatus(workingDirectory) - Get working tree status
 * - checkout(workingDirectory, branch) - Switch branches
 * - merge(workingDirectory, branch) - Merge branches
 */

import { GitExecutor } from './git-executor.js';

export class GitWorkingTree extends GitExecutor {
  constructor(githubToken = null, gitConfig = null) {
    super(githubToken);
    this.gitConfig = gitConfig || { 
      name: 'PocketDev AI', 
      email: 'ai@pocketdev.io' 
    };
  }

  /**
   * Stage files for commit
   */
  async stage(workingDirectory, files = '.') {
    const filesArg = Array.isArray(files) ? files.join(' ') : files;
    return this.execute(`git add ${filesArg}`, workingDirectory);
  }

  /**
   * Commit staged changes
   */
  async commit(workingDirectory, message) {
    // Ensure git config is set before committing
    await this._ensureGitConfig(workingDirectory);
    return this.execute(
      `git commit -m "${message}"`,
      workingDirectory
    );
  }

  /**
   * Reset working tree
   */
  async reset(workingDirectory, options = {}) {
    const { hard = false, commit = 'HEAD' } = options;
    const mode = hard ? '--hard' : '--mixed';
    return this.execute(
      `git reset ${mode} ${commit}`,
      workingDirectory
    );
  }

  /**
   * Get working tree status
   */
  async getStatus(workingDirectory) {
    return this.execute('git status --porcelain', workingDirectory);
  }

  /**
   * Switch branches
   */
  async checkout(workingDirectory, branch, options = {}) {
    const { create = false } = options;
    const flags = create ? '-b' : '';
    return this.execute(
      `git checkout ${flags} ${branch}`.trim(),
      workingDirectory
    );
  }

  /**
   * Merge branches
   */
  async merge(workingDirectory, branch, message = '') {
    const msgFlag = message ? `-m "${message}"` : '';
    return this.execute(
      `git merge ${branch} ${msgFlag}`.trim(),
      workingDirectory
    );
  }

  // Private helper methods
  async _ensureGitConfig(workingDirectory) {
    // Check if git config is already set
    const nameResult = await this.execute(
      'git config user.name',
      workingDirectory
    );
    const emailResult = await this.execute(
      'git config user.email',
      workingDirectory
    );
    
    // Set config if not already set
    if (!nameResult.output.trim() && this.gitConfig.name) {
      await this.execute(
        `git config user.name "${this.gitConfig.name}"`,
        workingDirectory
      );
    }
    if (!emailResult.output.trim() && this.gitConfig.email) {
      await this.execute(
        `git config user.email "${this.gitConfig.email}"`,
        workingDirectory
      );
    }
  }
}