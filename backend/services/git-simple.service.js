/**
 * GitService - Simplified Facade
 * 
 * A simple facade that composes the three deep git modules.
 * Provides a unified interface for common git operations.
 * 
 * This is a thin orchestration layer - all complexity is pushed down
 * into the specialized modules.
 */

import { GitRepository } from './git-repository.service.js';
import { GitWorkingTree } from './git-workingtree.service.js';
import { GitAnalyzer } from './git-analyzer.service.js';

export class GitService {
  constructor(githubToken = null, gitConfig = null) {
    this.repository = new GitRepository(githubToken);
    this.workingTree = new GitWorkingTree(githubToken, gitConfig);
    this.analyzer = new GitAnalyzer(githubToken);
    
    // Store for backward compatibility
    this.githubToken = githubToken;
    this.gitConfig = gitConfig || { 
      name: 'PocketDev AI', 
      email: 'ai@pocketdev.io' 
    };
  }

  // Repository operations (delegate to GitRepository)
  async clone(url, destination) {
    return this.repository.clone(url, destination);
  }

  async fetch(workingDirectory, options) {
    return this.repository.fetch(workingDirectory, options);
  }

  async push(workingDirectory, branch, options) {
    return this.repository.push(workingDirectory, branch, options);
  }

  async pull(workingDirectory, remote, branch) {
    return this.repository.pull(workingDirectory, remote, branch);
  }

  async getCurrentBranch(workingDirectory) {
    return this.repository.getCurrentBranch(workingDirectory);
  }

  // Working tree operations (delegate to GitWorkingTree)
  async stage(workingDirectory, files) {
    return this.workingTree.stage(workingDirectory, files);
  }

  async add(workingDirectory, files) {
    // Alias for stage (backward compatibility)
    return this.workingTree.stage(workingDirectory, files);
  }

  async commit(workingDirectory, message) {
    return this.workingTree.commit(workingDirectory, message);
  }

  async reset(workingDirectory, commit, hard) {
    return this.workingTree.reset(workingDirectory, { commit, hard });
  }

  async getStatus(workingDirectory) {
    return this.workingTree.getStatus(workingDirectory);
  }

  async checkout(workingDirectory, branch) {
    return this.workingTree.checkout(workingDirectory, branch);
  }

  async merge(workingDirectory, branch, message) {
    return this.workingTree.merge(workingDirectory, branch, message);
  }

  // Analyzer operations (delegate to GitAnalyzer)
  async getDiff(workingDirectory, args) {
    // Handle legacy string args format
    if (typeof args === 'string') {
      const options = {};
      if (args.includes('--stat')) options.stat = true;
      if (args.includes('--name-only')) options.nameOnly = true;
      // Extract target from args if present
      const target = args.replace('--stat', '').replace('--name-only', '').trim() || 'HEAD';
      options.target = target;
      return this.analyzer.getDiff(workingDirectory, options);
    }
    return this.analyzer.getDiff(workingDirectory, args);
  }

  async checkMergeConflicts(workingDirectory, targetBranch) {
    return this.analyzer.checkMergeConflicts(workingDirectory, targetBranch);
  }

  async getUnpushedCommits(workingDirectory, branch) {
    return this.analyzer.getUnpushedCommits(workingDirectory, branch);
  }

  async log(workingDirectory, args) {
    // Handle legacy string args format
    if (typeof args === 'string') {
      const options = {};
      const match = args.match(/-n (\d+)/);
      if (match) options.limit = parseInt(match[1]);
      if (args.includes('--oneline')) options.oneline = true;
      return this.analyzer.getCommitHistory(workingDirectory, options);
    }
    return this.analyzer.getCommitHistory(workingDirectory, args);
  }

  // Backward compatibility methods
  async executeCommand(command, workingDirectory) {
    // This is for legacy code that directly executes commands
    // Route to appropriate module based on command
    if (command.startsWith('git fetch')) {
      return this.repository.fetch(workingDirectory);
    } else if (command.startsWith('git push')) {
      const match = command.match(/git push.*origin (\S+)/);
      const branch = match ? match[1] : 'main';
      return this.repository.push(workingDirectory, branch);
    } else if (command.startsWith('git pull')) {
      return this.repository.pull(workingDirectory);
    } else if (command.startsWith('git add')) {
      return this.workingTree.stage(workingDirectory);
    } else if (command.startsWith('git commit')) {
      const match = command.match(/-m "(.+)"/);
      const message = match ? match[1] : 'Commit';
      return this.workingTree.commit(workingDirectory, message);
    } else if (command.startsWith('git status')) {
      return this.workingTree.getStatus(workingDirectory);
    } else if (command.startsWith('git diff')) {
      return this.analyzer.getDiff(workingDirectory);
    } else if (command.startsWith('git log')) {
      return this.analyzer.getCommitHistory(workingDirectory);
    } else if (command === 'git rev-parse HEAD') {
      return this.getHeadCommit(workingDirectory);
    } else if (command === 'git branch --show-current') {
      return this.repository.getCurrentBranch(workingDirectory);
    } else {
      // Fallback to direct execution for unknown commands
      return this._directExecute(command, workingDirectory);
    }
  }

  async command(workingDirectory, command) {
    // Alias for executeCommand
    return this.executeCommand(command, workingDirectory);
  }

  async getHeadCommit(workingDirectory) {
    return this._directExecute('git rev-parse HEAD', workingDirectory);
  }

  async rebase(workingDirectory, branch) {
    return this._directExecute(`git rebase ${branch}`, workingDirectory);
  }

  async stageFile(workingDirectory, filePath) {
    return this.workingTree.stage(workingDirectory, filePath);
  }

  async unstageFile(workingDirectory, filePath) {
    return this._directExecute(`git reset HEAD "${filePath}"`, workingDirectory);
  }

  async configureCredentials(workingDirectory) {
    // Simplified credential configuration
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const env = { ...process.env };
    if (this.githubToken) {
      env.GITHUB_TOKEN = this.githubToken;
      env.GH_TOKEN = this.githubToken;
    }
    
    // Set git config
    await execAsync(`git config user.name "${this.gitConfig.name}"`, {
      cwd: workingDirectory,
      env
    });
    await execAsync(`git config user.email "${this.gitConfig.email}"`, {
      cwd: workingDirectory,
      env
    });
    
    return { success: true };
  }

  // Private helper for direct command execution (legacy support)
  async _directExecute(command, workingDirectory) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    const env = { ...process.env };
    if (this.githubToken) {
      env.GITHUB_TOKEN = this.githubToken;
      env.GH_TOKEN = this.githubToken;
    }
    
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        env
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
}