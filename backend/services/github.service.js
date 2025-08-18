/**
 * GitHubService - Handles all GitHub platform operations (PRs, issues, etc.)
 * 
 * This service provides a clean interface for GitHub-specific operations
 * using the GitHub CLI (gh command), separate from core git operations.
 * 
 * Following deep module principles: simple interface (4 methods), 
 * hiding complexity of GitHub CLI interactions and authentication.
 */
export class GitHubService {
  constructor(githubToken = null) {
    this.githubToken = githubToken;
  }

  /**
   * Create a pull request
   * @param {string} workingDirectory - Directory to run the command in
   * @param {string} title - PR title
   * @param {string} body - PR description
   * @param {Object} options - Additional options (base branch, draft status)
   * @returns {Promise<Object>} Command result
   */
  async createPullRequest(workingDirectory, title, body = '', options = {}) {
    const { base = 'main', draft = false } = options;
    
    // Build the gh pr create command
    let command = `gh pr create --title "${title}"`;
    if (body) {
      command += ` --body "${body}"`;
    }
    command += ` --base ${base}`;
    if (draft) {
      command += ' --draft';
    }
    
    return this._executeCommand(command, workingDirectory);
  }

  /**
   * Get pull request status
   * @param {string} workingDirectory - Directory to run the command in
   * @param {string} branch - Branch name to check PR status for
   * @returns {Promise<Object>} PR status information
   */
  async getPullRequestStatus(workingDirectory, branch = null) {
    try {
      // Get PR status for current branch or specified branch
      let command = 'gh pr status --json number,title,state,url';
      if (branch) {
        command += ` --branch ${branch}`;
      }
      
      const result = await this._executeCommand(command, workingDirectory);
      
      if (result.success && result.output) {
        try {
          const prData = JSON.parse(result.output);
          return {
            success: true,
            hasPR: !!prData.currentBranch,
            pr: prData.currentBranch || null
          };
        } catch (parseError) {
          // Fallback to checking if PR exists
          const listResult = await this._executeCommand(
            `gh pr list --head ${branch || 'HEAD'} --json number,title,state,url`,
            workingDirectory
          );
          
          if (listResult.success && listResult.output) {
            const prs = JSON.parse(listResult.output);
            return {
              success: true,
              hasPR: prs.length > 0,
              pr: prs[0] || null
            };
          }
        }
      }
      
      return {
        success: false,
        hasPR: false,
        pr: null,
        error: result.error
      };
    } catch (error) {
      return {
        success: false,
        hasPR: false,
        pr: null,
        error: error.message
      };
    }
  }

  /**
   * Merge a pull request
   * @param {string} workingDirectory - Directory to run the command in  
   * @param {string} prNumber - PR number to merge
   * @param {Object} options - Merge options (squash, delete-branch, etc.)
   * @returns {Promise<Object>} Merge result
   */
  async mergePullRequest(workingDirectory, prNumber, options = {}) {
    const { squash = false, deleteBranch = true, mergeMethod = 'merge' } = options;
    
    let command = `gh pr merge ${prNumber}`;
    
    // Add merge method
    if (squash || mergeMethod === 'squash') {
      command += ' --squash';
    } else if (mergeMethod === 'rebase') {
      command += ' --rebase';
    } else {
      command += ' --merge';
    }
    
    // Add delete branch option
    if (deleteBranch) {
      command += ' --delete-branch';
    }
    
    // Auto-confirm
    command += ' --yes';
    
    return this._executeCommand(command, workingDirectory);
  }

  /**
   * List pull requests
   * @param {string} workingDirectory - Directory to run the command in
   * @param {Object} options - List options (state, limit, etc.)
   * @returns {Promise<Object>} List of PRs
   */
  async listPullRequests(workingDirectory, options = {}) {
    const { state = 'open', limit = 10, author = null, base = null } = options;
    
    let command = `gh pr list --json number,title,state,author,url,createdAt,updatedAt`;
    command += ` --state ${state}`;
    command += ` --limit ${limit}`;
    
    if (author) {
      command += ` --author ${author}`;
    }
    
    if (base) {
      command += ` --base ${base}`;
    }
    
    const result = await this._executeCommand(command, workingDirectory);
    
    if (result.success && result.output) {
      try {
        const prs = JSON.parse(result.output);
        return {
          success: true,
          prs: prs
        };
      } catch (parseError) {
        return {
          success: false,
          prs: [],
          error: `Failed to parse PR list: ${parseError.message}`
        };
      }
    }
    
    return {
      success: false,
      prs: [],
      error: result.error
    };
  }

  // ========================================
  // PRIVATE HELPER METHODS
  // ========================================

  /**
   * Execute a shell command with proper error handling
   * @private
   */
  async _executeCommand(command, workingDirectory) {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    try {
      // Set up environment with GitHub token
      const env = { ...process.env };
      if (this.githubToken) {
        env.GH_TOKEN = this.githubToken;
        env.GITHUB_TOKEN = this.githubToken;
      }
      
      const { stdout, stderr } = await execAsync(command, {
        cwd: workingDirectory,
        env: env,
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      });
      
      // Check for common GitHub CLI errors in stderr
      if (stderr && stderr.includes('error')) {
        return {
          success: false,
          output: stdout,
          error: stderr
        };
      }
      
      return {
        success: true,
        output: stdout.trim(),
        error: stderr
      };
    } catch (error) {
      // Handle specific GitHub CLI errors
      if (error.message.includes('gh: command not found')) {
        return {
          success: false,
          output: '',
          error: 'GitHub CLI (gh) is not installed. Please install it first.'
        };
      }
      
      if (error.message.includes('authentication')) {
        return {
          success: false,
          output: '',
          error: 'GitHub authentication failed. Please check your token.'
        };
      }
      
      return {
        success: false,
        output: error.stdout || '',
        error: error.message || error.stderr || 'Command failed'
      };
    }
  }
}

export default GitHubService;